import { resetPrisma } from './src/lib/prisma.js';
import { config } from 'dotenv';

config({ path: '.env.test' });

resetPrisma();

export default async function globalSetup() {
  console.log('🔧 Global test setup: .env.test loaded');
}