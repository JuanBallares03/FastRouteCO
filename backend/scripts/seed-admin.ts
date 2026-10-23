import { PrismaClient, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/fastrouteco?schema=public';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const BCRYPT_ROUNDS = 12;

async function promptEmail(): Promise<string> {
  const rl = readline.createInterface({ input, output });
  const email = await rl.question('Email del Platform Administrator: ');
  rl.close();
  return email.trim().toLowerCase();
}

async function promptPassword(): Promise<string> {
  const rl = readline.createInterface({ input, output });
  const password = await rl.question('Contraseña (mínimo 10 caracteres): ', { hideEchoBack: true });
  rl.close();
  return password;
}

async function validateEmail(email: string): Promise<boolean> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function main() {
  console.log('🔐 FastRouteCO — Crear primer Platform Administrator\n');

  const existingAdmin = await prisma.user.findFirst({
    where: { role: UserRole.platform_admin },
  });

  if (existingAdmin) {
    console.log('⚠️  Ya existe un Platform Administrator:', existingAdmin.email);
    console.log('   No se puede crear otro. Elimine el existente primero si es necesario.');
    process.exit(0);
  }

  let email: string;
  while (true) {
    email = await promptEmail();
    if (!await validateEmail(email)) {
      console.log('❌ Email inválido. Intente de nuevo.\n');
      continue;
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      console.log('❌ Este email ya está registrado. Intente con otro.\n');
      continue;
    }
    break;
  }

  let password: string;
  while (true) {
    password = await promptPassword();
    console.log('');
    if (password.length < 10) {
      console.log('❌ La contraseña debe tener al menos 10 caracteres. Intente de nuevo.\n');
      continue;
    }
    const confirm = await promptPassword();
    console.log('');
    if (password !== confirm) {
      console.log('❌ Las contraseñas no coinciden. Intente de nuevo.\n');
      continue;
    }
    break;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const admin = await prisma.user.create({
    data: {
      role: UserRole.platform_admin,
      fullName: 'Platform Administrator',
      email,
      passwordHash,
      isActive: true,
    },
  });

  console.log('✅ Platform Administrator creado exitosamente');
  console.log(`   ID: ${admin.id}`);
  console.log(`   Email: ${admin.email}`);
  console.log(`   Rol: ${admin.role}`);
  console.log('\n   Guarde estas credenciales de forma segura.');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });