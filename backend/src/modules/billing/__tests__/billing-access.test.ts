import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { CompanyStatus, UserRole } from '@prisma/client';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';
import { createTokenPair, hashPassword } from '../../auth/auth.service.js';

const app = createApp();

const COMPANY_ID = crypto.randomUUID();
const SUPERVISOR_ID = crypto.randomUUID();
const DRIVER_ID = crypto.randomUUID();
const TEST_PASSWORD = 'TestPass123!';

let supervisorToken: string;
let driverToken: string;

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function cleanup() {
  await prisma.refreshToken.deleteMany({
    where: { userId: { in: [SUPERVISOR_ID, DRIVER_ID] } },
  });
  await prisma.userInvitation.deleteMany({
    where: { userId: { in: [SUPERVISOR_ID, DRIVER_ID] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [SUPERVISOR_ID, DRIVER_ID] } },
  });
  await prisma.company.deleteMany({ where: { id: COMPANY_ID } });
}

beforeAll(async () => {
  await cleanup();

  await prisma.company.create({
    data: {
      id: COMPANY_ID,
      legalName: `Billing Access Company ${COMPANY_ID}`,
      taxId: COMPANY_ID.slice(0, 20),
      email: `${COMPANY_ID}@company.com`,
      status: CompanyStatus.active,
      hasOwnFleet: true,
    },
  });

  const passwordHash = await hashPassword(TEST_PASSWORD);

  const supervisor = await prisma.user.create({
    data: {
      id: SUPERVISOR_ID,
      companyId: COMPANY_ID,
      role: UserRole.supervisor,
      fullName: 'Billing Access Supervisor',
      email: `billing-supervisor-${SUPERVISOR_ID}@test.com`,
      passwordHash,
      isActive: true,
    },
  });

  const driver = await prisma.user.create({
    data: {
      id: DRIVER_ID,
      companyId: COMPANY_ID,
      role: UserRole.driver,
      fullName: 'Billing Access Driver',
      email: `billing-driver-${DRIVER_ID}@test.com`,
      passwordHash,
      isActive: true,
    },
  });

  supervisorToken = (await createTokenPair(supervisor)).accessToken;
  driverToken = (await createTokenPair(driver)).accessToken;
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

const billingPaths = [
  '/api/v1/company/billing',
  '/api/v1/company/BILLING',
  '/api/v1/company/billing//offerings',
  '/api/v1/company/billing/%6Ffferings',
];

describe('billing route access control', () => {
  it.each(billingPaths)('rejects a Logistics Supervisor on %s', async (path) => {
    const response = await request(app).get(path).set(authHeader(supervisorToken));

    expect(response.status).toBe(403);
  });

  it.each(billingPaths)('rejects a driver on %s', async (path) => {
    const response = await request(app).get(path).set(authHeader(driverToken));

    expect(response.status).toBe(403);
  });

  it('does not apply billing authorization to the supervisor dashboard', async () => {
    const response = await request(app)
      .get('/api/v1/company/reports/dashboard')
      .set(authHeader(supervisorToken));

    expect(response.status).toBe(200);
  });

  it('still rejects drivers from the supervisor dashboard', async () => {
    const response = await request(app)
      .get('/api/v1/company/reports/dashboard')
      .set(authHeader(driverToken));

    expect(response.status).toBe(403);
  });
});
