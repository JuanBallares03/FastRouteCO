import {
  AlertSeverity,
  CompanyStatus,
  IncidentStatus,
  Prisma,
  RouteStatus,
  SubscriptionStatus,
  SupportStatus,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { parseBusinessDate, todayInBogota } from '../../lib/dates.js';
import { NotFoundError } from '../../lib/errors.js';
import type { ListAlertsInput } from './monitoring.validation.js';

function serializeAlert(alert: Prisma.SystemAlertGetPayload<Record<string, never>>) {
  return {
    ...alert,
    id: alert.id.toString(),
  };
}

export async function listAlerts(filters: ListAlertsInput) {
  const where: Prisma.SystemAlertWhereInput = {
    severity: filters.severity,
    ...(filters.resolved === 'true'
      ? { resolvedAt: { not: null } }
      : filters.resolved === 'false'
        ? { resolvedAt: null }
        : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.systemAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.systemAlert.count({ where }),
  ]);

  return {
    items: items.map(serializeAlert),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function resolveAlert(id: string) {
  const alert = await prisma.systemAlert.findUnique({ where: { id: BigInt(id) } });
  if (!alert) {
    throw new NotFoundError('Alerta no encontrada', 'ALERT_NOT_FOUND');
  }

  const updated = await prisma.systemAlert.update({
    where: { id: alert.id },
    data: { resolvedAt: alert.resolvedAt ?? new Date() },
  });

  return serializeAlert(updated);
}

export async function getPlatformOverview() {
  const today = parseBusinessDate(todayInBogota());
  const inSevenDays = new Date(today);
  inSevenDays.setUTCDate(inSevenDays.getUTCDate() + 7);

  const [
    companiesTotal,
    companiesActive,
    subscriptionsActive,
    trialsActive,
    expiringSubscriptions,
    routesToday,
    routesInProgress,
    incidentsOpen,
    supportOpen,
    alertsUnresolved,
    latestAlerts,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.company.count({ where: { status: CompanyStatus.active } }),
    prisma.subscription.count({ where: { status: SubscriptionStatus.active } }),
    prisma.subscription.count({
      where: {
        status: SubscriptionStatus.active,
        plan: { trialDays: { gt: 0 } },
        renewalDate: { gte: today },
      },
    }),
    prisma.subscription.count({
      where: {
        status: SubscriptionStatus.active,
        renewalDate: { gte: today, lte: inSevenDays },
      },
    }),
    prisma.route.count({ where: { routeDate: today } }),
    prisma.route.count({ where: { status: RouteStatus.in_progress } }),
    prisma.incident.count({
      where: { status: { in: [IncidentStatus.open, IncidentStatus.in_progress] } },
    }),
    prisma.supportRequest.count({
      where: { status: { in: [SupportStatus.open, SupportStatus.answered] } },
    }),
    prisma.systemAlert.count({ where: { resolvedAt: null } }),
    prisma.systemAlert.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);

  const alertCounts = await prisma.systemAlert.groupBy({
    by: ['severity'],
    where: { resolvedAt: null },
    _count: { _all: true },
  });

  const bySeverity: Record<AlertSeverity, number> = {
    info: 0,
    warning: 0,
    critical: 0,
  };
  for (const entry of alertCounts) {
    bySeverity[entry.severity] = entry._count._all;
  }

  return {
    generatedAt: new Date().toISOString(),
    companies: {
      total: companiesTotal,
      active: companiesActive,
      inactive: companiesTotal - companiesActive,
    },
    subscriptions: {
      active: subscriptionsActive,
      trialsActive,
      expiringInSevenDays: expiringSubscriptions,
    },
    operations: {
      routesToday,
      routesInProgress,
      incidentsOpen,
      supportOpen,
    },
    alerts: {
      unresolved: alertsUnresolved,
      bySeverity,
      latest: latestAlerts.map(serializeAlert),
    },
  };
}
