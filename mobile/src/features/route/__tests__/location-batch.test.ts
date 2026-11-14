import {
  persistLocationBatch,
  toLocationSamples,
  type CapturedLocation,
  type LocationBatchDependencies,
} from '../location-batch';
import type { AuthTokens } from '../../auth/types';

const tokens: AuthTokens = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
};

function capturedLocation(
  latitude: number,
  longitude: number,
  timestamp: number
): CapturedLocation {
  return { coords: { latitude, longitude }, timestamp };
}

function createDependencies(
  overrides: Partial<LocationBatchDependencies> = {}
): LocationBatchDependencies {
  return {
    getActiveRouteId: jest.fn(async () => 'route-1'),
    saveLocations: jest.fn(async () => undefined),
    loadTokens: jest.fn(async () => tokens),
    applyTokens: jest.fn(),
    syncOfflineQueue: jest.fn(async () => ({})),
    ...overrides,
  };
}

const capturedAt = Date.UTC(2026, 10, 13, 12, 0, 0);

describe('location batch', () => {
  it('uses the real capture timestamp and coordinates of each point', () => {
    const samples = toLocationSamples([capturedLocation(4.4389, -75.2322, capturedAt)]);

    expect(samples).toEqual([
      {
        latitude: 4.4389,
        longitude: -75.2322,
        capturedAt: new Date(capturedAt).toISOString(),
        isOffline: false,
      },
    ]);
  });

  it('ignores points with invalid coordinates or timestamp', () => {
    const samples = toLocationSamples([
      capturedLocation(Number.NaN, -75.2322, capturedAt),
      capturedLocation(4.4389, Number.POSITIVE_INFINITY, capturedAt),
      capturedLocation(4.4389, -75.2322, Number.NaN),
    ]);

    expect(samples).toEqual([]);
  });

  it('does nothing when there is no active route', async () => {
    const dependencies = createDependencies({
      getActiveRouteId: jest.fn(async () => null),
    });

    const result = await persistLocationBatch(
      [capturedLocation(4.4389, -75.2322, capturedAt)],
      dependencies
    );

    expect(result).toEqual({ routeId: null, saved: 0, synced: false });
    expect(dependencies.saveLocations).not.toHaveBeenCalled();
    expect(dependencies.syncOfflineQueue).not.toHaveBeenCalled();
  });

  it('saves points to the queue and syncs with the stored token', async () => {
    const dependencies = createDependencies();

    const result = await persistLocationBatch(
      [capturedLocation(4.4389, -75.2322, capturedAt)],
      dependencies
    );

    expect(result).toEqual({ routeId: 'route-1', saved: 1, synced: true });
    expect(dependencies.saveLocations).toHaveBeenCalledWith('route-1', [
      {
        latitude: 4.4389,
        longitude: -75.2322,
        capturedAt: new Date(capturedAt).toISOString(),
        isOffline: false,
      },
    ]);
    expect(dependencies.applyTokens).toHaveBeenCalledWith(tokens);
    expect(dependencies.syncOfflineQueue).toHaveBeenCalledTimes(1);
  });

  it('keeps the points queued when there is no stored token', async () => {
    const dependencies = createDependencies({
      loadTokens: jest.fn(async () => null),
    });

    const result = await persistLocationBatch(
      [capturedLocation(4.4389, -75.2322, capturedAt)],
      dependencies
    );

    expect(result).toEqual({ routeId: 'route-1', saved: 1, synced: false });
    expect(dependencies.saveLocations).toHaveBeenCalledTimes(1);
    expect(dependencies.syncOfflineQueue).not.toHaveBeenCalled();
  });

  it('keeps the points queued when synchronization fails', async () => {
    const dependencies = createDependencies({
      syncOfflineQueue: jest.fn(async () => {
        throw new Error('offline');
      }),
    });

    const result = await persistLocationBatch(
      [capturedLocation(4.4389, -75.2322, capturedAt)],
      dependencies
    );

    expect(result).toEqual({ routeId: 'route-1', saved: 1, synced: false });
  });
});
