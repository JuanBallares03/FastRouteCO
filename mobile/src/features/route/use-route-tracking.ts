import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { isOfflineError, routesApi } from './api';
import {
  requestBackgroundLocationPermission,
  requestForegroundLocationPermission,
  startBackgroundTracking,
  stopBackgroundTracking,
} from './background-location';
import { enqueueLocation } from './offline-queue';
import type { DriverRoute, LocationSample } from './types';

export type TrackingMode = 'inactive' | 'background' | 'foreground' | 'denied';

function trackForeground(
  routeId: string,
  onError: () => void
): Promise<Location.LocationSubscription> {
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 0,
    },
    (position) => {
      const sample: LocationSample = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        capturedAt: new Date(position.timestamp).toISOString(),
        isOffline: false,
      };

      void (async () => {
        try {
          await routesApi.sendLocations(routeId, [sample]);
        } catch (error) {
          if (isOfflineError(error)) {
            await enqueueLocation(routeId, { ...sample, isOffline: true });
          }
        }
      })();
    },
    onError
  );
}

export function useRouteTracking(route: DriverRoute | null, isRouteLoading: boolean) {
  const [tracking, setTracking] = useState<{ routeId: string | null; mode: TrackingMode }>({
    routeId: null,
    mode: 'inactive',
  });
  const routeId = route?.id ?? null;
  const isInProgress = route?.status === 'in_progress';
  const mode: TrackingMode =
    !isRouteLoading && isInProgress && tracking.routeId === routeId
      ? tracking.mode
      : 'inactive';

  useEffect(() => {
    if (isRouteLoading) {
      return;
    }

    if (!routeId || !isInProgress) {
      void stopBackgroundTracking().catch(() => undefined);
      return;
    }

    let isActive = true;
    let subscription: Location.LocationSubscription | null = null;

    void (async () => {
      const hasForegroundPermission = await requestForegroundLocationPermission();
      if (!isActive) {
        return;
      }

      if (!hasForegroundPermission) {
        setTracking({ routeId, mode: 'denied' });
        return;
      }

      const hasBackgroundPermission = await requestBackgroundLocationPermission();
      if (!isActive) {
        return;
      }

      if (hasBackgroundPermission) {
        try {
          await startBackgroundTracking(routeId);
          if (isActive) {
            setTracking({ routeId, mode: 'background' });
          }
          return;
        } catch {
          // Fall back to foreground tracking when the background service cannot start.
        }
      }

      subscription = await trackForeground(routeId, () => {
        if (isActive) {
          setTracking({ routeId, mode: 'denied' });
        }
      });

      if (isActive) {
        setTracking({ routeId, mode: 'foreground' });
      } else {
        subscription.remove();
      }
    })();

    return () => {
      isActive = false;
      subscription?.remove();
    };
  }, [routeId, isInProgress, isRouteLoading]);

  return {
    mode,
    isTracking: mode === 'background' || mode === 'foreground',
    isBackgroundTracking: mode === 'background',
  };
}
