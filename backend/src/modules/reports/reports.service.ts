import {
  CreditTransactionType,
  IncidentStatus,
  OrderStatus,
  Prisma,
  RouteStatus,
  StopStatus,
  SubscriptionStatus,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { addDays, parseBusinessDate, todayInBogota } from '../../lib/dates.js';
import { BadRequestError } from '../../lib/errors.js';
import type { ReportSummaryInput } from './reports.validation.js';

const MAX_RANGE_DAYS = 366;

const reportRouteInclude = {
  stops: {
    include: {
      order: { select: { id: true, branchId: true, priority: true } },
      student: { select: { id: true, fullName: true } },
    },
    orderBy: { sequence: 'asc' as const },
  },
  driver: { include: { user: { select: { id: true, fullName: true } } } },
  optimizations: {
    orderBy: { optimizationDate: 'desc' as const },
    take: 1,
    select: { totalDistanceM: true, estimatedDurationS: true, isSuccessful: true },
  },
} satisfies Prisma.RouteInclude;

interface DriverRanking {
  driverId: string;
  fullName: string;
  routes: number;
  stopsCompleted: number;
  plannedDistanceM: number;
  actualDistanceM: number;
}

function resolveRange(input: ReportSummaryInput) {
  const today = todayInBogota();
  const from = input.from ?? addDays(parseBusinessDate(today), -29).toISOString().slice(0, 10);
  const to = input.to ?? today;

  const fromDate = parseBusinessDate(from);
  const toDate = parseBusinessDate(to);
  const days = Math.floor((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
  if (days > MAX_RANGE_DAYS) {
    throw new BadRequestError(
      `El rango no puede superar ${MAX_RANGE_DAYS} días`,
      'REPORT_RANGE_TOO_LARGE'
    );
  }

  return { from, to, fromDate, toDate, days };
}

async function actualDistancesByRoute(routeIds: string[]): Promise<Map<string, number>> {
  if (routeIds.length === 0) return new Map();

  const rows = await prisma.$queryRaw<Array<{ route_id: string; distance: unknown }>>(
    Prisma.sql`
      SELECT route_id::text AS route_id, COALESCE(SUM(
        6371000 * 2 * asin(sqrt(
          power(sin(radians(latitude - previous_latitude) / 2), 2) +
          cos(radians(previous_latitude)) * cos(radians(latitude)) *
          power(sin(radians(longitude - previous_longitude) / 2), 2)
        ))
      ), 0) AS distance
      FROM (
        SELECT route_id, latitude, longitude,
               lag(latitude) OVER (PARTITION BY route_id ORDER BY captured_at, id) AS previous_latitude,
               lag(longitude) OVER (PARTITION BY route_id ORDER BY captured_at, id) AS previous_longitude
        FROM route_locations
        WHERE route_id = ANY(${routeIds}::uuid[])
      ) points
      WHERE previous_latitude IS NOT NULL
      GROUP BY route_id
    `
  );

  return new Map(rows.map((row) => [row.route_id, Number(row.distance)]));
}

function roundedAverage(total: number, count: number): number | null {
  return count > 0 ? Math.round(total / count) : null;
}

export async function getReportSummary(companyId: string, input: ReportSummaryInput) {
  const range = resolveRange(input);
  const where: Prisma.RouteWhereInput = {
    companyId,
    routeDate: { gte: range.fromDate, lte: range.toDate },
    ...(input.branchId
      ? { stops: { some: { order: { branchId: input.branchId } } } }
      : {}),
  };

  const [routes, creditConsumption] = await Promise.all([
    prisma.route.findMany({
      where,
      include: reportRouteInclude,
      orderBy: [{ routeDate: 'asc' }, { id: 'asc' }],
    }),
    prisma.creditTransaction.aggregate({
      where: {
        companyId,
        type: CreditTransactionType.consumption,
        transactionDate: { gte: range.fromDate, lte: range.toDate },
      },
      _sum: { quantity: true },
    }),
  ]);

  const actualDistances = await actualDistancesByRoute(routes.map((route) => route.id));

  const byStatus: Record<RouteStatus, number> = {
    created: 0,
    optimized: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  };

  let stopsTotal = 0;
  let stopsCompleted = 0;
  let stopsPending = 0;
  let plannedDistanceM = 0;
  let actualDistanceM = 0;
  let stopDurationTotalS = 0;
  let stopsWithDuration = 0;
  let routeDurationTotalS = 0;
  let routesWithDuration = 0;
  const drivers = new Map<string, DriverRanking>();

  const routeRows = routes.map((route) => {
    byStatus[route.status] += 1;

    const completed = route.stops.filter((stop) => stop.status === StopStatus.completed).length;
    const pending = route.stops.filter((stop) => stop.status !== StopStatus.completed).length;
    stopsTotal += route.stops.length;
    stopsCompleted += completed;
    stopsPending += pending;

    for (const stop of route.stops) {
      if (stop.arrivedAt && stop.confirmedAt) {
        stopDurationTotalS += Math.max(
          0,
          Math.round((stop.confirmedAt.getTime() - stop.arrivedAt.getTime()) / 1000)
        );
        stopsWithDuration += 1;
      }
    }

    if (route.startedAt && route.endedAt) {
      routeDurationTotalS += Math.max(
        0,
        Math.round((route.endedAt.getTime() - route.startedAt.getTime()) / 1000)
      );
      routesWithDuration += 1;
    }

    const planned = route.optimizations[0]?.totalDistanceM ?? 0;
    const actual = Math.round(actualDistances.get(route.id) ?? 0);
    plannedDistanceM += planned;
    actualDistanceM += actual;

    const ranking = drivers.get(route.driverId) ?? {
      driverId: route.driverId,
      fullName: route.driver.user.fullName,
      routes: 0,
      stopsCompleted: 0,
      plannedDistanceM: 0,
      actualDistanceM: 0,
    };
    ranking.routes += 1;
    ranking.stopsCompleted += completed;
    ranking.plannedDistanceM += planned;
    ranking.actualDistanceM += actual;
    drivers.set(route.driverId, ranking);

    return {
      id: route.id,
      routeDate: route.routeDate.toISOString().slice(0, 10),
      status: route.status,
      driver: { id: route.driverId, fullName: route.driver.user.fullName },
      stopsTotal: route.stops.length,
      stopsCompleted: completed,
      stopsPending: pending,
      plannedDistanceM: planned,
      actualDistanceM: actual,
      durationS:
        route.startedAt && route.endedAt
          ? Math.max(0, Math.round((route.endedAt.getTime() - route.startedAt.getTime()) / 1000))
          : null,
    };
  });

  return {
    range: { from: range.from, to: range.to, days: range.days },
    metrics: {
      routesTotal: routes.length,
      routesCompleted: byStatus.completed,
      routesCancelled: byStatus.cancelled,
      routesInProgress: byStatus.in_progress,
      stopsTotal,
      stopsCompleted,
      stopsPending,
      completionRate: stopsTotal > 0 ? Math.round((stopsCompleted / stopsTotal) * 100) : 0,
      plannedDistanceM,
      actualDistanceM,
      averageStopDurationS: roundedAverage(stopDurationTotalS, stopsWithDuration),
      averageRouteDurationS: roundedAverage(routeDurationTotalS, routesWithDuration),
      creditsConsumed: Math.abs(creditConsumption._sum.quantity ?? 0),
      byStatus,
    },
    driverRanking: [...drivers.values()].sort(
      (left, right) =>
        right.stopsCompleted - left.stopsCompleted ||
        right.routes - left.routes ||
        left.fullName.localeCompare(right.fullName)
    ),
    routes: routeRows,
  };
}

export async function getCompanyDashboard(companyId: string) {
  const today = parseBusinessDate(todayInBogota());
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const monthStartValue = monthStart.toISOString().slice(0, 10);
  const todayValue = today.toISOString().slice(0, 10);

  const [
    monthSummary,
    subscription,
    creditBalance,
    driversTotal,
    driversAvailable,
    ordersPending,
    ordersUrgent,
    routesToday,
    routesActive,
    routesCompletedToday,
    incidentsOpen,
  ] = await Promise.all([
    getReportSummary(companyId, { from: monthStartValue, to: todayValue }),
    prisma.subscription.findFirst({
      where: { companyId, status: SubscriptionStatus.active },
      include: { plan: true },
      orderBy: { startDate: 'desc' },
    }),
    prisma.creditBalance.findUnique({ where: { companyId } }),
    prisma.user.count({ where: { companyId, role: 'driver', isActive: true } }),
    prisma.user.count({
      where: { companyId, role: 'driver', isActive: true, driver: { status: 'available' } },
    }),
    prisma.order.count({ where: { companyId, status: OrderStatus.pending } }),
    prisma.order.count({
      where: { companyId, status: OrderStatus.pending, priority: 'urgent' },
    }),
    prisma.route.count({ where: { companyId, routeDate: today } }),
    prisma.route.count({ where: { companyId, status: RouteStatus.in_progress } }),
    prisma.route.count({
      where: { companyId, routeDate: today, status: RouteStatus.completed },
    }),
    prisma.incident.count({
      where: {
        route: { companyId },
        status: { in: [IncidentStatus.open, IncidentStatus.in_progress] },
      },
    }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    subscription: subscription
      ? {
          planName: subscription.plan.name,
          status: subscription.status,
          renewalDate: subscription.renewalDate,
          maxDrivers: subscription.plan.maxDrivers,
        }
      : null,
    credits: {
      total: (creditBalance?.planCredits ?? 0) + (creditBalance?.extraCredits ?? 0),
      planCredits: creditBalance?.planCredits ?? 0,
      extraCredits: creditBalance?.extraCredits ?? 0,
    },
    drivers: {
      total: driversTotal,
      available: driversAvailable,
    },
    orders: {
      pending: ordersPending,
      urgentPending: ordersUrgent,
    },
    today: {
      routes: routesToday,
      active: routesActive,
      completed: routesCompletedToday,
    },
    incidents: { open: incidentsOpen },
    month: monthSummary,
  };
}
