import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import { UserRole, CompanyStatus, SubscriptionStatus } from '@prisma/client';
import platformRoutes from '../companies.routes.js';
import authRoutes from '../../auth/auth.routes.js';
import { prisma } from '../../../lib/prisma.js';
import { hashPassword, createTokenPair } from '../../auth/auth.service.js';

const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/platform', platformRoutes);

const PLATFORM_ADMIN_ID = crypto.randomUUID();
const PLATFORM_ADMIN_EMAIL = 'platform-companies-test@admin.com';
const PLATFORM_ADMIN_PASSWORD = 'PlatformPass123!';
let platformAdminAccessToken: string;
let freeTrialPlanId: string;

const TEST_PREFIX = 'CompaniesTest_';

async function cleanupCompaniesTest() {
  await prisma.refreshToken.deleteMany({ where: { userId: PLATFORM_ADMIN_ID } });
  await prisma.userInvitation.deleteMany({ where: { user: { companyId: { not: null } } } });
  await prisma.user.deleteMany({ where: { id: PLATFORM_ADMIN_ID } });
  await prisma.user.deleteMany({ where: { email: PLATFORM_ADMIN_EMAIL } });
  
  // Delete all companies to ensure clean state
  await prisma.creditBalance.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.user.deleteMany({ where: { companyId: { not: null } } });
  await prisma.company.deleteMany();
  
  await prisma.plan.deleteMany({ where: { name: 'Free Trial Plan' } });
}

beforeAll(async () => {
  await cleanupCompaniesTest();

  const freeTrialPlan = await prisma.plan.create({
    data: {
      name: 'Free Trial Plan',
      modality: 'subscription',
      trialDays: 7,
      monthlyCredits: 100,
      isActive: true,
    },
  });
  freeTrialPlanId = freeTrialPlan.id;

  const passwordHash = await hashPassword(PLATFORM_ADMIN_PASSWORD);
  await prisma.user.create({
    data: {
      id: PLATFORM_ADMIN_ID,
      role: UserRole.platform_admin,
      fullName: 'Platform Admin',
      email: PLATFORM_ADMIN_EMAIL,
      passwordHash,
      isActive: true,
    },
  });

  const tokens = await createTokenPair({
    id: PLATFORM_ADMIN_ID,
    email: PLATFORM_ADMIN_EMAIL,
    role: UserRole.platform_admin,
    companyId: null,
    fullName: 'Platform Admin',
    passwordHash,
    phone: null,
    isActive: true,
    createdAt: new Date(),
  });
  platformAdminAccessToken = tokens.accessToken;
});

afterAll(async () => {
  await cleanupCompaniesTest();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.refreshToken.deleteMany({ where: { userId: PLATFORM_ADMIN_ID } });
  await prisma.userInvitation.deleteMany({ where: { user: { companyId: { not: null } } } });
  
  const testCompanies = await prisma.company.findMany({
    where: { legalName: { startsWith: TEST_PREFIX } },
    select: { id: true },
  });
  const testCompanyIds = testCompanies.map((c) => c.id);
  
  if (testCompanyIds.length > 0) {
    await prisma.creditBalance.deleteMany({ where: { companyId: { in: testCompanyIds } } });
    await prisma.subscription.deleteMany({ where: { companyId: { in: testCompanyIds } } });
    await prisma.user.deleteMany({ where: { companyId: { in: testCompanyIds } } });
    await prisma.company.deleteMany({ where: { id: { in: testCompanyIds } } });
  }
});

function authHeader() {
  return { Authorization: `Bearer ${platformAdminAccessToken}` };
}

let taxIdCounter = 0;
function uniqueTaxId() {
  taxIdCounter++;
  const suite = String(Math.floor(taxIdCounter / 1000)).padStart(3, '0');
  const num = String(taxIdCounter % 1000).padStart(3, '0');
  return `900.${suite}.${num}-${num}`;
}

let emailCounter = 0;
function uniqueEmail(prefix: string) {
  emailCounter++;
  return `${prefix}${emailCounter}@company.com`;
}

