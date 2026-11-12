import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BillingCycle,
  CompanyStatus,
  PaymentPurpose,
  PaymentStatus,
  SubscriptionStatus,
  UsageChargeStatus,
  UserRole,
} from '@prisma/client';
import billingRoutes from '../billing.routes.js';
import paymentRoutes from '../payments.routes.js';
import { prisma } from '../../../lib/prisma.js';
import { env } from '../../../env.js';
import { createTokenPair, hashPassword } from '../../auth/auth.service.js';
import { buildPaymentReference } from '../billing.service.js';
import {
  addDays,
  addMonths,
  parseBusinessDate,
  startOfMonth,
  todayInBogota,
} from '../../../lib/dates.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/api/v1/company', billingRoutes);
app.use('/api/v1/payments', paymentRoutes);

const chargePaymentSource = vi.fn();
const createCardPaymentSource = vi.fn();

vi.mock('../../../lib/wompi.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/wompi.js')>();
  return {
    ...actual,
    buildCheckoutUrl: (params: {
      reference: string;
      amountInCents: number;
    }) => `https://checkout.test/?reference=${encodeURIComponent(params.reference)}`,
    createCardPaymentSource: (...args: unknown[]) => createCardPaymentSource(...args),
    chargePaymentSource: (...args: unknown[]) => chargePaymentSource(...args),
  };
});

const COMPANY_ID = randomUUID();
const OTHER_COMPANY_ID = randomUUID();
const ADMIN_ID = randomUUID();
const PASSWORD = 'Billing123!';

let adminToken: string;
let planId: string;
let packageId: string;
let moduleId: string;
let driverId: string;

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function deleteOperationalData(companyIds: string[]) {
  await prisma.companyModule.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.creditPurchase.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.creditTransaction.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.usageCharge.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.subscription.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.payment.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.notification.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.creditBalance.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.routeStop.deleteMany({ where: { route: { companyId: { in: companyIds } } } });
  await prisma.route.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.driver.deleteMany({ where: { user: { companyId: { in: companyIds } } } });
}

async function cleanup() {
  const companyIds = [COMPANY_ID, OTHER_COMPANY_ID];
  await deleteOperationalData(companyIds);
  await prisma.refreshToken.deleteMany({ where: { user: { companyId: { in: companyIds } } } });
  await prisma.user.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  await prisma.plan.deleteMany({ where: { name: { startsWith: 'Billing Test ' } } });
  await prisma.creditPackage.deleteMany({ where: { name: { startsWith: 'Billing Test ' } } });
  await prisma.module.deleteMany({ where: { code: { startsWith: 'billing-test-' } } });
  await prisma.systemSetting.deleteMany({
    where: { key: 'billing_jobs_last_run' },
  });
}

async function resetCompanyState() {
  const companyIds = [COMPANY_ID, OTHER_COMPANY_ID];
  await deleteOperationalData(companyIds);
  await prisma.company.update({
    where: { id: COMPANY_ID },
    data: { cardReference: null, monthlySpendingLimit: null },
  });

  await prisma.subscription.create({
    data: {
      companyId: COMPANY_ID,
      planId,
      status: SubscriptionStatus.active,
      billingCycle: BillingCycle.monthly,
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      renewalDate: new Date('2027-11-01T00:00:00.000Z'),
    },
  });
  await prisma.creditBalance.create({
    data: { companyId: COMPANY_ID, planCredits: 10, extraCredits: 0 },
  });
}

async function activatePayPerUse() {
  await prisma.subscription.deleteMany({ where: { companyId: COMPANY_ID } });
  const payPerUsePlan = await prisma.plan.create({
    data: {
      name: `Billing Test Pay Per Use ${randomUUID().slice(0, 8)}`,
      modality: 'pay_per_use',
      monthlyPrice: 0,
      includedDrivers: 1,
      pricePerOptimization: 2000,
      pricePerAdditionalDriver: 2000,
      earlyChargeThreshold: 5000,
      isActive: true,
    },
  });
  await prisma.subscription.create({
    data: {
      companyId: COMPANY_ID,
      planId: payPerUsePlan.id,
      status: SubscriptionStatus.active,
      billingCycle: BillingCycle.monthly,
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      renewalDate: new Date('2027-11-01T00:00:00.000Z'),
    },
  });
  await prisma.company.update({
    where: { id: COMPANY_ID },
    data: { cardReference: '98765' },
  });
  return payPerUsePlan;
}

