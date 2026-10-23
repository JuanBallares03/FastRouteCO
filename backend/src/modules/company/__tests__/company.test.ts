import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import { UserRole, CompanyStatus, SubscriptionStatus, ServiceModality } from '@prisma/client';
import companyRoutes from '../company.routes.js';
import { prisma } from '../../../lib/prisma.js';
import { hashPassword, createTokenPair } from '../../auth/auth.service.js';

const app = express();
app.use(express.json());
app.use('/api/v1/company', companyRoutes);

const COMPANY_ID = crypto.randomUUID();
const COMPANY_ADMIN_ID = crypto.randomUUID();
const SUPERVISOR_ID = crypto.randomUUID();
const PLAN_ID = crypto.randomUUID();
const COMPANY_ADMIN_EMAIL = 'company-admin@test.com';
const SUPERVISOR_EMAIL = 'supervisor@test.com';
const TEST_PASSWORD = 'TestPass123!';
let companyAdminToken: string;
let supervisorToken: string;

async function cleanup() {
  await prisma.refreshToken.deleteMany({ where: { userId: { in: [COMPANY_ADMIN_ID, SUPERVISOR_ID] } } });
  await prisma.userInvitation.deleteMany({ where: { userId: { in: [COMPANY_ADMIN_ID, SUPERVISOR_ID] } } });
  await prisma.user.deleteMany({ where: { id: { in: [COMPANY_ADMIN_ID, SUPERVISOR_ID] } } });
  await prisma.creditBalance.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.subscription.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.company.deleteMany({ where: { id: COMPANY_ID } });
  await prisma.plan.deleteMany({ where: { id: PLAN_ID } });
}

