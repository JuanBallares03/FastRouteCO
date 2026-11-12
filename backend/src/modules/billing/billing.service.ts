import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import {
  BillingCycle,
  CreditTransactionType,
  PaymentPurpose,
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
  UsageChargeStatus,
  UserRole,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../env.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../lib/errors.js';
import {
  addDays,
  addMonths,
  daysBetween,
  parseBusinessDate,
  startOfMonth,
  todayInBogota,
} from '../../lib/dates.js';
import {
  buildCheckoutUrl,
  chargePaymentSource,
  createCardPaymentSource,
  verifyWompiEvent,
  type WompiTransaction,
} from '../../lib/wompi.js';

const LOW_CREDIT_RATIO = 0.2;
const SPENDING_WARNING_RATIO = 0.8;

const subscriptionInclude = {
  plan: {
    include: {
      planModules: { include: { module: true } },
    },
  },
} satisfies Prisma.SubscriptionInclude;

type SubscriptionWithPlan = Prisma.SubscriptionGetPayload<{
  include: typeof subscriptionInclude;
}>;

type BillingClient = Prisma.TransactionClient;

async function lockCompanyBilling(tx: BillingClient, companyId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${companyId}))`;
}

export interface PlanView {
  id: string;
  name: string;
  modality: string;
  maxDrivers: number | null;
  maxBranches: number | null;
  supportType: string | null;
  trialDays: number | null;
  monthlyCredits: number | null;
  monthlyPrice: number | null;
  annualPrice: number | null;
  includedDrivers: number | null;
  pricePerOptimization: number | null;
  pricePerAdditionalDriver: number | null;
  earlyChargeThreshold: number | null;
  isActive: boolean;
}

function today(): Date {
  return parseBusinessDate(todayInBogota());
}

function isTrialPlan(plan: { trialDays: number | null }): boolean {
  return (plan.trialDays ?? 0) > 0;
}

function numberOrNull(value: Prisma.Decimal | number | null): number | null {
  return value === null ? null : Number(value);
}

function serializePlan(plan: {
  id: string;
  name: string;
  modality: string;
  maxDrivers: number | null;
  maxBranches: number | null;
  supportType: string | null;
  trialDays: number | null;
  monthlyCredits: number | null;
  monthlyPrice: Prisma.Decimal | null;
  annualPrice: Prisma.Decimal | null;
  includedDrivers: number | null;
  pricePerOptimization: Prisma.Decimal | null;
  pricePerAdditionalDriver: Prisma.Decimal | null;
  earlyChargeThreshold: Prisma.Decimal | null;
  isActive: boolean;
}): PlanView {
  return {
    id: plan.id,
    name: plan.name,
    modality: plan.modality,
    maxDrivers: plan.maxDrivers,
    maxBranches: plan.maxBranches,
    supportType: plan.supportType,
    trialDays: plan.trialDays,
    monthlyCredits: plan.monthlyCredits,
    monthlyPrice: numberOrNull(plan.monthlyPrice),
    annualPrice: numberOrNull(plan.annualPrice),
    includedDrivers: plan.includedDrivers,
    pricePerOptimization: numberOrNull(plan.pricePerOptimization),
    pricePerAdditionalDriver: numberOrNull(plan.pricePerAdditionalDriver),
    earlyChargeThreshold: numberOrNull(plan.earlyChargeThreshold),
    isActive: plan.isActive,
  };
}

function subscriptionView(subscription: SubscriptionWithPlan) {
  return {
    id: subscription.id,
    status: subscription.status,
    billingCycle: subscription.billingCycle,
    paymentId: subscription.paymentId,
    startDate: subscription.startDate,
    renewalDate: subscription.renewalDate,
    endDate: subscription.endDate,
    plan: {
      ...serializePlan(subscription.plan),
      modules: subscription.plan.planModules.map((entry) => entry.module),
    },
  };
}

async function findActiveSubscription(companyId: string, client: BillingClient = prisma) {
  return client.subscription.findFirst({
    where: { companyId, status: SubscriptionStatus.active },
    include: subscriptionInclude,
  });
}

async function createAdminNotifications(
  client: BillingClient | typeof prisma,
  companyId: string,
  type: string,
  message: string
) {
  const admins = await client.user.findMany({
    where: { companyId, role: UserRole.company_admin, isActive: true },
    select: { id: true },
  });
  if (admins.length === 0) return;

  await client.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      companyId,
      type,
      message,
    })),
  });
}

async function notifyOnceToday(
  client: BillingClient | typeof prisma,
  companyId: string,
  type: string,
  message: string
) {
  const start = today();
  const existing = await client.notification.findFirst({
    where: { companyId, type, createdAt: { gte: start } },
  });
  if (!existing) {
    await createAdminNotifications(client, companyId, type, message);
  }
}

async function resetAnnualPlanCredits(
  subscription: SubscriptionWithPlan,
  client: BillingClient
) {
  if (
    subscription.plan.modality !== 'subscription' ||
    isTrialPlan(subscription.plan) ||
    subscription.billingCycle !== BillingCycle.annual
  ) {
    return;
  }

  const lastRenewal = await client.creditTransaction.findFirst({
    where: { companyId: subscription.companyId, type: CreditTransactionType.renewal },
    orderBy: { transactionDate: 'desc' },
  });
  const lastDate = lastRenewal?.transactionDate ?? subscription.startDate;
  if (addMonths(lastDate, 1) > today()) return;

  const monthlyCredits = subscription.plan.monthlyCredits ?? 0;
  const balance = await ensureCreditBalance(subscription.companyId, client);
  const extraCredits = balance.extraCredits;
  await client.creditBalance.update({
    where: { companyId: subscription.companyId },
    data: { planCredits: monthlyCredits },
  });
  await client.creditTransaction.create({
    data: {
      companyId: subscription.companyId,
      type: CreditTransactionType.renewal,
      quantity: monthlyCredits,
      resultingBalance: monthlyCredits + extraCredits,
    },
  });
  await notifyOnceToday(
    client,
    subscription.companyId,
    'credits_reset',
    `Se renovaron ${monthlyCredits} créditos del plan ${subscription.plan.name}.`
  );
}

async function ensureCreditBalance(companyId: string, client: BillingClient = prisma) {
  const existing = await client.creditBalance.findUnique({ where: { companyId } });
  if (existing) return existing;
  return client.creditBalance.create({ data: { companyId } });
}

export async function syncCompanySubscription(companyId: string) {
  const subscription = await findActiveSubscription(companyId);
  if (!subscription) return null;

  const currentDate = today();
  const isPayPerUse = subscription.plan.modality === 'pay_per_use';
  if (!isPayPerUse && subscription.renewalDate && subscription.renewalDate < currentDate) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.expired,
        endDate: subscription.renewalDate,
      },
    });
    await createAdminNotifications(
      prisma,
      companyId,
      'subscription_expired',
      `La suscripción al plan ${subscription.plan.name} venció. Renueva para seguir optimizando rutas.`
    );
    return null;
  }

  if (isTrialPlan(subscription.plan) && subscription.renewalDate) {
    const remaining = daysBetween(currentDate, subscription.renewalDate);
    if (remaining === 2) {
      await notifyOnceToday(
        prisma,
        companyId,
        'trial_ending',
        `Tu prueba gratuita termina en ${remaining} día(s). Elige un plan o pago por uso para continuar.`
      );
    }
  } else if (!isPayPerUse && subscription.renewalDate) {
    const remaining = daysBetween(currentDate, subscription.renewalDate);
    if (remaining <= 3 && remaining >= 0) {
      await notifyOnceToday(
        prisma,
        companyId,
        'renewal_notice',
        `Tu plan ${subscription.plan.name} se renueva el ${subscription.renewalDate
          .toISOString()
          .slice(0, 10)}.`
      );
    }
  }

  await resetAnnualPlanCredits(subscription, prisma);
  return findActiveSubscription(companyId);
}

async function currentMonthUsageCharges(
  companyId: string,
  client: BillingClient | typeof prisma = prisma
) {
  return client.usageCharge.findMany({
    where: {
      companyId,
      periodStartDate: startOfMonth(today()),
      status: { in: [UsageChargeStatus.open, UsageChargeStatus.charged] },
    },
    orderBy: { periodStartDate: 'desc' },
  });
}

function sumUsageAmount(charges: Array<{ amount: Prisma.Decimal }>): number {
  return charges.reduce((total, charge) => total + Number(charge.amount), 0);
}

export async function assertOptimizationAllowed(companyId: string) {
  const subscription = await syncCompanySubscription(companyId);
  if (!subscription) {
    throw new ForbiddenError(
      'La suscripción o el periodo de prueba no está activo.',
      'SUBSCRIPTION_INACTIVE'
    );
  }

  if (subscription.plan.modality === 'pay_per_use') {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company?.cardReference) {
      throw new ForbiddenError(
        'Registra una tarjeta para usar la modalidad de pago por uso.',
        'PAYMENT_METHOD_REQUIRED'
      );
    }
    const usageCharges = await currentMonthUsageCharges(companyId);
    const limit = company.monthlySpendingLimit;
    if (limit !== null && (limit.lte(0) || sumUsageAmount(usageCharges) >= Number(limit))) {
      throw new ForbiddenError(
        'Alcanzaste el límite mensual de gasto. Aumenta el límite o espera al próximo mes.',
        'SPENDING_LIMIT_REACHED'
      );
    }
  } else {
    const balance = await ensureCreditBalance(companyId);
    if (balance.planCredits + balance.extraCredits <= 0) {
      throw new ForbiddenError(
        'No tienes créditos disponibles. Compra un paquete para continuar.',
        'NO_CREDITS'
      );
    }
  }

  return subscription;
}

export async function applyOptimizationBilling(
  tx: BillingClient,
  companyId: string,
  optimizationId: string
) {
  await lockCompanyBilling(tx, companyId);
  const subscription = await findActiveSubscription(companyId, tx);
  if (!subscription) {
    throw new ForbiddenError(
      'La suscripción o el periodo de prueba no está activo.',
      'SUBSCRIPTION_INACTIVE'
    );
  }

  if (subscription.plan.modality === 'pay_per_use') {
    let charge = await tx.usageCharge.findFirst({
      where: {
        companyId,
        periodStartDate: startOfMonth(today()),
        status: UsageChargeStatus.open,
      },
    });
    if (!charge) {
      charge = await tx.usageCharge.create({
        data: {
          companyId,
          periodStartDate: startOfMonth(today()),
          amount: 0,
        },
      });
    }

    const driversCount = await tx.user.count({
      where: { companyId, role: UserRole.driver, isActive: true },
    });
    const additionalDrivers = Math.max(
      0,
      driversCount - (subscription.plan.includedDrivers ?? 0)
    );
    const optimizationCount = charge.optimizationCount + 1;
    const amount =
      optimizationCount * Number(subscription.plan.pricePerOptimization ?? 0) +
      additionalDrivers * Number(subscription.plan.pricePerAdditionalDriver ?? 0);

    await tx.usageCharge.update({
      where: { id: charge.id },
      data: { optimizationCount, additionalDrivers, amount },
    });
    await tx.routeOptimization.update({
      where: { id: optimizationId },
      data: { usageChargeId: charge.id },
    });

    return {
      mode: 'pay_per_use' as const,
      usageChargeId: charge.id,
      amount,
      earlyChargeThreshold: numberOrNull(subscription.plan.earlyChargeThreshold),
      spendingLimit: null as number | null,
    };
  }

  const balance = await ensureCreditBalance(companyId, tx);
  const previousTotal = balance.planCredits + balance.extraCredits;
  if (previousTotal <= 0) {
    throw new ForbiddenError('No tienes créditos disponibles.', 'NO_CREDITS');
  }

  const usePlanCredits = balance.planCredits > 0;
  const resultingBalance = previousTotal - 1;
  await tx.creditBalance.update({
    where: { companyId },
    data: usePlanCredits
      ? { planCredits: balance.planCredits - 1 }
      : { extraCredits: balance.extraCredits - 1 },
  });
  await tx.creditTransaction.create({
    data: {
      companyId,
      type: CreditTransactionType.consumption,
      quantity: -1,
      resultingBalance,
      optimizationId,
    },
  });

  const threshold = Math.ceil((subscription.plan.monthlyCredits ?? 0) * LOW_CREDIT_RATIO);
  if (previousTotal > threshold && resultingBalance <= threshold) {
    await createAdminNotifications(
      tx,
      companyId,
      'low_credits',
      `Te quedan ${resultingBalance} créditos. Compra un paquete adicional para no interrumpir las optimizaciones.`
    );
  }

  return {
    mode: 'credits' as const,
    remainingCredits: resultingBalance,
  };
}

class UsageChargeAlreadyClaimedError extends Error {}

export async function processUsageCharge(companyId: string, usageChargeId: string) {
  const charge = await prisma.usageCharge.findFirst({
    where: { id: usageChargeId, companyId, status: UsageChargeStatus.open },
  });
  if (!charge || charge.paymentId) return null;

  const subscription = await findActiveSubscription(companyId);
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!subscription || subscription.plan.modality !== 'pay_per_use') return null;
  if (!company?.cardReference) return null;
  if (Number(charge.amount) <= 0) return null;

  const paymentId = randomUUID();
  const reference = buildPaymentReference(paymentId, 'usage', charge.id);
  const amount = Number(charge.amount);

  try {
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          id: paymentId,
          companyId,
          purpose: PaymentPurpose.usage,
          amount,
          status: PaymentStatus.pending,
        },
      });
      const claimed = await tx.usageCharge.updateMany({
        where: {
          id: charge.id,
          companyId,
          status: UsageChargeStatus.open,
          paymentId: null,
        },
        data: { paymentId: payment.id },
      });
      if (claimed.count === 0) {
        throw new UsageChargeAlreadyClaimedError();
      }
    });
  } catch (error) {
    if (error instanceof UsageChargeAlreadyClaimedError) return null;
    throw error;
  }

  let transaction: WompiTransaction;
  try {
    transaction = await chargePaymentSource({
      amountInCents: Math.round(amount * 100),
      customerEmail: company.email,
      reference,
      paymentSourceId: Number(company.cardReference),
    });
  } catch (error) {
    await prisma.$transaction([
      prisma.usageCharge.update({
        where: { id: charge.id },
        data: { paymentId: null },
      }),
      prisma.payment.delete({ where: { id: paymentId } }),
    ]);
    throw error;
  }

  await handleTransactionStatus(paymentId, transaction);
  return transaction;
}

export async function processClosingUsageCharges(companyId: string) {
  const openCharges = await prisma.usageCharge.findMany({
    where: {
      companyId,
      status: UsageChargeStatus.open,
      periodStartDate: { lt: startOfMonth(today()) },
    },
  });
  for (const charge of openCharges) {
    const periodEndDate = addDays(addMonths(charge.periodStartDate, 1), -1);
    if (Number(charge.amount) <= 0) {
      await prisma.usageCharge.update({
        where: { id: charge.id },
        data: { status: UsageChargeStatus.charged, periodEndDate },
      });
      continue;
    }
    await prisma.usageCharge.update({
      where: { id: charge.id },
      data: { periodEndDate },
    });
    try {
      await processUsageCharge(companyId, charge.id);
    } catch (error) {
      console.error('[billing] No se pudo cobrar el consumo pendiente:', error);
    }
  }
}

export async function getBillingOverview(companyId: string) {
  const subscription = await syncCompanySubscription(companyId);
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      creditBalance: true,
      modules: {
        where: { OR: [{ endDate: null }, { endDate: { gte: today() } }] },
        include: { module: true },
        orderBy: { startDate: 'desc' },
      },
    },
  });
  if (!company) throw new NotFoundError('Empresa no encontrada', 'COMPANY_NOT_FOUND');

  const periodCharges = await currentMonthUsageCharges(companyId);
  const openCharge = periodCharges.find(
    (charge) => charge.status === UsageChargeStatus.open
  );
  const usage = periodCharges[0];
  const balance = company.creditBalance ?? { planCredits: 0, extraCredits: 0 };

  let nextCreditResetDate: Date | null = null;
  if (subscription && subscription.plan.modality === 'subscription' && !isTrialPlan(subscription.plan)) {
    if (subscription.billingCycle === BillingCycle.annual) {
      const lastRenewal = await prisma.creditTransaction.findFirst({
        where: { companyId, type: CreditTransactionType.renewal },
        orderBy: { transactionDate: 'desc' },
      });
      nextCreditResetDate = addMonths(
        lastRenewal?.transactionDate ?? subscription.startDate,
        1
      );
    } else {
      nextCreditResetDate = subscription.renewalDate;
    }
  }

  const includedModules =
    subscription?.plan.planModules.map((entry) => entry.module) ?? [];
  const purchasedModules = company.modules.map((entry) => ({
    ...entry.module,
    price: numberOrNull(entry.module.price),
    purchasedAt: entry.startDate,
    endDate: entry.endDate,
  }));
  const moduleMap = new Map(
    [...includedModules, ...purchasedModules].map((module) => [
      module.id,
      { ...module, price: numberOrNull(module.price) },
    ])
  );

  return {
    companyId,
    cardRegistered: Boolean(company.cardReference),
    spendingLimit:
      company.monthlySpendingLimit === null
        ? null
        : Number(company.monthlySpendingLimit),
    subscription: subscription ? subscriptionView(subscription) : null,
    credits: {
      planCredits: balance.planCredits,
      extraCredits: balance.extraCredits,
      total: balance.planCredits + balance.extraCredits,
      lowThreshold: subscription
        ? Math.ceil((subscription.plan.monthlyCredits ?? 0) * LOW_CREDIT_RATIO)
        : 0,
      nextResetDate: nextCreditResetDate,
    },
    usage: usage
      ? {
          id: openCharge?.id ?? usage.id,
          periodStartDate: usage.periodStartDate,
          periodEndDate: openCharge?.periodEndDate ?? usage.periodEndDate,
          optimizationCount: periodCharges.reduce(
            (total, charge) => total + charge.optimizationCount,
            0
          ),
          additionalDrivers:
            openCharge?.additionalDrivers ?? usage.additionalDrivers,
          amount: sumUsageAmount(periodCharges),
          status: openCharge ? UsageChargeStatus.open : UsageChargeStatus.charged,
          nextChargeDate: addMonths(startOfMonth(today()), 1),
          earlyChargeAmount: subscription
            ? numberOrNull(subscription.plan.earlyChargeThreshold)
            : null,
        }
      : null,
    modules: Array.from(moduleMap.values()),
  };
}

export async function listCreditTransactions(companyId: string, page: number, pageSize: number) {
  const [items, total] = await prisma.$transaction([
    prisma.creditTransaction.findMany({
      where: { companyId },
      include: { purchase: { include: { package: true } }, optimization: true },
      orderBy: { id: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.creditTransaction.count({ where: { companyId } }),
  ]);

  return {
    items: items.map((item) => ({
      ...item,
      purchase: item.purchase
        ? { ...item.purchase, price: Number(item.purchase.price) }
        : null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function listPayments(companyId: string, page: number, pageSize: number) {
  const [items, total] = await prisma.$transaction([
    prisma.payment.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.payment.count({ where: { companyId } }),
  ]);

  return {
    items: items.map((payment) => ({ ...payment, amount: Number(payment.amount) })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function listUsageCharges(companyId: string, page: number, pageSize: number) {
  const [items, total] = await prisma.$transaction([
    prisma.usageCharge.findMany({
      where: { companyId },
      include: { payment: true },
      orderBy: { periodStartDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.usageCharge.count({ where: { companyId } }),
  ]);

  const plans = await prisma.plan.findMany({
    where: {
      isActive: true,
      modality: 'subscription',
      trialDays: { lte: 0 },
      monthlyPrice: { not: null },
    },
    orderBy: { monthlyPrice: 'asc' },
  });

  return {
    items: items.map((charge) => ({
      ...charge,
      amount: Number(charge.amount),
      payment: charge.payment
        ? { ...charge.payment, amount: Number(charge.payment.amount) }
        : null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    plans: plans.map(serializePlan),
  };
}

export async function getUsageSummary(companyId: string) {
  const subscription = await syncCompanySubscription(companyId);
  if (!subscription || subscription.plan.modality !== 'pay_per_use') {
    throw new ForbiddenError(
      'La empresa no usa la modalidad de pago por uso.',
      'NOT_PAY_PER_USE'
    );
  }

  const overview = await getBillingOverview(companyId);
  const currentAmount = overview.usage?.amount ?? 0;
  const plans = await prisma.plan.findMany({
    where: {
      isActive: true,
      modality: 'subscription',
      trialDays: { lte: 0 },
      monthlyPrice: { not: null },
    },
    orderBy: { monthlyPrice: 'asc' },
  });
  const cheaperPlan = plans.find((plan) => Number(plan.monthlyPrice) < currentAmount);

  return {
    ...overview,
    recommendation: {
      subscriptionWouldBeCheaper: Boolean(cheaperPlan),
      plan: cheaperPlan ? serializePlan(cheaperPlan) : null,
    },
  };
}

export async function updateSpendingLimit(companyId: string, limit: number | null) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new NotFoundError('Empresa no encontrada', 'COMPANY_NOT_FOUND');

  const updated = await prisma.company.update({
    where: { id: companyId },
    data: { monthlySpendingLimit: limit === null ? null : new Prisma.Decimal(limit) },
  });

  return {
    spendingLimit:
      updated.monthlySpendingLimit === null
        ? null
        : Number(updated.monthlySpendingLimit),
  };
}

export async function checkSpendingWarning(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company || company.monthlySpendingLimit === null) return;
  const limit = Number(company.monthlySpendingLimit);
  if (limit <= 0) return;
  const spent = sumUsageAmount(await currentMonthUsageCharges(companyId));
  if (spent >= limit * SPENDING_WARNING_RATIO) {
    await notifyOnceToday(
      prisma,
      companyId,
      'spending_limit_warning',
      spent >= limit
        ? `Alcanzaste tu límite mensual de gasto de ${limit.toLocaleString('es-CO')} COP.`
        : `Usaste el 80% de tu límite mensual de gasto de ${limit.toLocaleString('es-CO')} COP.`
    );
  }
}

export async function listOfferings() {
  const [plans, packages, modules] = await Promise.all([
    prisma.plan.findMany({
      where: { isActive: true },
      include: { planModules: { include: { module: true } } },
      orderBy: [{ modality: 'asc' }, { monthlyPrice: 'asc' }],
    }),
    prisma.creditPackage.findMany({
      where: { isActive: true },
      orderBy: { credits: 'asc' },
    }),
    prisma.module.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
  ]);

  return {
    plans: plans.map((plan) => ({
      ...serializePlan(plan),
      modules: plan.planModules.map((entry) => entry.module),
    })),
    creditPackages: packages.map((pkg) => ({ ...pkg, price: Number(pkg.price) })),
    modules: modules.map((module) => ({
      ...module,
      price: numberOrNull(module.price),
    })),
  };
}

async function pendingPayment(companyId: string, purpose: PaymentPurpose, amount: number) {
  const id = randomUUID();
  return prisma.payment.create({
    data: {
      id,
      companyId,
      purpose,
      amount,
      status: PaymentStatus.pending,
    },
  });
}

function referenceSignature(payload: string): string {
  return createHmac('sha256', env.WOMPI_INTEGRITY_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 16);
}

export function buildPaymentReference(
  paymentId: string,
  kind: string,
  ...parts: string[]
): string {
  const payload = [paymentId, kind, ...parts].join('|');
  return `${payload}|${referenceSignature(payload)}`;
}

function checkoutFor(paymentId: string, reference: string, amount: number) {
  return buildCheckoutUrl({
    reference,
    amountInCents: Math.round(amount * 100),
    redirectUrl: `${env.WEB_APP_URL}/company/billing?payment=${paymentId}`,
  });
}

export async function startSubscriptionCheckout(
  companyId: string,
  planId: string,
  billingCycle: BillingCycle
) {
  if (!companyId) throw new ForbiddenError('Sin empresa asociada', 'NO_COMPANY');

  const plan = await prisma.plan.findFirst({ where: { id: planId, isActive: true } });
  if (!plan) throw new NotFoundError('Plan no encontrado', 'PLAN_NOT_FOUND');
  if (isTrialPlan(plan)) {
    throw new BadRequestError('El plan de prueba no requiere pago', 'TRIAL_NOT_PAYABLE');
  }

  const amount =
    billingCycle === BillingCycle.annual
      ? Number(plan.annualPrice ?? 0)
      : Number(plan.monthlyPrice ?? 0);
  if (amount <= 0) {
    throw new BadRequestError('El plan no tiene precio definido', 'PLAN_PRICE_NOT_DEFINED');
  }

  const payment = await pendingPayment(companyId, PaymentPurpose.subscription, amount);
  const reference = buildPaymentReference(
    payment.id,
    'subscription',
    plan.id,
    billingCycle
  );
  return {
    paymentId: payment.id,
    checkoutUrl: checkoutFor(payment.id, reference, amount),
    amount,
  };
}

export async function startCreditPackageCheckout(companyId: string, packageId: string) {
  const subscription = await syncCompanySubscription(companyId);
  if (!subscription) {
    throw new ForbiddenError('La suscripción no está activa', 'SUBSCRIPTION_INACTIVE');
  }
  if (subscription.plan.modality === 'pay_per_use') {
    throw new ConflictError(
      'En pago por uso cada optimización se cobra; no aplican paquetes de créditos.',
      'PAY_PER_USE_NO_CREDITS'
    );
  }
  if (isTrialPlan(subscription.plan)) {
    throw new ConflictError(
      'No puedes comprar créditos durante la prueba gratuita.',
      'TRIAL_CANNOT_BUY_CREDITS'
    );
  }

  const pkg = await prisma.creditPackage.findFirst({
    where: { id: packageId, isActive: true },
  });
  if (!pkg) throw new NotFoundError('Paquete no encontrado', 'PACKAGE_NOT_FOUND');

  const amount = Number(pkg.price);
  const payment = await pendingPayment(companyId, PaymentPurpose.credit_package, amount);
  const reference = buildPaymentReference(payment.id, 'credit_package', pkg.id);
  return {
    paymentId: payment.id,
    checkoutUrl: checkoutFor(payment.id, reference, amount),
    amount,
  };
}

export async function startModuleCheckout(companyId: string, moduleId: string) {
  const subscription = await syncCompanySubscription(companyId);
  if (!subscription) {
    throw new ForbiddenError('La suscripción no está activa', 'SUBSCRIPTION_INACTIVE');
  }

  const module = await prisma.module.findFirst({ where: { id: moduleId, isActive: true } });
  if (!module) throw new NotFoundError('Módulo no encontrado', 'MODULE_NOT_FOUND');

  const included = subscription.plan.planModules.some(
    (entry) => entry.moduleId === moduleId
  );
  if (included) {
    throw new ConflictError('Este módulo ya está incluido en tu plan', 'MODULE_INCLUDED');
  }

  const allowed =
    subscription.plan.modality === 'pay_per_use' ||
    subscription.plan.name.toLowerCase() === 'pro';
  if (!allowed) {
    throw new ForbiddenError(
      'Este módulo solo se puede comprar en el plan Pro o en pago por uso.',
      'MODULE_NOT_AVAILABLE'
    );
  }

  const alreadyActive = await prisma.companyModule.findFirst({
    where: { companyId, moduleId, OR: [{ endDate: null }, { endDate: { gte: today() } }] },
  });
  if (alreadyActive) {
    throw new ConflictError('El módulo ya está activo', 'MODULE_ALREADY_ACTIVE');
  }
  if (module.price === null || Number(module.price) <= 0) {
    throw new BadRequestError('El módulo no tiene precio definido', 'MODULE_PRICE_NOT_DEFINED');
  }

  const amount = Number(module.price);
  const payment = await pendingPayment(companyId, PaymentPurpose.module, amount);
  const reference = buildPaymentReference(payment.id, 'module', module.id);
  return {
    paymentId: payment.id,
    checkoutUrl: checkoutFor(payment.id, reference, amount),
    amount,
  };
}

export function createCardSetupToken(companyId: string): string {
  return jwt.sign({ companyId, purpose: 'wompi_card_setup' }, env.JWT_SECRET, {
    expiresIn: '15m',
  });
}

export function verifyCardSetupToken(token: string): string {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (
      typeof payload !== 'object' ||
      payload.purpose !== 'wompi_card_setup' ||
      typeof payload.companyId !== 'string'
    ) {
      throw new Error('invalid payload');
    }
    return payload.companyId;
  } catch {
    throw new BadRequestError(
      'El enlace para registrar la tarjeta venció. Inténtalo de nuevo.',
      'INVALID_CARD_SETUP_TOKEN'
    );
  }
}

export async function registerCardAndStartPayPerUse(companyId: string, token: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new NotFoundError('Empresa no encontrada', 'COMPANY_NOT_FOUND');

  const plan = await prisma.plan.findFirst({
    where: { modality: 'pay_per_use', isActive: true },
    orderBy: { monthlyPrice: 'asc' },
  });
  if (!plan) {
    throw new NotFoundError('No hay una tarifa de pago por uso activa', 'PLAN_NOT_FOUND');
  }

  const source = await createCardPaymentSource({
    token,
    customerEmail: company.email,
  });
  if (source.status !== 'AVAILABLE') {
    throw new BadRequestError(
      'La tarjeta no quedó disponible para cobros. Intenta con otra tarjeta.',
      'CARD_NOT_AVAILABLE'
    );
  }

  const baseAmount = Number(plan.monthlyPrice ?? 0);
  await prisma.company.update({
    where: { id: companyId },
    data: { cardReference: String(source.id) },
  });

  if (baseAmount <= 0) {
    const subscription = await activatePayPerUseSubscription(companyId, plan.id);
    return { status: 'APPROVED', subscription, payment: null };
  }

  const payment = await pendingPayment(companyId, PaymentPurpose.subscription, baseAmount);
  const reference = buildPaymentReference(payment.id, 'pay_per_use', plan.id);
  const transaction = await chargePaymentSource({
    amountInCents: Math.round(baseAmount * 100),
    customerEmail: company.email,
    reference,
    paymentSourceId: source.id,
  });
  await handleTransactionStatus(payment.id, transaction);

  if (transaction.status === 'APPROVED') {
    return {
      status: 'APPROVED',
      subscription: subscriptionView((await findActiveSubscription(companyId))!),
      payment: { ...payment, status: PaymentStatus.approved },
    };
  }

  if (transaction.status === 'PENDING') {
    return { status: 'PENDING', subscription: null, payment };
  }

  await prisma.company.update({ where: { id: companyId }, data: { cardReference: null } });
  throw new BadRequestError(
    'El cobro de la membresía fue rechazado. Intenta con otra tarjeta.',
    'PAYMENT_REJECTED'
  );
}

async function activatePayPerUseSubscription(companyId: string, planId: string) {
  const currentDate = today();
  await prisma.subscription.updateMany({
    where: { companyId, status: SubscriptionStatus.active },
    data: { status: SubscriptionStatus.inactive, endDate: currentDate },
  });
  const subscription = await prisma.subscription.create({
    data: {
      companyId,
      planId,
      status: SubscriptionStatus.active,
      billingCycle: BillingCycle.monthly,
      startDate: currentDate,
      renewalDate: addMonths(currentDate, 1),
    },
  });
  await prisma.creditBalance.upsert({
    where: { companyId },
    update: { planCredits: 0 },
    create: { companyId, planCredits: 0, extraCredits: 0 },
  });
  await createAdminNotifications(
    prisma,
    companyId,
    'pay_per_use_active',
    'La modalidad de pago por uso quedó activa. Cada optimización se acumulará para el cobro mensual.'
  );
  return subscription;
}

function parseReference(
  reference: string
): { paymentId: string; kind: string; rest: string[] } | null {
  const parts = reference.split('|');
  if (parts.length < 4) return null;

  const signature = parts.pop() ?? '';
  const payload = parts.join('|');
  const expected = referenceSignature(payload);

  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }

  const [paymentId, kind, ...rest] = parts;
  return { paymentId, kind, rest };
}

async function validateReference(
  tx: BillingClient,
  payment: { companyId: string; purpose: PaymentPurpose; amount: Prisma.Decimal },
  kind: string,
  rest: string[]
) {
  const amount = Number(payment.amount);

  if (kind === 'subscription' || kind === 'pay_per_use') {
    if (payment.purpose !== PaymentPurpose.subscription) {
      throw new BadRequestError('El pago no corresponde a una suscripción', 'REFERENCE_MISMATCH');
    }
    const plan = await tx.plan.findUnique({ where: { id: rest[0] } });
    if (!plan) throw new BadRequestError('Plan no encontrado', 'REFERENCE_MISMATCH');
    const expected =
      kind === 'pay_per_use'
        ? Number(plan.monthlyPrice ?? 0)
        : rest[1] === BillingCycle.annual
          ? Number(plan.annualPrice ?? 0)
          : Number(plan.monthlyPrice ?? 0);
    if (expected !== amount) {
      throw new BadRequestError('El monto del pago no coincide', 'REFERENCE_MISMATCH');
    }
    return;
  }

  if (kind === 'credit_package') {
    const pkg = await tx.creditPackage.findUnique({ where: { id: rest[0] } });
    if (
      payment.purpose !== PaymentPurpose.credit_package ||
      !pkg ||
      Number(pkg.price) !== amount
    ) {
      throw new BadRequestError('El pago no corresponde al paquete', 'REFERENCE_MISMATCH');
    }
    return;
  }

  if (kind === 'module') {
    const module = await tx.module.findUnique({ where: { id: rest[0] } });
    if (
      payment.purpose !== PaymentPurpose.module ||
      !module ||
      Number(module.price ?? 0) !== amount
    ) {
      throw new BadRequestError('El pago no corresponde al módulo', 'REFERENCE_MISMATCH');
    }
    return;
  }

  if (kind === 'usage') {
    const charge = await tx.usageCharge.findFirst({
      where: { id: rest[0], companyId: payment.companyId },
    });
    if (
      payment.purpose !== PaymentPurpose.usage ||
      !charge ||
      Number(charge.amount) !== amount
    ) {
      throw new BadRequestError('El pago no corresponde al consumo', 'REFERENCE_MISMATCH');
    }
    return;
  }

  throw new BadRequestError('Referencia de pago inválida', 'REFERENCE_MISMATCH');
}

export async function handleWompiEvent(payload: unknown) {
  if (!verifyWompiEvent(payload)) {
    throw new ForbiddenError('Firma de Wompi inválida', 'INVALID_WEBHOOK_SIGNATURE');
  }
  if (payload.event !== 'transaction.updated') {
    return { ignored: true };
  }

  const data = payload.data.transaction as WompiTransaction | undefined;
  if (!data?.reference) return { ignored: true };
  if (data.currency !== 'COP') {
    throw new BadRequestError('La moneda del pago no es válida', 'PAYMENT_CURRENCY_MISMATCH');
  }

  const parsed = parseReference(data.reference);
  if (!parsed) return { ignored: true };

  const payment = await prisma.payment.findUnique({ where: { id: parsed.paymentId } });
  if (!payment) return { ignored: true };

  const expectedAmount = Math.round(Number(payment.amount) * 100);
  if (data.amount_in_cents !== expectedAmount) {
    throw new BadRequestError('El monto del pago no coincide', 'PAYMENT_AMOUNT_MISMATCH');
  }

  await handleTransactionStatus(payment.id, data);
  return { received: true };
}

async function handleTransactionStatus(paymentId: string, transaction: WompiTransaction) {
  const status = transaction.status?.toUpperCase();
  if (status === 'APPROVED') {
    await approvePayment(paymentId, transaction);
  } else if (['DECLINED', 'VOIDED', 'ERROR'].includes(status)) {
    await rejectPayment(paymentId, transaction);
  }
}

async function approvePayment(paymentId: string, transaction: WompiTransaction) {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status !== PaymentStatus.pending) return;

    const claimed = await tx.payment.updateMany({
      where: { id: paymentId, status: PaymentStatus.pending },
      data: {
        status: PaymentStatus.approved,
        gatewayReference: transaction.id,
        paymentMethod: transaction.payment_method_type ?? transaction.payment_method?.type,
        approvedAt: new Date(),
      },
    });
    if (claimed.count === 0) return;

    const parsed = parseReference(transaction.reference);
    if (!parsed) {
      throw new BadRequestError('Referencia de pago inválida', 'REFERENCE_MISMATCH');
    }
    const { kind, rest } = parsed;
    await validateReference(tx, payment, kind, rest);

    if (kind === 'subscription' || kind === 'pay_per_use') {
      const planId = rest[0];
      const cycle = kind === 'pay_per_use' ? BillingCycle.monthly : (rest[1] as BillingCycle);
      await applySubscription(tx, payment.companyId, planId, cycle, paymentId);
    } else if (kind === 'credit_package') {
      await applyCreditPurchase(tx, payment.companyId, rest[0], paymentId);
    } else if (kind === 'module') {
      await applyModulePurchase(tx, payment.companyId, rest[0], paymentId, payment.amount);
    } else if (kind === 'usage') {
      await applyUsageCharge(tx, payment.companyId, rest[0], paymentId);
    }
  });
}

async function expireActiveSubscription(tx: BillingClient, companyId: string) {
  await tx.subscription.updateMany({
    where: { companyId, status: SubscriptionStatus.active },
    data: { status: SubscriptionStatus.expired, endDate: today() },
  });
}

async function rejectPayment(paymentId: string, transaction: WompiTransaction) {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status !== PaymentStatus.pending) return;

    const claimed = await tx.payment.updateMany({
      where: { id: paymentId, status: PaymentStatus.pending },
      data: {
        status: PaymentStatus.rejected,
        gatewayReference: transaction.id,
        paymentMethod: transaction.payment_method_type ?? transaction.payment_method?.type,
      },
    });
    if (claimed.count === 0) return;

    const parsed = parseReference(transaction.reference);
    if (!parsed) {
      throw new BadRequestError('Referencia de pago inválida', 'REFERENCE_MISMATCH');
    }
    const { kind, rest } = parsed;
    await validateReference(tx, payment, kind, rest);

    if (kind === 'usage') {
      await tx.usageCharge.updateMany({
        where: { id: rest[0], companyId: payment.companyId },
        data: { status: UsageChargeStatus.rejected },
      });
      await expireActiveSubscription(tx, payment.companyId);
    } else if (kind === 'subscription') {
      await expireActiveSubscription(tx, payment.companyId);
    } else if (kind === 'pay_per_use') {
      await tx.company.update({
        where: { id: payment.companyId },
        data: { cardReference: null },
      });
      await expireActiveSubscription(tx, payment.companyId);
    }

    await createAdminNotifications(
      tx,
      payment.companyId,
      'payment_rejected',
      'El pago fue rechazado. La empresa conserva sus datos, pero no podrá optimizar ni iniciar rutas hasta pagar.'
    );
  });
}

async function applySubscription(
  tx: BillingClient,
  companyId: string,
  planId: string,
  cycle: BillingCycle,
  paymentId: string
) {
  await lockCompanyBilling(tx, companyId);
  const plan = await tx.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new NotFoundError('Plan no encontrado', 'PLAN_NOT_FOUND');

  const currentDate = today();
  await tx.subscription.updateMany({
    where: { companyId, status: SubscriptionStatus.active },
    data: { status: SubscriptionStatus.inactive, endDate: currentDate },
  });
  await tx.subscription.create({
    data: {
      companyId,
      planId,
      status: SubscriptionStatus.active,
      billingCycle: cycle,
      paymentId,
      startDate: currentDate,
      renewalDate: addMonths(currentDate, cycle === BillingCycle.annual ? 12 : 1),
    },
  });

  const monthlyCredits = plan.modality === 'pay_per_use' ? 0 : (plan.monthlyCredits ?? 0);
  const balance = await ensureCreditBalance(companyId, tx);
  await tx.creditBalance.update({
    where: { companyId },
    data: { planCredits: monthlyCredits },
  });
  if (monthlyCredits > 0) {
    await tx.creditTransaction.create({
      data: {
        companyId,
        type: CreditTransactionType.renewal,
        quantity: monthlyCredits,
        resultingBalance: monthlyCredits + balance.extraCredits,
      },
    });
  }
  await createAdminNotifications(
    tx,
    companyId,
    'subscription_active',
    `El plan ${plan.name} quedó activo con facturación ${cycle === BillingCycle.annual ? 'anual' : 'mensual'}.`
  );
}

async function applyCreditPurchase(
  tx: BillingClient,
  companyId: string,
  packageId: string,
  paymentId: string
) {
  await lockCompanyBilling(tx, companyId);
  const pkg = await tx.creditPackage.findUnique({ where: { id: packageId } });
  if (!pkg) throw new NotFoundError('Paquete no encontrado', 'PACKAGE_NOT_FOUND');

  const balance = await ensureCreditBalance(companyId, tx);
  const creditPurchase = await tx.creditPurchase.create({
    data: {
      companyId,
      packageId,
      paymentId,
      credits: pkg.credits,
      price: pkg.price,
    },
  });
  await tx.creditBalance.update({
    where: { companyId },
    data: { extraCredits: { increment: pkg.credits } },
  });
  await tx.creditTransaction.create({
    data: {
      companyId,
      type: CreditTransactionType.purchase,
      quantity: pkg.credits,
      resultingBalance: balance.planCredits + balance.extraCredits + pkg.credits,
      purchaseId: creditPurchase.id,
    },
  });
  await createAdminNotifications(
    tx,
    companyId,
    'credits_purchased',
    `Compra exitosa: se agregaron ${pkg.credits} créditos adicionales.`
  );
}

async function applyModulePurchase(
  tx: BillingClient,
  companyId: string,
  moduleId: string,
  paymentId: string,
  amount: Prisma.Decimal
) {
  const module = await tx.module.findUnique({ where: { id: moduleId } });
  if (!module) throw new NotFoundError('Módulo no encontrado', 'MODULE_NOT_FOUND');

  await tx.companyModule.create({
    data: {
      companyId,
      moduleId,
      paymentId,
      price: amount,
      startDate: today(),
    },
  });
  await createAdminNotifications(
    tx,
    companyId,
    'module_purchased',
    `El módulo ${module.name} quedó activo.`
  );
}

async function applyUsageCharge(
  tx: BillingClient,
  companyId: string,
  usageChargeId: string,
  paymentId: string
) {
  const charge = await tx.usageCharge.findFirst({
    where: { id: usageChargeId, companyId },
  });
  if (!charge) return;

  await tx.usageCharge.update({
    where: { id: usageChargeId },
    data: {
      status: UsageChargeStatus.charged,
      paymentId,
      periodEndDate:
        charge.periodEndDate ?? addDays(addMonths(charge.periodStartDate, 1), -1),
    },
  });
  await createAdminNotifications(
    tx,
    companyId,
    'usage_charged',
    `Se cobró el consumo de pago por uso por ${Number(charge.amount).toLocaleString('es-CO')} COP.`
  );
}