function signedEvent(transaction: Record<string, unknown>) {
  const payload = {
    event: 'transaction.updated',
    data: { transaction },
    environment: 'test',
    signature: { properties: ['transaction.id', 'transaction.status'], checksum: '' },
    timestamp: Date.now(),
  };
  const values = payload.signature.properties.map((property) =>
    property.split('.').reduce<unknown>(
      (value, key) =>
        value && typeof value === 'object'
          ? (value as Record<string, unknown>)[key]
          : undefined,
      payload.data
    )
  );
  payload.signature.checksum = createHash('sha256')
    .update(`${values.join('')}${payload.timestamp}${env.WOMPI_EVENTS_SECRET}`)
    .digest('hex');
  return payload;
}

beforeAll(async () => {
  await cleanup();
  const passwordHash = await hashPassword(PASSWORD);

  for (const companyId of [COMPANY_ID, OTHER_COMPANY_ID]) {
    await prisma.company.create({
      data: {
        id: companyId,
        legalName: `Billing Company ${companyId}`,
        taxId: companyId.slice(0, 20),
        email: `billing-${companyId}@company.com`,
        status: CompanyStatus.active,
        hasOwnFleet: true,
      },
    });
  }

  const admin = await prisma.user.create({
    data: {
      id: ADMIN_ID,
      companyId: COMPANY_ID,
      role: UserRole.company_admin,
      fullName: 'Billing Admin',
      email: `billing-admin-${ADMIN_ID}@test.com`,
      passwordHash,
      isActive: true,
    },
  });
  adminToken = (await createTokenPair(admin)).accessToken;

  const plan = await prisma.plan.create({
    data: {
      name: `Billing Test Pro ${randomUUID().slice(0, 8)}`,
      modality: 'subscription',
      monthlyCredits: 10,
      monthlyPrice: 100000,
      annualPrice: 1000000,
      isActive: true,
    },
  });
  planId = plan.id;

  const pkg = await prisma.creditPackage.create({
    data: {
      name: `Billing Test Pack ${randomUUID().slice(0, 8)}`,
      credits: 20,
      price: 50000,
      isActive: true,
    },
  });
  packageId = pkg.id;

  const module = await prisma.module.create({
    data: {
      code: `billing-test-${randomUUID().slice(0, 8)}`,
      name: 'Billing Test Module',
      price: 25000,
      isActive: true,
    },
  });
  moduleId = module.id;
});

