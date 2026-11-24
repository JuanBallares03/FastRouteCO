import { Alert, PermissionsAndroid, Platform } from 'react-native';

// Android 13 (API 33) introduced the runtime POST_NOTIFICATIONS permission. Without it the
// location foreground service still runs, but its notification is hidden, so the driver
// cannot see that the route is being tracked (RF13, RF24, RNF10).
const NOTIFICATION_PERMISSION_MIN_SDK = 33;

function needsNotificationPermission(): boolean {
  return Platform.OS === 'android' && Number(Platform.Version) >= NOTIFICATION_PERMISSION_MIN_SDK;
}

function confirmNotificationPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Aviso de recorrido',
      'Mientras tu ruta esté en curso, FastRouteCO registra tu ubicación y te lo muestra con una notificación fija. Permite las notificaciones para que siempre sepas cuándo se está registrando tu recorrido.',
      [
        { text: 'Ahora no', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continuar', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

export async function hasTrackingNotificationPermission(): Promise<boolean> {
  if (!needsNotificationPermission()) {
    return true;
  }

  try {
    return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch {
    return false;
  }
}

// Never throws: the route starts whatever the driver answers, because tracking does not
// depend on this permission.
export async function requestTrackingNotificationPermission(): Promise<boolean> {
  if (!needsNotificationPermission()) {
    return true;
  }

  try {
    if (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)) {
      return true;
    }

    if (!(await confirmNotificationPermission())) {
      return false;
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}
