import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import { UserRole, CompanyStatus, SubscriptionStatus, ServiceModality, DriverStatus } from '@prisma/client';
import companyRoutes from '../company.routes.js';
import { prisma } from '../../../lib/prisma.js';
import { hashPassword, createTokenPair } from '../../auth/auth.service.js';

const app = express();
app.use(express.json());
app.use('/api/v1/company', companyRoutes);

const COMPANY_ID = crypto.randomUUID();
const OTHER_COMPANY_ID = crypto.randomUUID();
const COMPANY_ADMIN_ID = crypto.randomUUID();
const SUPERVISOR_ID = crypto.randomUUID();
const OTHER_ADMIN_ID = crypto.randomUUID();
const PLAN_ID = crypto.randomUUID();

const COMPANY_ADMIN_EMAIL = `company-admin-${COMPANY_ID}@test.com`;
const SUPERVISOR_EMAIL = `supervisor-${SUPERVISOR_ID}@test.com`;
const OTHER_ADMIN_EMAIL = `other-admin-${OTHER_ADMIN_ID}@test.com`;
const TEST_PASSWORD = 'TestPass123!';

let companyAdminToken: string;
let supervisorToken: string;
let otherAdminToken: string;

const companyIds = [COMPANY_ID, OTHER_COMPANY_ID];