beforeEach(async () => {
  await resetCompanyState();
  vi.clearAllMocks();
  chargePaymentSource.mockImplementation(async (params: { reference: string; amountInCents: number }) => ({
    id: `tx-${randomUUID()}`,
    status: 'APPROVED',
    amount_in_cents: params.amountInCents,
    currency: 'COP',
    reference: params.reference,
    payment_method_type: 'CARD',
  }));
  createCardPaymentSource.mockResolvedValue({ id: 98765, status: 'AVAILABLE' });
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('Company billing', () => {
  it('returns the active subscription and available credits', async () => {
    const res = await request(app)
      .get('/api/v1/company/billing')
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.subscription.status).toBe(SubscriptionStatus.active);
    expect(res.body.credits).toMatchObject({ planCredits: 10, total: 10 });
  });

  it('starts a credit package checkout', async () => {
    const res = await request(app)
      .post('/api/v1/company/billing/credits/purchase')
      .set(authHeader(adminToken))
      .send({ packageId });

    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(50000);
    const payment = await prisma.payment.findUnique({ where: { id: res.body.paymentId } });
    expect(payment?.purpose).toBe(PaymentPurpose.credit_package);
    expect(payment?.status).toBe(PaymentStatus.pending);
  });

  it('approves a credit purchase from a signed Wompi event', async () => {
    const start = await request(app)
      .post('/api/v1/company/billing/credits/purchase')
      .set(authHeader(adminToken))
      .send({ packageId });
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: start.body.paymentId },
    });
    const reference = buildPaymentReference(payment.id, 'credit_package', packageId);

    const event = signedEvent({
      id: `tx-${randomUUID()}`,
      status: 'APPROVED',
      amount_in_cents: 5000000,
      currency: 'COP',
      reference,
      payment_method_type: 'CARD',
    });
    const res = await request(app).post('/api/v1/payments/wompi/events').send(event);

    expect(res.status).toBe(200);
    const updated = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe(PaymentStatus.approved);
    const balance = await prisma.creditBalance.findUniqueOrThrow({
      where: { companyId: COMPANY_ID },
    });
    expect(balance.extraCredits).toBe(20);
    const purchase = await prisma.creditPurchase.findFirst({
      where: { paymentId: payment.id },
    });
    expect(purchase?.credits).toBe(20);
  });

  it('applies a credit purchase once when the same event is delivered twice', async () => {
    const start = await request(app)
      .post('/api/v1/company/billing/credits/purchase')
      .set(authHeader(adminToken))
      .send({ packageId });
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: start.body.paymentId },
    });

    const event = signedEvent({
      id: `tx-${randomUUID()}`,
      status: 'APPROVED',
      amount_in_cents: 5000000,
      currency: 'COP',
      reference: buildPaymentReference(payment.id, 'credit_package', packageId),
      payment_method_type: 'CARD',
    });

    await Promise.all([
      request(app).post('/api/v1/payments/wompi/events').send(event),
      request(app).post('/api/v1/payments/wompi/events').send(event),
    ]);

    const balance = await prisma.creditBalance.findUniqueOrThrow({
      where: { companyId: COMPANY_ID },
    });
    expect(balance.extraCredits).toBe(20);
    expect(
      await prisma.creditPurchase.count({ where: { paymentId: payment.id } })
    ).toBe(1);
  });

  it('ignores a signed event whose reference was tampered with', async () => {
    const start = await request(app)
      .post('/api/v1/company/billing/credits/purchase')
      .set(authHeader(adminToken))
      .send({ packageId });
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: start.body.paymentId },
    });

    const event = signedEvent({
      id: `tx-${randomUUID()}`,
      status: 'APPROVED',
      amount_in_cents: 5000000,
      currency: 'COP',
      reference: `${payment.id}|credit_package|${packageId}`,
    });
    const res = await request(app).post('/api/v1/payments/wompi/events').send(event);

    expect(res.status).toBe(200);
    const updated = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe(PaymentStatus.pending);
    const purchase = await prisma.creditPurchase.findFirst({
      where: { paymentId: payment.id },
    });
    expect(purchase).toBeNull();
  });

  it('rejects a Wompi event with currency other than COP', async () => {
    const start = await request(app)
      .post('/api/v1/company/billing/credits/purchase')
      .set(authHeader(adminToken))
      .send({ packageId });
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: start.body.paymentId },
    });

    const event = signedEvent({
      id: `tx-${randomUUID()}`,
      status: 'APPROVED',
      amount_in_cents: 5000000,
      currency: 'USD',
      reference: buildPaymentReference(payment.id, 'credit_package', packageId),
    });
    const res = await request(app).post('/api/v1/payments/wompi/events').send(event);

    expect(res.status).toBe(400);
    const updated = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe(PaymentStatus.pending);
  });

  it('rejects a Wompi event with an invalid checksum', async () => {
    const start = await request(app)
      .post('/api/v1/company/billing/credits/purchase')
      .set(authHeader(adminToken))
      .send({ packageId });
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: start.body.paymentId },
    });

    const event = signedEvent({
      id: `tx-${randomUUID()}`,
      status: 'APPROVED',
      amount_in_cents: 5000000,
      currency: 'COP',
      reference: buildPaymentReference(payment.id, 'credit_package', packageId),
    });
    event.signature.checksum = '0'.repeat(64);

    const res = await request(app).post('/api/v1/payments/wompi/events').send(event);

    expect(res.status).toBe(403);
    const updated = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe(PaymentStatus.pending);
  });

  it('activates an annual subscription from a signed Wompi event and resets credits', async () => {
    const start = await request(app)
      .post('/api/v1/company/billing/subscription')
      .set(authHeader(adminToken))
      .send({ planId, billingCycle: 'annual' });
    expect(start.status).toBe(201);

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: start.body.paymentId },
    });
    const reference = buildPaymentReference(payment.id, 'subscription', planId, 'annual');
    const event = signedEvent({
      id: `tx-${randomUUID()}`,
      status: 'APPROVED',
      amount_in_cents: 100000000,
      currency: 'COP',
      reference,
      payment_method_type: 'CARD',
    });
    const res = await request(app).post('/api/v1/payments/wompi/events').send(event);

    expect(res.status).toBe(200);
    const subscription = await prisma.subscription.findFirstOrThrow({
      where: { companyId: COMPANY_ID, status: SubscriptionStatus.active },
    });
    expect(subscription.billingCycle).toBe(BillingCycle.annual);
    expect(subscription.paymentId).toBe(payment.id);
    const balance = await prisma.creditBalance.findUniqueOrThrow({
      where: { companyId: COMPANY_ID },
    });
    expect(balance.planCredits).toBe(10);
  });

  it('resets monthly plan credits when the renewal is approved on the anniversary', async () => {
    await prisma.creditBalance.update({
      where: { companyId: COMPANY_ID },
      data: { planCredits: 0 },
    });

    const start = await request(app)
      .post('/api/v1/company/billing/subscription')
      .set(authHeader(adminToken))
      .send({ planId, billingCycle: 'monthly' });
    expect(start.status).toBe(201);

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: start.body.paymentId },
    });
    const event = signedEvent({
      id: `tx-${randomUUID()}`,
      status: 'APPROVED',
      amount_in_cents: 10000000,
      currency: 'COP',
      reference: buildPaymentReference(payment.id, 'subscription', planId, 'monthly'),
      payment_method_type: 'CARD',
    });
    const res = await request(app).post('/api/v1/payments/wompi/events').send(event);

    expect(res.status).toBe(200);
    const subscription = await prisma.subscription.findFirstOrThrow({
      where: { companyId: COMPANY_ID, status: SubscriptionStatus.active },
    });
    const current = parseBusinessDate(todayInBogota());
    expect(subscription.billingCycle).toBe(BillingCycle.monthly);
    expect(subscription.startDate.toISOString()).toBe(current.toISOString());
    expect(subscription.renewalDate?.toISOString()).toBe(
      addMonths(current, 1).toISOString()
    );
    const balance = await prisma.creditBalance.findUniqueOrThrow({
      where: { companyId: COMPANY_ID },
    });
    expect(balance.planCredits).toBe(10);
  });

  it('expires the active subscription when a subscription payment is rejected', async () => {
    const start = await request(app)
      .post('/api/v1/company/billing/subscription')
      .set(authHeader(adminToken))
      .send({ planId, billingCycle: 'monthly' });
    expect(start.status).toBe(201);

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: start.body.paymentId },
    });
    const event = signedEvent({
      id: `tx-${randomUUID()}`,
      status: 'DECLINED',
      amount_in_cents: 10000000,
      currency: 'COP',
      reference: buildPaymentReference(payment.id, 'subscription', planId, 'monthly'),
      payment_method_type: 'CARD',
    });
    const res = await request(app).post('/api/v1/payments/wompi/events').send(event);

    expect(res.status).toBe(200);
    const updated = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe(PaymentStatus.rejected);
    const subscription = await prisma.subscription.findFirstOrThrow({
      where: { companyId: COMPANY_ID },
    });
    expect(subscription.status).toBe(SubscriptionStatus.expired);
  });

  it('registers a card and activates pay per use', async () => {
    const payPerUsePlan = await activatePayPerUse();

    const res = await request(app)
      .post('/api/v1/company/billing/pay-per-use/card')
      .set(authHeader(adminToken))
      .send({ token: 'tok_test' });

    expect(res.status).toBe(201);
    expect(createCardPaymentSource).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'tok_test' })
    );
    const company = await prisma.company.findUniqueOrThrow({ where: { id: COMPANY_ID } });
    expect(company.cardReference).toBe('98765');
    const subscription = await prisma.subscription.findFirstOrThrow({
      where: { companyId: COMPANY_ID, status: SubscriptionStatus.active },
    });
    expect(subscription.planId).toBe(payPerUsePlan.id);
  });

  it('activates a purchased module after a signed Wompi event', async () => {
    await activatePayPerUse();

    const start = await request(app)
      .post('/api/v1/company/billing/modules/purchase')
      .set(authHeader(adminToken))
      .send({ moduleId });
    expect(start.status).toBe(201);
    expect(start.body.amount).toBe(25000);

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: start.body.paymentId },
    });
    const event = signedEvent({
      id: `tx-${randomUUID()}`,
      status: 'APPROVED',
      amount_in_cents: 2500000,
      currency: 'COP',
      reference: buildPaymentReference(payment.id, 'module', moduleId),
      payment_method_type: 'CARD',
    });
    const res = await request(app).post('/api/v1/payments/wompi/events').send(event);

    expect(res.status).toBe(200);
    const companyModule = await prisma.companyModule.findFirst({
      where: { companyId: COMPANY_ID, moduleId },
    });
    expect(companyModule?.paymentId).toBe(payment.id);
  });

  it('accumulates pay per use consumption and charges at the threshold', async () => {
    await activatePayPerUse();
    for (const index of [1, 2]) {
      const id = randomUUID();
      if (index === 1) driverId = id;
      await prisma.user.create({
        data: {
          id,
          companyId: COMPANY_ID,
          role: UserRole.driver,
          fullName: `Extra Driver ${index}`,
          email: `billing-driver-${index}-${randomUUID()}@test.com`,
          passwordHash: await hashPassword(PASSWORD),
          isActive: true,
          driver: { create: { status: 'available' } },
        },
      });
    }

    const route = await prisma.route.create({
      data: {
        companyId: COMPANY_ID,
        driverId,
        routeDate: new Date('2026-11-05T00:00:00.000Z'),
        status: 'created',
      },
    });
    await prisma.routeOptimization.create({
      data: {
        routeId: route.id,
        totalDistanceM: 1000,
        estimatedDurationS: 100,
        processingTimeMs: 10,
        isSuccessful: true,
      },
    });

    const { applyOptimizationBilling } = await import('../billing.service.js');
    const optimization = await prisma.routeOptimization.findFirstOrThrow({
      where: { routeId: route.id },
    });

    let usageChargeId = '';
    await prisma.$transaction(async (tx) => {
      const billing = await applyOptimizationBilling(tx, COMPANY_ID, optimization.id);
      expect(billing).toMatchObject({ mode: 'pay_per_use', amount: 4000 });
      if (billing.mode === 'pay_per_use') usageChargeId = billing.usageChargeId;
    });

    await prisma.$transaction(async (tx) => {
      const billing = await applyOptimizationBilling(tx, COMPANY_ID, optimization.id);
      expect(billing).toMatchObject({ amount: 6000 });
    });

    const { processUsageCharge } = await import('../billing.service.js');
    await processUsageCharge(COMPANY_ID, usageChargeId);

    expect(chargePaymentSource).toHaveBeenCalledTimes(1);
    const charge = await prisma.usageCharge.findUniqueOrThrow({
      where: { id: usageChargeId },
    });
    expect(Number(charge.amount)).toBe(6000);
  });

  it('serializes concurrent optimizations for the same company', async () => {
    await activatePayPerUse();
    const driver = await prisma.user.create({
      data: {
        companyId: COMPANY_ID,
        role: UserRole.driver,
        fullName: 'Concurrent Driver',
        email: `billing-concurrent-${randomUUID()}@test.com`,
        passwordHash: await hashPassword(PASSWORD),
        isActive: true,
        driver: { create: { status: 'available' } },
      },
    });
    const route = await prisma.route.create({
      data: {
        companyId: COMPANY_ID,
        driverId: driver.id,
        routeDate: new Date('2026-11-05T00:00:00.000Z'),
        status: 'created',
      },
    });
    const optimizations = await Promise.all(
      [1, 2].map(() =>
        prisma.routeOptimization.create({
          data: {
            routeId: route.id,
            totalDistanceM: 1000,
            estimatedDurationS: 100,
            processingTimeMs: 10,
            isSuccessful: true,
          },
        })
      )
    );

    const { applyOptimizationBilling } = await import('../billing.service.js');
    await Promise.all(
      optimizations.map((optimization) =>
        prisma.$transaction((tx) =>
          applyOptimizationBilling(tx, COMPANY_ID, optimization.id)
        )
      )
    );

    const charges = await prisma.usageCharge.findMany({
      where: { companyId: COMPANY_ID },
    });
    expect(charges).toHaveLength(1);
    expect(charges[0].optimizationCount).toBe(2);
    expect(Number(charges[0].amount)).toBe(
      charges[0].optimizationCount * 2000 + charges[0].additionalDrivers * 2000
    );
  });

  it('charges an open usage period only once under concurrency', async () => {
    await activatePayPerUse();
    const charge = await prisma.usageCharge.create({
      data: {
        companyId: COMPANY_ID,
        periodStartDate: new Date('2026-10-01T00:00:00.000Z'),
        optimizationCount: 2,
        amount: 4000,
      },
    });

    chargePaymentSource.mockImplementation(
      async (params: { reference: string; amountInCents: number }) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          id: `tx-${randomUUID()}`,
          status: 'APPROVED',
          amount_in_cents: params.amountInCents,
          currency: 'COP',
          reference: params.reference,
          payment_method_type: 'CARD',
        };
      }
    );

    const { processUsageCharge } = await import('../billing.service.js');
    await Promise.all([
      processUsageCharge(COMPANY_ID, charge.id),
      processUsageCharge(COMPANY_ID, charge.id),
    ]);

    expect(chargePaymentSource).toHaveBeenCalledTimes(1);
    expect(await prisma.payment.count({ where: { companyId: COMPANY_ID } })).toBe(1);
  });

  it('uses credits only for subscription plans, never per optimization or driver', async () => {
    await prisma.plan.update({
      where: { id: planId },
      data: {
        includedDrivers: 1,
        pricePerOptimization: 9999,
        pricePerAdditionalDriver: 9999,
        earlyChargeThreshold: 1000,
      },
    });

    try {
      const driver = await prisma.user.create({
        data: {
          companyId: COMPANY_ID,
          role: UserRole.driver,
          fullName: 'Subscription Driver',
          email: `billing-subscription-driver-${randomUUID()}@test.com`,
          passwordHash: await hashPassword(PASSWORD),
          isActive: true,
          driver: { create: { status: 'available' } },
        },
      });
      const route = await prisma.route.create({
        data: {
          companyId: COMPANY_ID,
          driverId: driver.id,
          routeDate: new Date('2026-11-05T00:00:00.000Z'),
          status: 'created',
        },
      });
      const optimization = await prisma.routeOptimization.create({
        data: {
          routeId: route.id,
          totalDistanceM: 1000,
          estimatedDurationS: 100,
          processingTimeMs: 10,
          isSuccessful: true,
        },
      });

      const { applyOptimizationBilling } = await import('../billing.service.js');
      let billing: Awaited<ReturnType<typeof applyOptimizationBilling>> | undefined;
      await prisma.$transaction(async (tx) => {
        billing = await applyOptimizationBilling(tx, COMPANY_ID, optimization.id);
      });

      expect(billing).toMatchObject({ mode: 'credits', remainingCredits: 9 });
      expect(
        await prisma.usageCharge.count({ where: { companyId: COMPANY_ID } })
      ).toBe(0);
      expect(await prisma.payment.count({ where: { companyId: COMPANY_ID } })).toBe(0);
    } finally {
      await prisma.plan.update({
        where: { id: planId },
        data: {
          includedDrivers: null,
          pricePerOptimization: null,
          pricePerAdditionalDriver: null,
          earlyChargeThreshold: null,
        },
      });
    }
  });

  it('blocks optimizations when credits are exhausted', async () => {
    await prisma.creditBalance.update({
      where: { companyId: COMPANY_ID },
      data: { planCredits: 0, extraCredits: 0 },
    });

    const { assertOptimizationAllowed } = await import('../billing.service.js');
    await expect(assertOptimizationAllowed(COMPANY_ID)).rejects.toMatchObject({
      code: 'NO_CREDITS',
    });
  });

  it('blocks pay per use when the spending limit is reached', async () => {
    await activatePayPerUse();
    await prisma.company.update({
      where: { id: COMPANY_ID },
      data: { monthlySpendingLimit: 1500 },
    });
    await prisma.usageCharge.create({
      data: {
        companyId: COMPANY_ID,
        periodStartDate: new Date('2026-11-01T00:00:00.000Z'),
        amount: 1500,
        status: 'charged',
      },
    });

    const { assertOptimizationAllowed } = await import('../billing.service.js');
    await expect(assertOptimizationAllowed(COMPANY_ID)).rejects.toMatchObject({
      code: 'SPENDING_LIMIT_REACHED',
    });
  });
});

