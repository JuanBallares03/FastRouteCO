import { PrismaClient, ServiceModality, SubscriptionStatus, BillingCycle } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/fastrouteco?schema=public';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const PLANS = [
  {
    name: 'Free Trial',
    modality: ServiceModality.subscription,
    maxDrivers: 3,
    maxBranches: 1,
    supportType: 'email',
    trialDays: 7,
    monthlyCredits: 100,
    monthlyPrice: 0,
    annualPrice: 0,
    includedDrivers: null,
    pricePerOptimization: null,
    pricePerAdditionalDriver: null,
    earlyChargeThreshold: null,
    isActive: true,
  },
  {
    name: 'Basic',
    modality: ServiceModality.subscription,
    maxDrivers: 3,
    maxBranches: 1,
    supportType: 'email',
    trialDays: 0,
    monthlyCredits: 500,
    monthlyPrice: 129900,
    annualPrice: null,
    includedDrivers: null,
    pricePerOptimization: null,
    pricePerAdditionalDriver: null,
    earlyChargeThreshold: null,
    isActive: true,
  },
  {
    name: 'Pro',
    modality: ServiceModality.subscription,
    maxDrivers: 10,
    maxBranches: 5,
    supportType: 'priority_email',
    trialDays: 0,
    monthlyCredits: 2000,
    monthlyPrice: 349900,
    annualPrice: null,
    includedDrivers: null,
    pricePerOptimization: null,
    pricePerAdditionalDriver: null,
    earlyChargeThreshold: null,
    isActive: true,
  },
  {
    name: 'Premium',
    modality: ServiceModality.subscription,
    maxDrivers: null,
    maxBranches: null,
    supportType: 'phone',
    trialDays: 0,
    monthlyCredits: 10000,
    monthlyPrice: 899900,
    annualPrice: null,
    includedDrivers: null,
    pricePerOptimization: null,
    pricePerAdditionalDriver: null,
    earlyChargeThreshold: null,
    isActive: true,
  },
  {
    name: 'Pay-per-use',
    modality: ServiceModality.pay_per_use,
    maxDrivers: null,
    maxBranches: null,
    supportType: 'email',
    trialDays: 0,
    monthlyCredits: 0,
    monthlyPrice: 59900,
    annualPrice: null,
    includedDrivers: 2,
    pricePerOptimization: 700,
    pricePerAdditionalDriver: 29900,
    earlyChargeThreshold: null,
    isActive: true,
  },
];

const MODULES = [
  {
    code: 'school_transport',
    name: 'Transporte Escolar',
    price: 499000,
    isActive: true,
  },
];

const CREDIT_PACKAGES = [
  {
    name: 'Paquete 100 créditos',
    credits: 100,
    price: 150000,
    isActive: true,
  },
  {
    name: 'Paquete 500 créditos',
    credits: 500,
    price: 650000,
    isActive: true,
  },
  {
    name: 'Paquete 1000 créditos',
    credits: 1000,
    price: 1200000,
    isActive: true,
  },
];

const SYSTEM_SETTINGS = {
  invitation_expiry_hours: 72,
  refresh_token_days: 7,
  access_token_minutes: 15,
  password_min_length: 10,
  bcrypt_rounds: 12,
  default_company_plan: 'Free Trial',
};

async function seedPlans() {
  console.log('🌱 Seeding plans...');
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: {},
      create: plan,
    });
    console.log(`  ✓ ${plan.name}`);
  }
}

async function seedModules() {
  console.log('🌱 Seeding modules...');
  for (const module of MODULES) {
    await prisma.module.upsert({
      where: { code: module.code },
      update: {},
      create: module,
    });
    console.log(`  ✓ ${module.name} (${module.code})`);
  }
}

const SCHOOL_TRANSPORT_PLANS = ['Free Trial', 'Premium'];

async function seedPlanModules() {
  console.log('🌱 Seeding plan_modules...');
  const schoolModule = await prisma.module.findUnique({ where: { code: 'school_transport' } });
  if (!schoolModule) throw new Error('school_transport module not found');

  const plans = await prisma.plan.findMany({
    where: { isActive: true, name: { in: SCHOOL_TRANSPORT_PLANS } },
  });

  await prisma.planModule.createMany({
    data: plans.map((plan) => ({ planId: plan.id, moduleId: schoolModule.id })),
    skipDuplicates: true,
  });

  for (const plan of plans) {
    console.log(`  V ${plan.name} <-> school_transport`);
  }
}

async function seedCreditPackages() {
  console.log('🌱 Seeding credit_packages...');
  for (const pkg of CREDIT_PACKAGES) {
    const existing = await prisma.creditPackage.findFirst({ where: { name: pkg.name } });
    if (!existing) {
      await prisma.creditPackage.create({ data: pkg });
    }
    console.log(`  ✓ ${pkg.name}`);
  }
}

async function seedSystemSettings() {
  console.log('🌱 Seeding system_settings...');
  for (const [key, value] of Object.entries(SYSTEM_SETTINGS)) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    console.log(`  ✓ ${key} = ${JSON.stringify(value)}`);
  }
}

async function main() {
  console.log('🚀 Starting database seed...');
  await seedPlans();
  await seedModules();
  await seedPlanModules();
  await seedCreditPackages();
  await seedSystemSettings();
  console.log('✅ Seed completed successfully');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });