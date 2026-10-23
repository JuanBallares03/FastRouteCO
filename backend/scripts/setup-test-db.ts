import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

const TEST_DB_URL = 'postgresql://postgres:postgres@localhost:5433/fastrouteco_test?schema=public';
const MAIN_DB_URL = 'postgresql://postgres:postgres@localhost:5433/fastrouteco?schema=public';

async function main() {
  console.log('🔧 Setting up test database...');

  // Create test database if it doesn't exist
  const adminAdapter = new PrismaPg({ connectionString: MAIN_DB_URL });
  const adminPrisma = new PrismaClient({ adapter: adminAdapter });

  try {
    await adminPrisma.$executeRawUnsafe(`CREATE DATABASE fastrouteco_test`);
    console.log('✅ Test database created');
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log('ℹ️ Test database already exists');
    } else {
      throw error;
    }
  } finally {
    await adminPrisma.$disconnect();
  }

  // Run migrations on test database
  console.log('🔄 Running migrations on test database...');
  try {
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'pnpm.cmd' : 'pnpm';
    execSync(`${command} prisma migrate deploy`, {
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
      stdio: 'inherit',
      cwd: PROJECT_ROOT,
      shell: isWindows,
    });
    console.log('✅ Migrations applied to test database');
  } catch (error) {
    console.error('❌ Failed to apply migrations to test database');
    throw error;
  }

  console.log('🎉 Test database setup complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  });