describe('Billing jobs', () => {
  it('expires a trial and does not notify twice', async () => {
    const trialPlan = await prisma.plan.create({
      data: {
        name: `Billing Test Trial ${randomUUID().slice(0, 8)}`,
        modality: 'subscription',
        monthlyPrice: 0,
        annualPrice: 0,
        monthlyCredits: 0,
        trialDays: 7,
        isActive: true,
      },
    });
    const current = parseBusinessDate(todayInBogota());
    await prisma.subscription.updateMany({
      where: { companyId: COMPANY_ID },
      data: {
        planId: trialPlan.id,
        startDate: addDays(current, -8),
        renewalDate: addDays(current, -1),
      },
    });

    const { runBillingJobs } = await import('../billing-jobs.js');
    const first = await runBillingJobs({ companyIds: [COMPANY_ID] });
    expect(first).toMatchObject({
      skipped: false,
      companiesProcessed: 1,
      errors: [],
    });

    const subscription = await prisma.subscription.findFirstOrThrow({
      where: { companyId: COMPANY_ID },
    });
    expect(subscription.status).toBe(SubscriptionStatus.expired);
    expect(
      await prisma.notification.count({
        where: { companyId: COMPANY_ID, type: 'subscription_expired' },
      })
    ).toBe(1);

    await runBillingJobs({ companyIds: [COMPANY_ID] });
    expect(
      await prisma.notification.count({
        where: { companyId: COMPANY_ID, type: 'subscription_expired' },
      })
    ).toBe(1);
  });

  it('closes a previous usage period and sets its end date', async () => {
    await activatePayPerUse();
    const current = parseBusinessDate(todayInBogota());
    const periodStartDate = startOfMonth(addMonths(current, -1));
    const expectedEndDate = addDays(addMonths(periodStartDate, 1), -1);
    const charge = await prisma.usageCharge.create({
      data: {
        companyId: COMPANY_ID,
        periodStartDate,
        optimizationCount: 2,
        amount: 4000,
      },
    });

    const { runBillingJobs } = await import('../billing-jobs.js');
    const result = await runBillingJobs({ companyIds: [COMPANY_ID] });
    expect(result.errors).toEqual([]);

    const updated = await prisma.usageCharge.findUniqueOrThrow({
      where: { id: charge.id },
    });
    expect(updated.status).toBe(UsageChargeStatus.charged);
    expect(updated.periodEndDate?.toISOString()).toBe(expectedEndDate.toISOString());
    expect(
      await prisma.payment.count({
        where: { companyId: COMPANY_ID, purpose: PaymentPurpose.usage },
      })
    ).toBe(1);
  });

  it('resets annual plan credits on the monthly anniversary', async () => {
    const current = parseBusinessDate(todayInBogota());
    await prisma.subscription.updateMany({
      where: { companyId: COMPANY_ID },
      data: {
        billingCycle: BillingCycle.annual,
        startDate: addMonths(current, -1),
        renewalDate: addMonths(current, 11),
      },
    });
    await prisma.creditBalance.update({
      where: { companyId: COMPANY_ID },
      data: { planCredits: 0 },
    });

    const { runBillingJobs } = await import('../billing-jobs.js');
    const result = await runBillingJobs({ companyIds: [COMPANY_ID] });
    expect(result.errors).toEqual([]);

    const balance = await prisma.creditBalance.findUniqueOrThrow({
      where: { companyId: COMPANY_ID },
    });
    expect(balance.planCredits).toBe(10);
    expect(
      await prisma.notification.count({
        where: { companyId: COMPANY_ID, type: 'credits_reset' },
      })
    ).toBe(1);
  });

  it('records the last run date so a restart does not repeat it', async () => {
    await prisma.systemSetting.deleteMany({
      where: { key: 'billing_jobs_last_run' },
    });

    const { runBillingJobsAndRecord } = await import('../billing-jobs.js');
    const result = await runBillingJobsAndRecord({ companyIds: [COMPANY_ID] });
    expect(result.errors).toEqual([]);

    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'billing_jobs_last_run' },
    });
    expect(setting?.value).toEqual({ date: todayInBogota() });
  });

  it('keeps pay per use active after its billing date', async () => {
    await activatePayPerUse();
    const current = parseBusinessDate(todayInBogota());
    await prisma.subscription.updateMany({
      where: { companyId: COMPANY_ID },
      data: {
        startDate: addMonths(current, -2),
        renewalDate: addDays(current, -1),
      },
    });

    const { runBillingJobs } = await import('../billing-jobs.js');
    const result = await runBillingJobs({ companyIds: [COMPANY_ID] });
    expect(result.errors).toEqual([]);

    const subscription = await prisma.subscription.findFirstOrThrow({
      where: { companyId: COMPANY_ID },
    });
    expect(subscription.status).toBe(SubscriptionStatus.active);
  });
});
