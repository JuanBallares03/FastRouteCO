import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { isOfflineError, routesApi } from '@/services/routes-api';
import { enqueueLocation } from './offline-queue';
import type { DriverRoute, LocationSample } from './types';

export function useRouteTracking(route: DriverRoute | null) {
  const [trackingRouteId, setTrackingRouteId] = useState<string | null>(null);
  const routeId = route?.id ?? null;
  const isInProgress = route?.status === 'in_progress';
  const isTracking = isInProgress && trackingRouteId === routeId;

  useEffect(() => {
    if (!routeId || !isInProgress) {
      return;
    }

    let subscription: Location.LocationSubscription | null = null;
    let isActive = true;

    void (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted' || !isActive) {
        setTrackingRouteId((current) => (current === routeId ? null : current));
        return;
      }

      subscription = await Location.watchPositionAsync(
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
        () => setTrackingRouteId((current) => (current === routeId ? null : current))
      );

      if (isActive) {
        setTrackingRouteId(routeId);
      } else {
        subscription.remove();
      }
    })();

    return () => {
      isActive = false;
      subscription?.remove();
    };
  }, [routeId, isInProgress]);

  return { isTracking };
}
