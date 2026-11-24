import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { hasTrackingNotificationPermission } from './notification-permission';

export type NotificationPermissionState = 'unknown' | 'granted' | 'denied';

function toState(granted: boolean): NotificationPermissionState {
  return granted ? 'granted' : 'denied';
}

// Checks, without asking, whether the tracking notification can be shown. It checks again
// when the app returns to the foreground, so the notice goes away after the driver turns
// notifications on in the system settings (RNF10).
export function useTrackingNotificationPermission() {
  const [state, setState] = useState<NotificationPermissionState>('unknown');

  const refresh = useCallback(async () => {
    setState(toState(await hasTrackingNotificationPermission()));
  }, []);

  useEffect(() => {
    let isActive = true;
    const check = () => {
      void hasTrackingNotificationPermission().then((granted) => {
        if (isActive) {
          setState(toState(granted));
        }
      });
    };

    check();
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') {
        check();
      }
    });

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, []);

  return { state, refresh };
}
