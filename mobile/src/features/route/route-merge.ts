import type { DriverRoute, RouteStop, StopStatus } from './types';

const stopRank: Record<StopStatus, number> = {
  pending: 0,
  arrived: 1,
  completed: 2,
};

function mergeStop(
  previous: RouteStop,
  incoming: RouteStop,
  pendingStopIds: ReadonlySet<string>
): RouteStop {
  // Local progress is only kept while its offline action is still queued.
  // Once the action syncs or is dropped, the server state wins.
  if (
    !pendingStopIds.has(previous.id) ||
    stopRank[previous.status] <= stopRank[incoming.status]
  ) {
    return incoming;
  }

  const evidencePhotos = [...incoming.evidencePhotos];
  for (const photo of previous.evidencePhotos) {
    if (!evidencePhotos.some((item) => item.id === photo.id)) {
      evidencePhotos.push(photo);
    }
  }

  return {
    ...incoming,
    status: previous.status,
    arrivedAt: previous.arrivedAt ?? incoming.arrivedAt,
    isGeofenceVerified: previous.isGeofenceVerified || incoming.isGeofenceVerified,
    confirmedAt: previous.confirmedAt ?? incoming.confirmedAt,
    syncedAt: previous.syncedAt ?? incoming.syncedAt,
    notes: previous.notes ?? incoming.notes,
    recipientName: previous.recipientName ?? incoming.recipientName,
    evidencePhotos,
  };
}

export function mergeRouteUpdate(
  previous: DriverRoute | null,
  incoming: DriverRoute | null,
  pendingStopIds: ReadonlySet<string>
): DriverRoute | null {
  if (!incoming) return null;
  if (!previous || previous.id !== incoming.id) return incoming;

  const previousStops = new Map(previous.stops.map((stop) => [stop.id, stop]));

  return {
    ...incoming,
    stops: incoming.stops.map((stop) => {
      const before = previousStops.get(stop.id);
      return before ? mergeStop(before, stop, pendingStopIds) : stop;
    }),
  };
}
