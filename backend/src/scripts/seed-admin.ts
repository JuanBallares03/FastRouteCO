import { PrismaClient, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/fastrouteco?schema=public';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const BCRYPT_ROUNDS = 12;

const ENV_EMAIL = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
const ENV_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

async function promptLine(question: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(question);
    return answer.trim();
  } finally {
    rl.close();
  }
}

async function promptEmail(): Promise<string> {
  return (await promptLine('Email del Platform Administrator: ')).toLowerCase();
}

async function promptPassword(question: string): Promise<string> {
  if (!input.isTTY) {
    return promptLine(question);
  }

  output.write(question);

  return new Promise((resolve) => {
    if (!input.isTTY) return;
    input.setRawMode(true);
    input.resume();
    input.setEncoding('utf8');

    let value = '';

    const finish = () => {
      input.removeListener('data', onData);
      input.setRawMode(false);
      input.pause();
    };

    function onData(chunk: string) {
      for (const char of chunk) {
        if (char === '\u0003') {
          finish();
          output.write('\n');
          process.exit(130);
        }
        if (char === '\r' || char === '\n') {
          finish();
          output.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u007f' || char === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            output.write('\b \b');
          }
          continue;
        }
        if (char >= ' ') {
          value += char;
          output.write('*');
        }
      }
    }

    input.on('data', onData);
  });
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
  if (ENV_EMAIL) {
    if (!await validateEmail(ENV_EMAIL)) {
      throw new Error('SEED_ADMIN_EMAIL no es un email válido.');
    }
    const exists = await prisma.user.findUnique({ where: { email: ENV_EMAIL } });
    if (exists) {
      throw new Error('El email de SEED_ADMIN_EMAIL ya está registrado.');
    }
    email = ENV_EMAIL;
  } else {
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
  }

  let password: string;
  if (ENV_PASSWORD) {
    if (ENV_PASSWORD.length < 10) {
      throw new Error('SEED_ADMIN_PASSWORD debe tener al menos 10 caracteres.');
    }
    password = ENV_PASSWORD;
  } else {
    while (true) {
      password = await promptPassword('Contraseña (mínimo 10 caracteres): ');
      console.log('');
      if (password.length < 10) {
        console.log('❌ La contraseña debe tener al menos 10 caracteres. Intente de nuevo.\n');
        continue;
      }
      const confirm = await promptPassword('Confirme la contraseña: ');
      console.log('');
      if (password !== confirm) {
        console.log('❌ Las contraseñas no coinciden. Intente de nuevo.\n');
        continue;
      }
      break;
    }
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
