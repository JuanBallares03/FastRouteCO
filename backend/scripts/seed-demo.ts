import { PrismaClient, UserRole, CompanyStatus, SubscriptionStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

if (process.env.NODE_ENV === 'production') {
  console.error('❌ Este script solo puede ejecutarse en desarrollo (NODE_ENV !== production)');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/fastrouteco?schema=public';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const BCRYPT_ROUNDS = 12;
const DEMO_ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD;
const DEMO_DRIVER_PASSWORD = process.env.DEMO_DRIVER_PASSWORD;

if (!DEMO_ADMIN_PASSWORD || !DEMO_DRIVER_PASSWORD) {
  console.error('❌ Faltan variables de entorno: DEMO_ADMIN_PASSWORD y DEMO_DRIVER_PASSWORD');
  process.exit(1);
}

if (DEMO_ADMIN_PASSWORD.length < 10 || DEMO_DRIVER_PASSWORD.length < 10) {
  console.error('❌ Las contraseñas deben tener al menos 10 caracteres');
  process.exit(1);
}

const COMPANY_NIT = '900.000.000-0';
const COMPANY_NAME = 'Demo Company Ibagué';
const COMPANY_EMAIL = 'demo@fastrouteco.com';
const COMPANY_PHONE = '+57 8 1234567';
const COMPANY_ADDRESS = 'Calle 10 # 3-45, Ibagué, Tolima';
const ADMIN_EMAIL = 'admin@demo.local';
const DRIVER_EMAIL = 'driver@demo.local';

async function main() {
  console.log('🌱 Seeding demo data...\n');

  const freeTrialPlan = await prisma.plan.findUnique({ where: { name: 'Free Trial' } });
  if (!freeTrialPlan) {
    console.error('❌ Plan "Free Trial" no encontrado. Ejecute primero: pnpm db:seed');
    process.exit(1);
  }
  console.log('  ✓ Plan "Free Trial" encontrado');

  const company = await prisma.company.upsert({
    where: { taxId: COMPANY_NIT },
    update: {},
    create: {
      legalName: COMPANY_NAME,
      taxId: COMPANY_NIT,
      email: COMPANY_EMAIL,
      phone: COMPANY_PHONE,
      address: COMPANY_ADDRESS,
      status: CompanyStatus.active,
      hasOwnFleet: true,
    },
  });
  console.log(`  ✓ Empresa: ${company.legalName} (${company.id})`);

  const existingSubscription = await prisma.subscription.findFirst({
    where: { companyId: company.id, status: SubscriptionStatus.active },
  });

  if (!existingSubscription) {
    const renewalDate = new Date();
    renewalDate.setDate(renewalDate.getDate() + (freeTrialPlan.trialDays ?? 7));
    
    await prisma.subscription.create({
      data: {
        companyId: company.id,
        planId: freeTrialPlan.id,
        status: SubscriptionStatus.active,
        startDate: new Date(),
        renewalDate,
      },
    });
    console.log('  ✓ Suscripción Free Trial creada');
  } else {
    console.log('  ✓ Suscripción Free Trial ya existe');
  }

  const existingBalance = await prisma.creditBalance.findUnique({ where: { companyId: company.id } });
  if (!existingBalance) {
    await prisma.creditBalance.create({
      data: {
        companyId: company.id,
        planCredits: freeTrialPlan.monthlyCredits ?? 100,
        extraCredits: 0,
      },
    });
    console.log('  ✓ Balance de créditos creado');
  } else {
    console.log('  ✓ Balance de créditos ya existe');
  }

  const adminPasswordHash = await bcrypt.hash(DEMO_ADMIN_PASSWORD, BCRYPT_ROUNDS);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash: adminPasswordHash, isActive: true },
    create: {
      companyId: company.id,
      role: UserRole.company_admin,
      fullName: 'Demo Admin',
      email: ADMIN_EMAIL,
      passwordHash: adminPasswordHash,
      isActive: true,
    },
  });
  console.log(`  ✓ Company Admin: ${admin.email} (${admin.id})`);

  const driverPasswordHash = await bcrypt.hash(DEMO_DRIVER_PASSWORD, BCRYPT_ROUNDS);
  const driverUser = await prisma.user.upsert({
    where: { email: DRIVER_EMAIL },
    update: { passwordHash: driverPasswordHash, isActive: true },
    create: {
      companyId: company.id,
      role: UserRole.driver,
      fullName: 'Demo Driver',
      email: DRIVER_EMAIL,
      passwordHash: driverPasswordHash,
      isActive: true,
    },
  });
  console.log(`  ✓ Usuario Driver: ${driverUser.email} (${driverUser.id})`);

  const existingDriver = await prisma.driver.findUnique({ where: { userId: driverUser.id } });
  if (!existingDriver) {
    await prisma.driver.create({
      data: {
        userId: driverUser.id,
        status: 'available',
      },
    });
    console.log('  ✓ Registro Driver creado');
  } else {
    console.log('  ✓ Registro Driver ya existe');
  }

  console.log('\n✅ Demo seed completed successfully');
  console.log('\nCredenciales de acceso:');
  console.log(`  Company Admin: ${ADMIN_EMAIL} / [DEMO_ADMIN_PASSWORD]`);
  console.log(`  Driver:        ${DRIVER_EMAIL} / [DEMO_DRIVER_PASSWORD]`);
}

main()
  .catch((e) => {
    console.error('❌ Demo seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });