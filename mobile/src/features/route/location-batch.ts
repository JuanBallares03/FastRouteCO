import type { AuthTokens } from '../auth/types';
import type { LocationSample } from './types';

export interface CapturedLocation {
  coords: {
    latitude: number;
    longitude: number;
  };
  timestamp: number;
}

export interface LocationBatchDependencies {
  getActiveRouteId: () => Promise<string | null>;
  saveLocations: (routeId: string, locations: LocationSample[]) => Promise<void>;
  loadTokens: () => Promise<AuthTokens | null>;
  applyTokens: (tokens: AuthTokens) => void;
  syncOfflineQueue: () => Promise<unknown>;
}

export interface LocationBatchResult {
  routeId: string | null;
  saved: number;
  synced: boolean;
}

export function toLocationSamples(locations: CapturedLocation[]): LocationSample[] {
  return locations.flatMap((location) => {
    const { latitude, longitude } = location.coords;
    const { timestamp } = location;

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !Number.isFinite(timestamp)
    ) {
      return [];
    }

    return [
      {
        latitude,
        longitude,
        capturedAt: new Date(timestamp).toISOString(),
        isOffline: false,
      },
    ];
  });
}

export async function persistLocationBatch(
  locations: CapturedLocation[],
  dependencies: LocationBatchDependencies
): Promise<LocationBatchResult> {
  const routeId = await dependencies.getActiveRouteId();

  if (!routeId) {
    return { routeId: null, saved: 0, synced: false };
  }

  const samples = toLocationSamples(locations);

  if (samples.length === 0) {
    return { routeId, saved: 0, synced: false };
  }

  await dependencies.saveLocations(routeId, samples);

  const tokens = await dependencies.loadTokens();

  if (!tokens) {
    return { routeId, saved: samples.length, synced: false };
  }

  dependencies.applyTokens(tokens);

  try {
    await dependencies.syncOfflineQueue();
    return { routeId, saved: samples.length, synced: true };
  } catch {
    return { routeId, saved: samples.length, synced: false };
  }
}
