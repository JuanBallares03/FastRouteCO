import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { Coordinates } from './types';

export interface CurrentLocationState {
  location: Coordinates | null;
  permissionDenied: boolean;
}

const INITIAL_STATE: CurrentLocationState = {
  location: null,
  permissionDenied: false,
};

export function useCurrentLocation(enabled: boolean): CurrentLocationState {
  const [state, setState] = useState<CurrentLocationState>(INITIAL_STATE);

  useEffect(() => {
    if (!enabled) return;

    let isActive = true;
    let subscription: Location.LocationSubscription | null = null;

    void (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!isActive) return;

      if (permission.status !== 'granted') {
        setState({ location: null, permissionDenied: true });
        return;
      }

      try {
        const lastKnown = await Location.getLastKnownPositionAsync({
          maxAge: 30000,
          requiredAccuracy: 100,
        });

        if (isActive && lastKnown) {
          setState({
            location: {
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
            },
            permissionDenied: false,
          });
        }

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
            distanceInterval: 5,
          },
          (position) => {
            if (!isActive) return;

            setState({
              location: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              },
              permissionDenied: false,
            });
          }
        );

        if (!isActive) {
          subscription.remove();
        }
      } catch {
        if (isActive) {
          setState({ location: null, permissionDenied: false });
        }
      }
    })();

    return () => {
      isActive = false;
      subscription?.remove();
    };
  }, [enabled]);

  return state;
}