async function cleanup() {
  await prisma.userInvitation.deleteMany({
    where: { user: { companyId: { in: companyIds } } },
  });
  await prisma.refreshToken.deleteMany({
    where: { user: { companyId: { in: companyIds } } },
  });
  await prisma.driver.deleteMany({
    where: { user: { companyId: { in: companyIds } } },
  });
  await prisma.branch.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.user.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.creditBalance.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.subscription.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  await prisma.plan.deleteMany({ where: { id: PLAN_ID } });
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  await cleanup();

  await prisma.plan.create({
    data: {
      id: PLAN_ID,
      name: `Test Plan ${PLAN_ID}`,
      modality: ServiceModality.subscription,
      maxBranches: 2,
      maxDrivers: 2,
      isActive: true,
    },
  });

  for (const companyId of companyIds) {
    await prisma.company.create({
      data: {
        id: companyId,
        legalName: `Test Company ${companyId}`,
        taxId: companyId.slice(0, 20),
        email: `${companyId}@company.com`,
        status: CompanyStatus.active,
        hasOwnFleet: true,
      },
    });

    await prisma.subscription.create({
      data: {
        companyId,
        planId: PLAN_ID,
        status: SubscriptionStatus.active,
        startDate: new Date(),
        renewalDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  const passwordHash = await hashPassword(TEST_PASSWORD);

  const admin = await prisma.user.create({
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

  await prisma.user.create({
    data: {
      id: OTHER_ADMIN_ID,
      companyId: OTHER_COMPANY_ID,
      role: UserRole.company_admin,
      fullName: 'Other Admin',
      email: OTHER_ADMIN_EMAIL,
      passwordHash,
      isActive: true,
    },
  });

  const adminTokens = await createTokenPair(admin);
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

  const otherTokens = await createTokenPair({
    id: OTHER_ADMIN_ID,
    email: OTHER_ADMIN_EMAIL,
    role: UserRole.company_admin,
    companyId: OTHER_COMPANY_ID,
    fullName: 'Other Admin',
    passwordHash,
    phone: null,
    isActive: true,
    createdAt: new Date(),
  });
  otherAdminToken = otherTokens.accessToken;
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(async () => {
  const manageableRoles = [UserRole.supervisor, UserRole.driver];

  await prisma.userInvitation.deleteMany({
    where: { user: { companyId: { in: companyIds } } },
  });
  await prisma.refreshToken.deleteMany({
    where: { user: { companyId: { in: companyIds } } },
  });
  await prisma.driver.deleteMany({
    where: { user: { companyId: { in: companyIds } } },
  });
  await prisma.user.deleteMany({
    where: { companyId: { in: companyIds }, role: { in: manageableRoles } },
  });
  await prisma.branch.deleteMany({ where: { companyId: { in: companyIds } } });

  await prisma.user.create({
    data: {
      id: SUPERVISOR_ID,
      companyId: COMPANY_ID,
      role: UserRole.supervisor,
      fullName: 'Supervisor',
      email: SUPERVISOR_EMAIL,
      passwordHash: await hashPassword(TEST_PASSWORD),
      isActive: true,
    },
  });
});

describe('Company branches (HU-26, RF23)', () => {
  it('creates a branch for the company admin', async () => {
    const res = await request(app)
      .post('/api/v1/company/branches')
      .set(authHeader(companyAdminToken))
      .send({ name: 'Sede Centro', address: 'Calle 10 # 5-20' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Sede Centro');
    expect(res.body.companyId).toBe(COMPANY_ID);
  });

  it('lists only branches of its own company', async () => {
    await prisma.branch.create({
      data: { companyId: COMPANY_ID, name: 'Sede Propia' },
    });
    await prisma.branch.create({
      data: { companyId: OTHER_COMPANY_ID, name: 'Sede Ajena' },
    });

    const res = await request(app)
      .get('/api/v1/company/branches')
      .set(authHeader(companyAdminToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Sede Propia');
  });

  it('isolates branches between companies (RNF09)', async () => {
    await prisma.branch.create({
      data: { companyId: COMPANY_ID, name: 'Sede Propia' },
    });
    await prisma.branch.create({
      data: { companyId: OTHER_COMPANY_ID, name: 'Sede Ajena' },
    });

    const res = await request(app)
      .get('/api/v1/company/branches')
      .set(authHeader(otherAdminToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Sede Ajena');
  });

  it('rejects more branches than the active plan allows', async () => {
    await prisma.branch.createMany({
      data: [
        { companyId: COMPANY_ID, name: 'Sede 1' },
        { companyId: COMPANY_ID, name: 'Sede 2' },
      ],
    });

    const res = await request(app)
      .post('/api/v1/company/branches')
      .set(authHeader(companyAdminToken))
      .send({ name: 'Sede 3' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('máximo 2');
  });

  it('updates a branch of its own company', async () => {
    const branch = await prisma.branch.create({
      data: { companyId: COMPANY_ID, name: 'Sede Vieja', address: 'Calle 1' },
    });

    const res = await request(app)
      .patch(`/api/v1/company/branches/${branch.id}`)
      .set(authHeader(companyAdminToken))
      .send({ name: 'Sede Nueva', address: 'Calle 2' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Sede Nueva');
    expect(res.body.address).toBe('Calle 2');
  });

  it('does not allow updating a branch from another company', async () => {
    const branch = await prisma.branch.create({
      data: { companyId: OTHER_COMPANY_ID, name: 'Sede Ajena' },
    });

    const res = await request(app)
      .patch(`/api/v1/company/branches/${branch.id}`)
      .set(authHeader(companyAdminToken))
      .send({ name: 'Intento' });

    expect(res.status).toBe(404);
  });

  it('does not allow supervisors to manage branches', async () => {
    const res = await request(app)
      .post('/api/v1/company/branches')
      .set(authHeader(supervisorToken))
      .send({ name: 'Sede Supervisor' });

    expect(res.status).toBe(403);
  });
});

describe('Company supervisors (HU-25)', () => {
  it('creates a supervisor with an invitation', async () => {
    const email = `new-supervisor-${crypto.randomUUID()}@test.com`;

    const res = await request(app)
      .post('/api/v1/company/supervisors')
      .set(authHeader(companyAdminToken))
      .send({ fullName: 'Nuevo Supervisor', email, phone: '+57 300 000 0000' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe(UserRole.supervisor);
    expect(res.body.user.isActive).toBe(true);
    expect(res.body.invitationUrl).toContain('/set-password?token=');

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user!.passwordHash).toBeNull();
    expect(user!.companyId).toBe(COMPANY_ID);
  });

  it('lists only supervisors of its own company', async () => {
    await prisma.user.create({
      data: {
        companyId: OTHER_COMPANY_ID,
        role: UserRole.supervisor,
        fullName: 'Supervisor Ajeno',
        email: `other-supervisor-${crypto.randomUUID()}@test.com`,
      },
    });

    const res = await request(app)
      .get('/api/v1/company/supervisors')
      .set(authHeader(companyAdminToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].email).toBe(SUPERVISOR_EMAIL);
  });

  it('rejects a duplicated email', async () => {
    const res = await request(app)
      .post('/api/v1/company/supervisors')
      .set(authHeader(companyAdminToken))
      .send({ fullName: 'Duplicado', email: SUPERVISOR_EMAIL });

    expect(res.status).toBe(409);
  });

  it('deactivates and reactivates a supervisor', async () => {
    const deactivate = await request(app)
      .patch(`/api/v1/company/supervisors/${SUPERVISOR_ID}/status`)
      .set(authHeader(companyAdminToken))
      .send({ isActive: false });

    expect(deactivate.status).toBe(200);
    expect(deactivate.body.isActive).toBe(false);

    const user = await prisma.user.findUnique({ where: { id: SUPERVISOR_ID } });
    expect(user?.isActive).toBe(false);

    const reactivate = await request(app)
      .patch(`/api/v1/company/supervisors/${SUPERVISOR_ID}/status`)
      .set(authHeader(companyAdminToken))
      .send({ isActive: true });

    expect(reactivate.status).toBe(200);
    expect(reactivate.body.isActive).toBe(true);
  });

  it('does not allow managing a supervisor from another company', async () => {
    const otherSupervisor = await prisma.user.create({
      data: {
        companyId: OTHER_COMPANY_ID,
        role: UserRole.supervisor,
        fullName: 'Supervisor Ajeno',
        email: `other-supervisor-${crypto.randomUUID()}@test.com`,
      },
    });

    const res = await request(app)
      .patch(`/api/v1/company/supervisors/${otherSupervisor.id}/status`)
      .set(authHeader(companyAdminToken))
      .send({ isActive: false });

    expect(res.status).toBe(404);
  });
});

describe('Company drivers (HU-27, RF03)', () => {
  async function createDriver(email: string) {
    return request(app)
      .post('/api/v1/company/drivers')
      .set(authHeader(companyAdminToken))
      .send({ fullName: 'Conductor', email, phone: '+57 300 111 2222' });
  }

  it('creates a driver with a driver profile and invitation', async () => {
    const email = `driver-${crypto.randomUUID()}@test.com`;

    const res = await createDriver(email);

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe(UserRole.driver);
    expect(res.body.user.status).toBe(DriverStatus.unavailable);
    expect(res.body.invitationUrl).toContain('/set-password?token=');

    const user = await prisma.user.findUnique({
      where: { email },
      include: { driver: true },
    });
    expect(user).not.toBeNull();
    expect(user!.companyId).toBe(COMPANY_ID);
    expect(user!.driver?.status).toBe(DriverStatus.unavailable);
  });

  it('allows supervisors to create drivers', async () => {
    const res = await request(app)
      .post('/api/v1/company/drivers')
      .set(authHeader(supervisorToken))
      .send({ fullName: 'Conductor Supervisor', email: `driver-${crypto.randomUUID()}@test.com` });

    expect(res.status).toBe(201);
  });

  it('lists drivers with their availability and only from its own company', async () => {
    await createDriver(`driver-${crypto.randomUUID()}@test.com`);

    const otherDriver = await prisma.user.create({
      data: {
        companyId: OTHER_COMPANY_ID,
        role: UserRole.driver,
        fullName: 'Conductor Ajeno',
        email: `other-driver-${crypto.randomUUID()}@test.com`,
      },
    });
    await prisma.driver.create({ data: { userId: otherDriver.id } });

    const res = await request(app)
      .get('/api/v1/company/drivers')
      .set(authHeader(companyAdminToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe(DriverStatus.unavailable);
  });

  it('rejects more drivers than the active plan allows', async () => {
    await createDriver(`driver-${crypto.randomUUID()}@test.com`);
    await createDriver(`driver-${crypto.randomUUID()}@test.com`);

    const res = await createDriver(`driver-${crypto.randomUUID()}@test.com`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('máximo 2');
  });

  it('updates driver data', async () => {
    const email = `driver-${crypto.randomUUID()}@test.com`;
    const created = await createDriver(email);
    const driverId = created.body.user.id as string;

    const res = await request(app)
      .patch(`/api/v1/company/drivers/${driverId}`)
      .set(authHeader(companyAdminToken))
      .send({ fullName: 'Conductor Actualizado', phone: '+57 300 999 9999' });

    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('Conductor Actualizado');
    expect(res.body.phone).toBe('+57 300 999 9999');
  });

  it('deactivates a driver and updates availability', async () => {
    const created = await createDriver(`driver-${crypto.randomUUID()}@test.com`);
    const driverId = created.body.user.id as string;

    const deactivate = await request(app)
      .patch(`/api/v1/company/drivers/${driverId}/status`)
      .set(authHeader(companyAdminToken))
      .send({ isActive: false });

    expect(deactivate.status).toBe(200);
    expect(deactivate.body.isActive).toBe(false);

    const availability = await request(app)
      .patch(`/api/v1/company/drivers/${driverId}/availability`)
      .set(authHeader(supervisorToken))
      .send({ status: DriverStatus.available });

    expect(availability.status).toBe(200);
    expect(availability.body.status).toBe(DriverStatus.available);

    const driver = await prisma.driver.findUnique({ where: { userId: driverId } });
    expect(driver?.status).toBe(DriverStatus.available);
  });

  it('does not allow managing a driver from another company', async () => {
    const otherDriver = await prisma.user.create({
      data: {
        companyId: OTHER_COMPANY_ID,
        role: UserRole.driver,
        fullName: 'Conductor Ajeno',
        email: `other-driver-${crypto.randomUUID()}@test.com`,
      },
    });
    await prisma.driver.create({ data: { userId: otherDriver.id } });

    const res = await request(app)
      .patch(`/api/v1/company/drivers/${otherDriver.id}/status`)
      .set(authHeader(companyAdminToken))
      .send({ isActive: false });

    expect(res.status).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/company/drivers');
    expect(res.status).toBe(401);
  });
});
