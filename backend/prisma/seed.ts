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
    includedDrivers: 3,
    pricePerOptimization: 0,
    pricePerAdditionalDriver: 0,
    earlyChargeThreshold: 0,
    isActive: true,
  },
  {
    name: 'Basic',
    modality: ServiceModality.subscription,
    maxDrivers: 10,
    maxBranches: 3,
    supportType: 'email',
    trialDays: 0,
    monthlyCredits: 500,
    monthlyPrice: 990000,
    annualPrice: 9900000,
    includedDrivers: 5,
    pricePerOptimization: 5000,
    pricePerAdditionalDriver: 50000,
    earlyChargeThreshold: 0.8,
    isActive: true,
  },
  {
    name: 'Pro',
    modality: ServiceModality.subscription,
    maxDrivers: 50,
    maxBranches: 10,
    supportType: 'priority_email',
    trialDays: 0,
    monthlyCredits: 2000,
    monthlyPrice: 2990000,
    annualPrice: 29900000,
    includedDrivers: 20,
    pricePerOptimization: 3000,
    pricePerAdditionalDriver: 35000,
    earlyChargeThreshold: 0.8,
    isActive: true,
  },
  {
    name: 'Premium',
    modality: ServiceModality.subscription,
    maxDrivers: 200,
    maxBranches: 50,
    supportType: 'phone',
    trialDays: 0,
    monthlyCredits: 10000,
    monthlyPrice: 7990000,
    annualPrice: 79900000,
    includedDrivers: 100,
    pricePerOptimization: 2000,
    pricePerAdditionalDriver: 25000,
    earlyChargeThreshold: 0.9,
    isActive: true,
  },
  {
    name: 'Pay-per-use',
    modality: ServiceModality.pay_per_use,
    maxDrivers: 100,
    maxBranches: 20,
    supportType: 'email',
    trialDays: 0,
    monthlyCredits: 0,
    monthlyPrice: 0,
    annualPrice: 0,
    includedDrivers: 0,
    pricePerOptimization: 8000,
    pricePerAdditionalDriver: 0,
    earlyChargeThreshold: 0.8,
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

async function seedPlanModules() {
  console.log('🌱 Seeding plan_modules...');
  const schoolModule = await prisma.module.findUnique({ where: { code: 'school_transport' } });
  if (!schoolModule) throw new Error('school_transport module not found');

  const plans = await prisma.plan.findMany({ where: { isActive: true } });
  for (const plan of plans) {
    await prisma.planModule.upsert({
      where: { planId_moduleId: { planId: plan.id, moduleId: schoolModule.id } },
      update: {},
      create: { planId: plan.id, moduleId: schoolModule.id },
    });
    console.log(`  ✓ ${plan.name} <-> school_transport`);
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