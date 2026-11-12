import { prisma } from '../../lib/prisma.js';
import { todayInBogota } from '../../lib/dates.js';
import { processClosingUsageCharges, syncCompanySubscription } from './billing.service.js';

const BILLING_JOB_TIME = '00:10';
const BILLING_JOB_LOCK = 'fastrouteco:billing-jobs';
const BILLING_JOB_LAST_RUN_KEY = 'billing_jobs_last_run';
const JOB_TIMEOUT_MS = 30 * 60 * 1000;

export interface BillingJobError {
  companyId: string;
  message: string;
}

export interface BillingJobResult {
  skipped: boolean;
  companiesProcessed: number;
  errors: BillingJobError[];
}

export interface BillingJobOptions {
  companyIds?: string[];
}

export async function runBillingJobs(options: BillingJobOptions = {}): Promise<BillingJobResult> {
  return prisma.$transaction(
    async (tx) => {
      const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_xact_lock(hashtext(${BILLING_JOB_LOCK})::bigint) AS locked
      `;
      if (!lock?.locked) {
        return { skipped: true, companiesProcessed: 0, errors: [] };
      }

      const companies = options.companyIds
        ? options.companyIds.map((id) => ({ id }))
        : await tx.company.findMany({ select: { id: true } });

      const errors: BillingJobError[] = [];
      for (const company of companies) {
        try {
          await syncCompanySubscription(company.id);
          await processClosingUsageCharges(company.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push({ companyId: company.id, message });
          console.error(`[billing-jobs] Company ${company.id} failed:`, error);
        }
      }

      return { skipped: false, companiesProcessed: companies.length, errors };
    },
    { maxWait: 10_000, timeout: JOB_TIMEOUT_MS }
  );
}

async function getLastRunDate(): Promise<string | null> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: BILLING_JOB_LAST_RUN_KEY },
  });
  const value = setting?.value as { date?: unknown } | null;
  return typeof value?.date === 'string' ? value.date : null;
}

async function recordRun(date: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key: BILLING_JOB_LAST_RUN_KEY },
    update: { value: { date }, updatedAt: new Date() },
    create: { key: BILLING_JOB_LAST_RUN_KEY, value: { date } },
  });
}

export async function runBillingJobsAndRecord(
  options: BillingJobOptions = {}
): Promise<BillingJobResult> {
  const currentDate = todayInBogota();
  const result = await runBillingJobs(options);
  if (!result.skipped && result.errors.length === 0) {
    await recordRun(currentDate);
  }
  return result;
}

function currentTimeInBogota(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('hour')}:${value('minute')}`;
}

let scheduler: NodeJS.Timeout | null = null;
let lastAttemptDate: string | null = null;

async function runIfNeeded(force: boolean): Promise<void> {
  const currentDate = todayInBogota();
  if (!force && lastAttemptDate === currentDate) return;
  if (!force && currentTimeInBogota() < BILLING_JOB_TIME) return;

  lastAttemptDate = currentDate;
  try {
    if ((await getLastRunDate()) === currentDate) return;
    const result = await runBillingJobsAndRecord();
    console.log('[billing-jobs] Run finished:', result);
  } catch (error) {
    console.error('[billing-jobs] Run failed:', error);
  }
}

export function startBillingJobScheduler() {
  if (scheduler) return;
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return;
  if (process.env.BILLING_JOBS_DISABLED === 'true') {
    console.log('[billing-jobs] Scheduler disabled by BILLING_JOBS_DISABLED');
    return;
  }

  console.log(
    `[billing-jobs] Scheduler started; daily run at ${BILLING_JOB_TIME} America/Bogota`
  );
  scheduler = setInterval(() => {
    void runIfNeeded(false);
  }, 60_000);
  scheduler.unref();

  void runIfNeeded(currentTimeInBogota() >= BILLING_JOB_TIME);
}

export function stopBillingJobScheduler() {
  if (!scheduler) return;
  clearInterval(scheduler);
  scheduler = null;
}
