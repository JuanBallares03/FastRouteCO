import { renderHook, waitFor } from '@testing-library/react-native';
import {
  requestBackgroundLocationPermission,
  requestForegroundLocationPermission,
  startBackgroundTracking,
  stopBackgroundTracking,
} from '../background-location';
import type { DriverRoute } from '../types';
import { useRouteTracking } from '../use-route-tracking';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  watchPositionAsync: jest.fn(),
}));

jest.mock('../api', () => ({
  isOfflineError: jest.fn(() => false),
  routesApi: { sendLocations: jest.fn() },
}));

jest.mock('../offline-queue', () => ({ enqueueLocation: jest.fn() }));

jest.mock('../background-location', () => ({
  requestForegroundLocationPermission: jest.fn(),
  requestBackgroundLocationPermission: jest.fn(),
  startBackgroundTracking: jest.fn(),
  stopBackgroundTracking: jest.fn(),
}));

const route = { id: 'route-a', status: 'in_progress' } as DriverRoute;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(requestForegroundLocationPermission).mockResolvedValue(true);
  jest.mocked(requestBackgroundLocationPermission).mockResolvedValue(true);
  jest.mocked(startBackgroundTracking).mockResolvedValue(undefined);
  jest.mocked(stopBackgroundTracking).mockResolvedValue(undefined);
});

describe('useRouteTracking', () => {
  it('tracks a route in progress', async () => {
    const { result } = await renderHook(() => useRouteTracking(route, false));

    await waitFor(() => expect(result.current.mode).toBe('background'));
    expect(startBackgroundTracking).toHaveBeenCalledWith('route-a');
  });

  it('stops tracking a route kept only for its pending actions', async () => {
    const { result } = await renderHook(() => useRouteTracking(route, false, true));

    await waitFor(() => expect(stopBackgroundTracking).toHaveBeenCalled());
    expect(startBackgroundTracking).not.toHaveBeenCalled();
    expect(result.current.mode).toBe('inactive');
  });
});