describe('Companies Module', () => {
  describe('POST /api/v1/platform/companies', () => {
    it('should create company with subscription and credit balance', async () => {
      const taxId = uniqueTaxId();
      const email = uniqueEmail('test');

      const res = await request(app)
        .post('/api/v1/platform/companies')
        .set(authHeader())
        .send({
          legalName: `${TEST_PREFIX}Create Company`,
          taxId,
          email,
          phone: '+57 1 2345678',
          address: 'Calle 123',
          hasOwnFleet: true,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.legalName).toBe(`${TEST_PREFIX}Create Company`);
      expect(res.body.taxId).toBe(taxId);
      expect(res.body.status).toBe(CompanyStatus.active);

      const company = await prisma.company.findUnique({ where: { id: res.body.id } });
      expect(company).not.toBeNull();

      const subscription = await prisma.subscription.findFirst({
        where: { companyId: company!.id, status: SubscriptionStatus.active },
        include: { plan: true },
      });
      expect(subscription).not.toBeNull();
      expect(subscription!.planId).toBe(freeTrialPlanId);
      expect(subscription!.status).toBe(SubscriptionStatus.active);
      expect(subscription!.billingCycle).toBeNull();
      expect(subscription!.paymentId).toBeNull();
      expect(subscription!.renewalDate).not.toBeNull();
      const renewalDate = new Date(subscription!.renewalDate!);
      const expectedRenewal = new Date();
      expectedRenewal.setDate(expectedRenewal.getDate() + 7);
      // Allow up to 24 hours tolerance for timezone/precision differences
      expect(Math.abs(renewalDate.getTime() - expectedRenewal.getTime())).toBeLessThan(24 * 60 * 60 * 1000);

      const creditBalance = await prisma.creditBalance.findUnique({ where: { companyId: company!.id } });
      expect(creditBalance).not.toBeNull();
      expect(creditBalance!.planCredits).toBe(100);
      expect(creditBalance!.extraCredits).toBe(0);
    });

    it('should reject company without own fleet', async () => {
      const res = await request(app)
        .post('/api/v1/platform/companies')
        .set(authHeader())
        .send({
          legalName: 'No Fleet Company',
          taxId: uniqueTaxId(),
          email: uniqueEmail('nofleet'),
          hasOwnFleet: false,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('La empresa debe tener flota propia');
    });

    it('should reject duplicate NIT', async () => {
      const taxId = uniqueTaxId();
      await prisma.company.create({
        data: {
          id: crypto.randomUUID(),
          legalName: `${TEST_PREFIX}Existing Company`,
          taxId,
          email: uniqueEmail('existing'),
          status: CompanyStatus.active,
          hasOwnFleet: true,
        },
      });

      const res = await request(app)
        .post('/api/v1/platform/companies')
        .set(authHeader())
        .send({
          legalName: `${TEST_PREFIX}Another Company`,
          taxId,
          email: uniqueEmail('another'),
          hasOwnFleet: true,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('El NIT ya está registrado');
    });

    it('should reject missing required fields', async () => {
      const res = await request(app)
        .post('/api/v1/platform/companies')
        .set(authHeader())
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 401 without platform_admin token', async () => {
      const res = await request(app)
        .post('/api/v1/platform/companies')
        .send({
          legalName: `${TEST_PREFIX}Create Company`,
          taxId: uniqueTaxId(),
          email: uniqueEmail('test'),
          hasOwnFleet: true,
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/platform/companies', () => {
    let company1Id: string;
    let company2Id: string;

    beforeEach(async () => {
      emailCounter = 0;
      taxIdCounter = 0;
      
      const company1 = await prisma.company.create({
        data: {
          id: crypto.randomUUID(),
          legalName: `${TEST_PREFIX}Active Company`,
          taxId: uniqueTaxId(),
          email: uniqueEmail('active'),
          status: CompanyStatus.active,
          hasOwnFleet: true,
        },
      });
      company1Id = company1.id;

      const company2 = await prisma.company.create({
        data: {
          id: crypto.randomUUID(),
          legalName: `${TEST_PREFIX}Dormant Company`,
          taxId: uniqueTaxId(),
          email: uniqueEmail('dormant'),
          status: CompanyStatus.inactive,
          hasOwnFleet: true,
        },
      });
      company2Id = company2.id;

      await prisma.subscription.createMany({
        data: [
          {
            companyId: company1Id,
            planId: freeTrialPlanId,
            status: SubscriptionStatus.active,
            startDate: new Date(),
            renewalDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
          {
            companyId: company2Id,
            planId: freeTrialPlanId,
            status: SubscriptionStatus.inactive,
            startDate: new Date(),
            renewalDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        ],
      });
    });

    it('should list companies with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/platform/companies')
        .set(authHeader())
        .query({ page: 1, pageSize: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.pageSize).toBe(10);
    });

    it('should filter by company status', async () => {
      const res = await request(app)
        .get('/api/v1/platform/companies')
        .set(authHeader())
        .query({ companyStatus: 'active' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe(CompanyStatus.active);
    });

    it('should filter by subscription status', async () => {
      const res = await request(app)
        .get('/api/v1/platform/companies')
        .set(authHeader())
        .query({ subscriptionStatus: 'active' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].activeSubscription?.status).toBe(SubscriptionStatus.active);
    });

    it('should filter by plan', async () => {
      const res = await request(app)
        .get('/api/v1/platform/companies')
        .set(authHeader())
        .query({ planId: freeTrialPlanId });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should search by legal name or NIT', async () => {
      const res = await request(app)
        .get('/api/v1/platform/companies')
        .set(authHeader())
        .query({ search: 'Active' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].legalName).toBe(`${TEST_PREFIX}Active Company`);
    });

    it('should return 401 without platform_admin token', async () => {
      const res = await request(app).get('/api/v1/platform/companies');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/platform/companies/:id', () => {
    let companyId: string;

    beforeEach(async () => {
      const company = await prisma.company.create({
        data: {
          id: crypto.randomUUID(),
          legalName: `${TEST_PREFIX}Detail Company`,
          taxId: uniqueTaxId(),
          email: uniqueEmail('detail'),
          status: CompanyStatus.active,
          hasOwnFleet: true,
        },
      });
      companyId = company.id;

      await prisma.subscription.create({
        data: {
          companyId,
          planId: freeTrialPlanId,
          status: SubscriptionStatus.active,
          startDate: new Date(),
          renewalDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    });

    it('should return company detail with subscription and admins', async () => {
      const res = await request(app)
        .get(`/api/v1/platform/companies/${companyId}`)
        .set(authHeader());

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(companyId);
      expect(res.body.legalName).toBe(`${TEST_PREFIX}Detail Company`);
      expect(res.body.activeSubscription).not.toBeNull();
      expect(res.body.activeSubscription.planId).toBe(freeTrialPlanId);
      expect(res.body.admins).toEqual([]);
    });

    it('should return 404 for non-existent company', async () => {
      const res = await request(app)
        .get(`/api/v1/platform/companies/${crypto.randomUUID()}`)
        .set(authHeader());

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Empresa no encontrada');
    });
  });

  describe('PATCH /api/v1/platform/companies/:id/status', () => {
    let companyId: string;
    let userId: string;
    let userEmail: string;

    beforeEach(async () => {
      emailCounter = 0;
      taxIdCounter = 0;
      
      const company = await prisma.company.create({
        data: {
          id: crypto.randomUUID(),
          legalName: `${TEST_PREFIX}Status Test Company`,
          taxId: uniqueTaxId(),
          email: uniqueEmail('status'),
          status: CompanyStatus.active,
          hasOwnFleet: true,
        },
      });
      companyId = company.id;

      userEmail = uniqueEmail('admin');
      const user = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          companyId,
          role: UserRole.company_admin,
          fullName: 'Company Admin',
          email: userEmail,
          passwordHash: await hashPassword('AdminPass123!'),
          isActive: true,
        },
      });
      userId = user.id;

      await createTokenPair({
        id: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        fullName: user.fullName,
        passwordHash: user.passwordHash!,
        phone: null,
        isActive: user.isActive,
        createdAt: user.createdAt,
      });
    });

    it('should deactivate company and revoke user refresh tokens', async () => {
      await request(app)
        .patch(`/api/v1/platform/companies/${companyId}/status`)
        .set(authHeader())
        .send({ isActive: false });

      const company = await prisma.company.findUnique({ where: { id: companyId } });
      expect(company?.status).toBe(CompanyStatus.inactive);

      const tokens = await prisma.refreshToken.findMany({ where: { userId } });
      expect(tokens.every((t) => t.revokedAt !== null)).toBe(true);
    });

    it('should block login for users of deactivated company', async () => {
      await request(app)
        .patch(`/api/v1/platform/companies/${companyId}/status`)
        .set(authHeader())
        .send({ isActive: false });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: userEmail, password: 'AdminPass123!' });

      expect(loginRes.status).toBe(403);
    });

    it('should reactivate company', async () => {
      await request(app)
        .patch(`/api/v1/platform/companies/${companyId}/status`)
        .set(authHeader())
        .send({ isActive: false });

      const res = await request(app)
        .patch(`/api/v1/platform/companies/${companyId}/status`)
        .set(authHeader())
        .send({ isActive: true });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(CompanyStatus.active);

      const company = await prisma.company.findUnique({ where: { id: companyId } });
      expect(company?.status).toBe(CompanyStatus.active);
    });

    it('should return 404 for non-existent company', async () => {
      const res = await request(app)
        .patch(`/api/v1/platform/companies/${crypto.randomUUID()}/status`)
        .set(authHeader())
        .send({ isActive: false });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/platform/companies/:id/admins', () => {
    let companyId: string;

    beforeEach(async () => {
      emailCounter = 0;
      taxIdCounter = 0;
      
      const company = await prisma.company.create({
        data: {
          id: crypto.randomUUID(),
          legalName: `${TEST_PREFIX}Admin Test Company`,
          taxId: uniqueTaxId(),
          email: uniqueEmail('admin'),
          status: CompanyStatus.active,
          hasOwnFleet: true,
        },
      });
      companyId = company.id;

      await prisma.user.createMany({
        data: [
          {
            id: crypto.randomUUID(),
            companyId,
            role: UserRole.company_admin,
            fullName: 'Admin 1',
            email: uniqueEmail('admin1'),
            isActive: true,
          },
          {
            id: crypto.randomUUID(),
            companyId,
            role: UserRole.company_admin,
            fullName: 'Admin 2',
            email: uniqueEmail('admin2'),
            isActive: false,
          },
          {
            id: crypto.randomUUID(),
            companyId,
            role: UserRole.supervisor,
            fullName: 'Supervisor',
            email: uniqueEmail('supervisor'),
            isActive: true,
          },
        ],
      });
    });

    it('should list only company admins', async () => {
      const res = await request(app)
        .get(`/api/v1/platform/companies/${companyId}/admins`)
        .set(authHeader());

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.every((a: { role: UserRole }) => a.role === UserRole.company_admin)).toBe(true);
    });

    it('should return 404 for non-existent company', async () => {
      const res = await request(app)
        .get(`/api/v1/platform/companies/${crypto.randomUUID()}/admins`)
        .set(authHeader());

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/platform/companies/:id/admins', () => {
    let companyId: string;

    beforeEach(async () => {
      emailCounter = 0;
      taxIdCounter = 0;
      
      const company = await prisma.company.create({
        data: {
          id: crypto.randomUUID(),
          legalName: `${TEST_PREFIX}Admin Create Company`,
          taxId: uniqueTaxId(),
          email: uniqueEmail('admin'),
          status: CompanyStatus.active,
          hasOwnFleet: true,
        },
      });
      companyId = company.id;
    });

    it('should create company admin and send invitation', async () => {
      const newAdminEmail = uniqueEmail('newadmin');
      const res = await request(app)
        .post(`/api/v1/platform/companies/${companyId}/admins`)
        .set(authHeader())
        .send({
          fullName: 'New Admin',
          email: newAdminEmail,
          phone: '+57 1 2345678',
        });

      expect(res.status).toBe(201);
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user.fullName).toBe('New Admin');
      expect(res.body.user.email).toBe(newAdminEmail);
      expect(res.body.user.role).toBe(UserRole.company_admin);
      expect(res.body.user.isActive).toBe(true);
      expect(res.body.user.passwordHash).toBeNull();
      expect(res.body.invitationUrl).toContain('/set-password?token=');

      const user = await prisma.user.findUnique({ where: { email: newAdminEmail } });
      expect(user).not.toBeNull();
      expect(user!.role).toBe(UserRole.company_admin);

      const invitation = await prisma.userInvitation.findFirst({ where: { userId: user!.id } });
      expect(invitation).not.toBeNull();
      expect(invitation!.usedAt).toBeNull();
    });

    it('should reject duplicate email', async () => {
      const email = uniqueEmail('existing');
      await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          companyId,
          role: UserRole.company_admin,
          fullName: 'Existing Admin',
          email,
          isActive: true,
        },
      });

      const res = await request(app)
        .post(`/api/v1/platform/companies/${companyId}/admins`)
        .set(authHeader())
        .send({
          fullName: 'Another Admin',
          email,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('El email ya está registrado');
    });

    it('should return 404 for non-existent company', async () => {
      const res = await request(app)
        .post(`/api/v1/platform/companies/${crypto.randomUUID()}/admins`)
        .set(authHeader())
        .send({
          fullName: 'New Admin',
          email: uniqueEmail('new'),
        });

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/platform/companies/:id/admins/:adminId/status', () => {
    let companyId: string;
    let adminId: string;
    let adminEmail: string;

    beforeEach(async () => {
      emailCounter = 0;
      taxIdCounter = 0;
      
      const company = await prisma.company.create({
        data: {
          id: crypto.randomUUID(),
          legalName: `${TEST_PREFIX}Admin Status Company`,
          taxId: uniqueTaxId(),
          email: uniqueEmail('admin'),
          status: CompanyStatus.active,
          hasOwnFleet: true,
        },
      });
      companyId = company.id;

      adminEmail = uniqueEmail('statusadmin');
      const admin = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          companyId,
          role: UserRole.company_admin,
          fullName: 'Status Admin',
          email: adminEmail,
          passwordHash: await hashPassword('AdminPass123!'),
          isActive: true,
        },
      });
      adminId = admin.id;

      await createTokenPair({
        id: admin.id,
        email: admin.email,
        role: admin.role,
        companyId: admin.companyId,
        fullName: admin.fullName,
        passwordHash: admin.passwordHash!,
        phone: null,
        isActive: admin.isActive,
        createdAt: admin.createdAt,
      });
    });

    it('should deactivate admin and revoke refresh tokens', async () => {
      await request(app)
        .patch(`/api/v1/platform/companies/${companyId}/admins/${adminId}/status`)
        .set(authHeader())
        .send({ isActive: false });

      const admin = await prisma.user.findUnique({ where: { id: adminId } });
      expect(admin?.isActive).toBe(false);

      const tokens = await prisma.refreshToken.findMany({ where: { userId: adminId } });
      expect(tokens.every((t) => t.revokedAt !== null)).toBe(true);
    });

    it('should block login for deactivated admin', async () => {
      await request(app)
        .patch(`/api/v1/platform/companies/${companyId}/admins/${adminId}/status`)
        .set(authHeader())
        .send({ isActive: false });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: adminEmail, password: 'AdminPass123!' });

      expect(loginRes.status).toBe(403);
    });

    it('should reactivate admin', async () => {
      await request(app)
        .patch(`/api/v1/platform/companies/${companyId}/admins/${adminId}/status`)
        .set(authHeader())
        .send({ isActive: false });

      const res = await request(app)
        .patch(`/api/v1/platform/companies/${companyId}/admins/${adminId}/status`)
        .set(authHeader())
        .send({ isActive: true });

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(true);

      const admin = await prisma.user.findUnique({ where: { id: adminId } });
      expect(admin?.isActive).toBe(true);
    });

    it('should return 404 for non-existent admin', async () => {
      const res = await request(app)
        .patch(`/api/v1/platform/companies/${companyId}/admins/${crypto.randomUUID()}/status`)
        .set(authHeader())
        .send({ isActive: false });

      expect(res.status).toBe(404);
    });
  });
});