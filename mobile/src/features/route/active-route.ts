import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACTIVE_ROUTE_KEY = 'fastroute.activeRouteId';

export async function setActiveRouteId(routeId: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  await SecureStore.setItemAsync(ACTIVE_ROUTE_KEY, routeId);
}

export async function getActiveRouteId(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  return SecureStore.getItemAsync(ACTIVE_ROUTE_KEY);
}

export async function clearActiveRouteId(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  await SecureStore.deleteItemAsync(ACTIVE_ROUTE_KEY);
}
