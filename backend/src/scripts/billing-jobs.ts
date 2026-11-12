import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { runBillingJobsAndRecord } from '../modules/billing/billing-jobs.js';

async function main() {
  const result = await runBillingJobsAndRecord();
  console.log('[billing-jobs] Result:', JSON.stringify(result, null, 2));
  await prisma.$disconnect();
  if (result.errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error('[billing-jobs] Failed:', error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
