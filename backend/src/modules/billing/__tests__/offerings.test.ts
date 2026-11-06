import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CompanyStatus, UserRole } from '@prisma/client';
import offeringRoutes from '../offerings.routes.js';
import { prisma } from '../../../lib/prisma.js';
import { createTokenPair, hashPassword } from '../../auth/auth.service.js';

const app = express();
app.use(express.json());
app.use('/api/v1/platform', offeringRoutes);

const COMPANY_ID = randomUUID();
const ADMIN_ID = randomUUID();
const PASSWORD = 'Offering123!';
let token: string;

function authHeader() {
  return { Authorization: `Bearer ${token}` };
}

async function cleanup() {
  await prisma.refreshToken.deleteMany({ where: { user: { companyId: COMPANY_ID } } });
  await prisma.user.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.company.deleteMany({ where: { id: COMPANY_ID } });
  await prisma.plan.deleteMany({ where: { name: { startsWith: 'Offering Test ' } } });
  await prisma.creditPackage.deleteMany({ where: { name: { startsWith: 'Offering Test ' } } });
  await prisma.module.deleteMany({ where: { code: { startsWith: 'offering-test-' } } });
}

beforeAll(async () => {
  await cleanup();
  await prisma.company.create({
    data: {
      id: COMPANY_ID,
      legalName: 'Offering Test Company',
      taxId: COMPANY_ID.slice(0, 20),
      email: `offering-${COMPANY_ID}@company.com`,
      status: CompanyStatus.active,
      hasOwnFleet: true,
    },
  });
  const admin = await prisma.user.create({
    data: {
      id: ADMIN_ID,
      companyId: COMPANY_ID,
      role: UserRole.platform_admin,
      fullName: 'Offering Admin',
      email: `offering-admin-${ADMIN_ID}@test.com`,
      passwordHash: await hashPassword(PASSWORD),
      isActive: true,
    },
  });
  token = (await createTokenPair(admin)).accessToken;
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('Platform offerings', () => {
  it('creates and lists plans, modules and credit packages', async () => {
    const moduleRes = await request(app)
      .post('/api/v1/platform/modules')
      .set(authHeader())
      .send({
        code: `offering-test-${randomUUID().slice(0, 8)}`,
        name: 'Offering Test Module',
        price: 25000,
        isActive: true,
      });
    expect(moduleRes.status).toBe(201);

    const packageRes = await request(app)
      .post('/api/v1/platform/credit-packages')
      .set(authHeader())
      .send({ name: `Offering Test Pack ${randomUUID().slice(0, 8)}`, credits: 10, price: 40000, isActive: true });
    expect(packageRes.status).toBe(201);

    const planRes = await request(app)
      .post('/api/v1/platform/plans')
      .set(authHeader())
      .send({
        name: `Offering Test Plan ${randomUUID().slice(0, 8)}`,
        modality: 'subscription',
        maxDrivers: 10,
        maxBranches: 2,
        supportType: 'email',
        trialDays: 0,
        monthlyCredits: 50,
        monthlyPrice: 100000,
        annualPrice: 1000000,
        includedDrivers: null,
        pricePerOptimization: null,
        pricePerAdditionalDriver: null,
        earlyChargeThreshold: null,
        isActive: true,
        moduleIds: [moduleRes.body.id],
      });
    expect(planRes.status).toBe(201);
    expect(planRes.body.modules).toHaveLength(1);

    const list = await request(app)
      .get('/api/v1/platform/plans')
      .set(authHeader());
    expect(list.status).toBe(200);
    expect(list.body.some((plan: { id: string }) => plan.id === planRes.body.id)).toBe(true);

    const deactivated = await request(app)
      .patch(`/api/v1/platform/plans/${planRes.body.id}`)
      .set(authHeader())
      .send({ isActive: false });
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.isActive).toBe(false);
  });

  it('requires the platform admin role', async () => {
    const companyAdmin = await prisma.user.create({
      data: {
        companyId: COMPANY_ID,
        role: UserRole.company_admin,
        fullName: 'Company Admin',
        email: `offering-company-admin-${randomUUID()}@test.com`,
        passwordHash: await hashPassword(PASSWORD),
        isActive: true,
      },
    });
    const companyToken = (await createTokenPair(companyAdmin)).accessToken;

    const res = await request(app)
      .get('/api/v1/platform/plans')
      .set({ Authorization: `Bearer ${companyToken}` });

    expect(res.status).toBe(403);
  });
});
