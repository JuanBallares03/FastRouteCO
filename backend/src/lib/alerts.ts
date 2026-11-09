import { AlertSeverity } from '@prisma/client';
import { prisma } from './prisma.js';

interface SystemAlertInput {
  companyId?: string | null;
  severity: AlertSeverity;
  source: string;
  message: string;
}

export async function recordSystemAlert(input: SystemAlertInput): Promise<void> {
  await prisma.systemAlert.create({
    data: {
      companyId: input.companyId ?? null,
      severity: input.severity,
      source: input.source,
      message: input.message.slice(0, 4000),
    },
  });
}
