import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { CompanyStatus, UserRole } from '@prisma/client';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';
import { createTokenPair, hashPassword } from '../../auth/auth.service.js';

const app = createApp();

const COMPANY_ID = crypto.randomUUID();
const ADMIN_ID = crypto.randomUUID();
const SUPERVISOR_ID = crypto.randomUUID();
const DRIVER_ID = crypto.randomUUID();
const TEST_PASSWORD = 'TestPass123!';

let adminToken: string;
let supervisorToken: string;
let driverToken: string;

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function cleanup() {
  await prisma.refreshToken.deleteMany({
    where: { userId: { in: [ADMIN_ID, SUPERVISOR_ID, DRIVER_ID] } },
  });
  await prisma.userInvitation.deleteMany({
    where: { userId: { in: [ADMIN_ID, SUPERVISOR_ID, DRIVER_ID] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [ADMIN_ID, SUPERVISOR_ID, DRIVER_ID] } },
  });
  await prisma.company.deleteMany({ where: { id: COMPANY_ID } });
}

beforeAll(async () => {
  await cleanup();

  await prisma.company.create({
    data: {
      id: COMPANY_ID,
      legalName: `Dashboard Access Company ${COMPANY_ID}`,
      taxId: COMPANY_ID.slice(0, 20),
      email: `${COMPANY_ID}@company.com`,
      status: CompanyStatus.active,
      hasOwnFleet: true,
    },
  });

  const passwordHash = await hashPassword(TEST_PASSWORD);

  const admin = await prisma.user.create({
    data: {
      id: ADMIN_ID,
      companyId: COMPANY_ID,
      role: UserRole.company_admin,
      fullName: 'Dashboard Admin',
      email: `dashboard-admin-${ADMIN_ID}@test.com`,
      passwordHash,
      isActive: true,
    },
  });

  const supervisor = await prisma.user.create({
    data: {
      id: SUPERVISOR_ID,
      companyId: COMPANY_ID,
      role: UserRole.supervisor,
      fullName: 'Dashboard Supervisor',
      email: `dashboard-supervisor-${SUPERVISOR_ID}@test.com`,
      passwordHash,
      isActive: true,
    },
  });

  const driver = await prisma.user.create({
    data: {
      id: DRIVER_ID,
      companyId: COMPANY_ID,
      role: UserRole.driver,
      fullName: 'Dashboard Driver',
      email: `dashboard-driver-${DRIVER_ID}@test.com`,
      passwordHash,
      isActive: true,
    },
  });

  adminToken = (await createTokenPair(admin)).accessToken;
  supervisorToken = (await createTokenPair(supervisor)).accessToken;
  driverToken = (await createTokenPair(driver)).accessToken;
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('GET /api/v1/company/reports/dashboard access', () => {
  it('serves the dashboard to a Logistics Supervisor', async () => {
    const response = await request(app)
      .get('/api/v1/company/reports/dashboard')
      .set(authHeader(supervisorToken));

    expect(response.status).toBe(200);
    expect(response.body.today).toBeDefined();
  });

  it('serves the dashboard to a Company Administrator', async () => {
    const response = await request(app)
      .get('/api/v1/company/reports/dashboard')
      .set(authHeader(adminToken));

    expect(response.status).toBe(200);
  });

  it('rejects drivers', async () => {
    const response = await request(app)
      .get('/api/v1/company/reports/dashboard')
      .set(authHeader(driverToken));

    expect(response.status).toBe(403);
  });
});