beforeAll(async () => {
  await cleanup();

  await prisma.plan.create({
    data: {
      id: PLAN_ID,
      name: 'Test Free Trial Plan',
      modality: ServiceModality.subscription,
      trialDays: 7,
      monthlyCredits: 100,
      maxBranches: 3,
      maxDrivers: 10,
      isActive: true,
    },
  });

  await prisma.company.create({
    data: {
      id: COMPANY_ID,
      legalName: 'Test Company',
      taxId: '900.000.001-1',
      email: 'company@test.com',
      phone: '+57 1 2345678',
      address: 'Calle 123',
      status: CompanyStatus.active,
      hasOwnFleet: true,
    },
  });

  await prisma.subscription.create({
    data: {
      companyId: COMPANY_ID,
      planId: PLAN_ID,
      status: SubscriptionStatus.active,
      startDate: new Date(),
      renewalDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.creditBalance.create({
    data: {
      companyId: COMPANY_ID,
      planCredits: 100,
      extraCredits: 0,
    },
  });

  const passwordHash = await hashPassword(TEST_PASSWORD);

  await prisma.user.create({
    data: {
      id: COMPANY_ADMIN_ID,
      companyId: COMPANY_ID,
      role: UserRole.company_admin,
      fullName: 'Company Admin',
      email: COMPANY_ADMIN_EMAIL,
      passwordHash,
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      id: SUPERVISOR_ID,
      companyId: COMPANY_ID,
      role: UserRole.supervisor,
      fullName: 'Supervisor',
      email: SUPERVISOR_EMAIL,
      passwordHash,
      isActive: true,
    },
  });

  const adminTokens = await createTokenPair({
    id: COMPANY_ADMIN_ID,
    email: COMPANY_ADMIN_EMAIL,
    role: UserRole.company_admin,
    companyId: COMPANY_ID,
    fullName: 'Company Admin',
    passwordHash,
    phone: null,
    isActive: true,
    createdAt: new Date(),
  });
  companyAdminToken = adminTokens.accessToken;

  const supervisorTokens = await createTokenPair({
    id: SUPERVISOR_ID,
    email: SUPERVISOR_EMAIL,
    role: UserRole.supervisor,
    companyId: COMPANY_ID,
    fullName: 'Supervisor',
    passwordHash,
    phone: null,
    isActive: true,
    createdAt: new Date(),
  });
  supervisorToken = supervisorTokens.accessToken;
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.refreshToken.deleteMany({ where: { userId: { in: [COMPANY_ADMIN_ID, SUPERVISOR_ID] } } });
});

function companyAdminHeader() {
  return { Authorization: `Bearer ${companyAdminToken}` };
}

function supervisorHeader() {
  return { Authorization: `Bearer ${supervisorToken}` };
}

describe('Company Module (Company Admin / Supervisor)', () => {
  describe('GET /api/v1/company', () => {
    it('should return company details for company_admin', async () => {
      const res = await request(app)
        .get('/api/v1/company')
        .set(companyAdminHeader());

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(COMPANY_ID);
      expect(res.body.legalName).toBe('Test Company');
      expect(res.body.email).toBe('company@test.com');
      expect(res.body.activeSubscription).not.toBeNull();
      expect(res.body.creditBalance).not.toBeNull();
    });

    it('should return company details for supervisor', async () => {
      const res = await request(app)
        .get('/api/v1/company')
        .set(supervisorHeader());

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(COMPANY_ID);
    });

    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/v1/company');
      expect(res.status).toBe(401);
    });

    it('should return 403 for driver', async () => {
      const driverId = crypto.randomUUID();
      const driverEmail = `driver-${crypto.randomUUID()}@test.com`;
      const passwordHash = await hashPassword(TEST_PASSWORD);
      await prisma.user.create({
        data: {
          id: driverId,
          companyId: COMPANY_ID,
          role: UserRole.driver,
          fullName: 'Driver',
          email: driverEmail,
          passwordHash,
          isActive: true,
        },
      });
      const tokens = await createTokenPair({
        id: driverId,
        email: driverEmail,
        role: UserRole.driver,
        companyId: COMPANY_ID,
        fullName: 'Driver',
        passwordHash,
        phone: null,
        isActive: true,
        createdAt: new Date(),
      });
      const res = await request(app)
        .get('/api/v1/company')
        .set({ Authorization: `Bearer ${tokens.accessToken}` });
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/v1/company', () => {
    it('should update email, phone, address, and settings for company_admin', async () => {
      const res = await request(app)
        .patch('/api/v1/company')
        .set(companyAdminHeader())
        .send({
          email: 'new-email@test.com',
          phone: '+57 1 9876543',
          address: 'Carrera 456',
          settings: { theme: 'dark', notifications: true },
        });

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('new-email@test.com');
      expect(res.body.phone).toBe('+57 1 9876543');
      expect(res.body.address).toBe('Carrera 456');
      expect(res.body.settings).toEqual({ theme: 'dark', notifications: true });

      const company = await prisma.company.findUnique({ where: { id: COMPANY_ID } });
      expect(company?.email).toBe('new-email@test.com');
    });

    it('should reject duplicate email', async () => {
      await prisma.company.create({
        data: {
          id: crypto.randomUUID(),
          legalName: 'Other Company',
          taxId: `900.${crypto.randomUUID().slice(0,3)}.${crypto.randomUUID().slice(0,3)}-${crypto.randomUUID().slice(0,1)}`,
          email: 'existing@test.com',
          status: CompanyStatus.active,
          hasOwnFleet: true,
        },
      });

      const res = await request(app)
        .patch('/api/v1/company')
        .set(companyAdminHeader())
        .send({ email: 'existing@test.com' });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('El email ya está registrado');
    });

    it('should not allow updating legal_name, tax_id, or has_own_fleet', async () => {
      const res = await request(app)
        .patch('/api/v1/company')
        .set(companyAdminHeader())
        .send({
          legalName: 'New Legal Name',
          taxId: '900.000.999-9',
          hasOwnFleet: false,
        });

      expect(res.status).toBe(200);
      // These fields should be ignored, not cause an error
      const company = await prisma.company.findUnique({ where: { id: COMPANY_ID } });
      expect(company?.legalName).toBe('Test Company');
      expect(company?.taxId).toBe('900.000.001-1');
      expect(company?.hasOwnFleet).toBe(true);
    });

    it('should reject invalid email format', async () => {
      const res = await request(app)
        .patch('/api/v1/company')
        .set(companyAdminHeader())
        .send({ email: 'invalid-email' });

      expect(res.status).toBe(400);
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .patch('/api/v1/company')
        .send({ email: 'new@test.com' });
      expect(res.status).toBe(401);
    });

    it('should return 403 for supervisor', async () => {
      const res = await request(app)
        .patch('/api/v1/company')
        .set(supervisorHeader())
        .send({ phone: '+57 1 1111111' });
      expect(res.status).toBe(403);
    });
  });
});