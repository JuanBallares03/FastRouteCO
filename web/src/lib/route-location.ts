// Driver positions reach the panel from two sources: the latest location
// endpoint and `route:location` socket events. They can arrive in any order,
// so the newest position by capture time always wins (RF08, RF13).

export interface TrackedLocation {
  latitude: number;
  longitude: number;
  capturedAt?: string | null;
}

function captureTime(location: TrackedLocation): number | null {
  if (!location.capturedAt) return null;
  const time = new Date(location.capturedAt).getTime();
  return Number.isNaN(time) ? null : time;
}

/** Returns the newer of two positions. A position without a valid capture time loses to one that has it. */
export function pickLatestLocation<T extends TrackedLocation>(
  current: T | null | undefined,
  incoming: T | null | undefined
): T | null {
  if (!incoming) return current ?? null;
  if (!current) return incoming;

  const currentTime = captureTime(current);
  const incomingTime = captureTime(incoming);
  if (incomingTime === null) return currentTime === null ? incoming : current;
  if (currentTime === null) return incoming;
  return incomingTime >= currentTime ? incoming : current;
}

/** Newest position of a batch, which may arrive unordered after an offline sync. */
export function latestFromBatch<T extends TrackedLocation>(
  locations: readonly T[] | null | undefined
): T | null {
  return (locations ?? []).reduce<T | null>(
    (latest, location) => pickLatestLocation(latest, location),
    null
  );
}

/**
 * Merges fetched positions into the current ones, keeping the newest per route.
 * Routes that are no longer active are dropped.
 */
export function mergeLocationsByRoute<T extends TrackedLocation>(
  current: Record<string, T>,
  fetched: Record<string, T | null | undefined>,
  activeRouteIds: readonly string[]
): Record<string, T> {
  const merged: Record<string, T> = {};
  for (const routeId of activeRouteIds) {
    const latest = pickLatestLocation(current[routeId], fetched[routeId]);
    if (latest) merged[routeId] = latest;
  }
  return merged;
}
