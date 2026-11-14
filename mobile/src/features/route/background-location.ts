import * as Location from 'expo-location';
import { Alert, Platform } from 'react-native';
import { clearActiveRouteId, setActiveRouteId } from './active-route';

export const LOCATION_TASK_NAME = 'fastrouteco-location';

const LOCATION_TASK_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.High,
  timeInterval: 5000,
  distanceInterval: 0,
  pausesUpdatesAutomatically: false,
  foregroundService: {
    notificationTitle: 'FastRouteCO está registrando tu recorrido',
    notificationBody: 'Tu ubicación se guarda para la ruta de hoy.',
    notificationColor: '#208AEF',
    killServiceOnDestroy: false,
  },
};

function confirmBackgroundPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Ubicación en segundo plano',
      'Para registrar todo tu recorrido mientras usas otras apps o con la pantalla apagada, FastRouteCO necesita acceso a tu ubicación en segundo plano. Si lo rechazas, el recorrido solo se registrará con la app abierta.',
      [
        { text: 'Ahora no', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continuar', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

export async function requestForegroundLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const response = await Location.requestForegroundPermissionsAsync();
  return response.status === 'granted';
}

export async function requestBackgroundLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const current = await Location.getBackgroundPermissionsAsync();
  if (current.status === 'granted') {
    return true;
  }

  if (!current.canAskAgain) {
    return false;
  }

  const confirmed = await confirmBackgroundPermission();
  if (!confirmed) {
    return false;
  }

  const response = await Location.requestBackgroundPermissionsAsync();
  return response.status === 'granted';
}

export async function startBackgroundTracking(routeId: string): Promise<void> {
  await setActiveRouteId(routeId);

  if (Platform.OS === 'web') {
    return;
  }

  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)) {
    return;
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, LOCATION_TASK_OPTIONS);
}

export async function stopBackgroundTracking(): Promise<void> {
  if (Platform.OS !== 'web') {
    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(
      () => false
    );

    if (started) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  }

  await clearActiveRouteId();
}
