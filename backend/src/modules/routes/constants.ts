import { RouteStatus } from '@prisma/client';

export const MAX_ROUTE_STOPS = 10;

export const ACTIVE_ROUTE_STATUSES: RouteStatus[] = [
  RouteStatus.created,
  RouteStatus.optimized,
  RouteStatus.in_progress,
];
