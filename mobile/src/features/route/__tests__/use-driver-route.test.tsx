import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { getRealtimeSocket } from '@/services/realtime';
import { DRIVER_ROUTE_UPDATED_EVENT } from '@/services/realtime-events';
import { routesApi } from '../api';
import { getPendingActionCount } from '../offline-queue';
import { loadCachedRoute, saveCachedRoute } from '../route-cache';
import {
  ROUTE_OFFLINE_MESSAGE,
  ROUTE_PENDING_CHANGES_MESSAGE,
  ROUTE_UPDATED_MESSAGE,
  useDriverRoute,
} from '../use-driver-route';
import type { DriverRoute, RouteStop } from '../types';

jest.mock('@/services/realtime', () => ({
  getRealtimeSocket: jest.fn(),
}));

jest.mock('../api', () => ({
  routesApi: {
    getTodayRoute: jest.fn(),
  },
}));

jest.mock('../offline-queue', () => ({
  getPendingActionCount: jest.fn(),
}));

jest.mock('../route-cache', () => ({
  loadCachedRoute: jest.fn(),
  saveCachedRoute: jest.fn(),
}));

const getTodayRoute = routesApi.getTodayRoute as jest.Mock;
const getRealtimeSocketMock = getRealtimeSocket as jest.Mock;
const getPendingActionCountMock = getPendingActionCount as jest.Mock;
const loadCachedRouteMock = loadCachedRoute as jest.Mock;
const saveCachedRouteMock = saveCachedRoute as jest.Mock;

type Listener = () => void;

let socketListeners: Record<string, Listener[]>;

function makeSocket() {
  socketListeners = {};
  return {
    on: jest.fn((event: string, handler: Listener) => {
      socketListeners[event] = [...(socketListeners[event] ?? []), handler];
    }),
    off: jest.fn((event: string, handler: Listener) => {
      socketListeners[event] = (socketListeners[event] ?? []).filter(
        (item) => item !== handler
      );
    }),
  };
}

function emitSocketEvent(event: string) {
  for (const listener of socketListeners[event] ?? []) {
    listener();
  }
}

function makeStop(id: string): RouteStop {
  return {
    id,
    routeId: 'route-a',
    sequence: 1,
    status: 'pending',
    arrivedAt: null,
    isGeofenceVerified: false,
    confirmedAt: null,
    syncedAt: null,
    notes: null,
    recipientName: null,
    order: null,
    student: null,
    evidencePhotos: [],
  };
}

function makeRoute(id: string, stopId = 'stop-1'): DriverRoute {
  return {
    id,
    companyId: 'company-1',
    driverId: 'driver-1',
    routeDate: '2026-11-21',
    status: 'in_progress',
    startLatitude: null,
    startLongitude: null,
    startedAt: '2026-11-21T12:00:00.000Z',
    endedAt: null,
    stops: [makeStop(stopId)],
  };
}

let appStateHandlers: ((state: AppStateStatus) => void)[];

beforeEach(() => {
  jest.clearAllMocks();

  getRealtimeSocketMock.mockReturnValue(makeSocket());
  getPendingActionCountMock.mockResolvedValue(0);
  loadCachedRouteMock.mockResolvedValue(null);
  saveCachedRouteMock.mockResolvedValue(undefined);

  appStateHandlers = [];
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_type: string, handler: (state: AppStateStatus) => void) => {
      appStateHandlers.push(handler);
      return { remove: jest.fn() } as never;
    });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useDriverRoute', () => {
  it('reloads the route when the targeted driver event arrives', async () => {
    getTodayRoute
      .mockResolvedValueOnce(makeRoute('route-a'))
      .mockResolvedValueOnce(makeRoute('route-b'));

    const { result } = await renderHook(() => useDriverRoute());

    await waitFor(() => expect(result.current.route?.id).toBe('route-a'));

    await act(async () => {
      emitSocketEvent(DRIVER_ROUTE_UPDATED_EVENT);
    });

    await waitFor(() => expect(result.current.route?.id).toBe('route-b'));
    expect(getTodayRoute).toHaveBeenCalledTimes(2);
    expect(result.current.notice).toBe(ROUTE_UPDATED_MESSAGE);
  });

  it('reloads the route when the app returns to the foreground', async () => {
    getTodayRoute
      .mockResolvedValueOnce(makeRoute('route-a'))
      .mockResolvedValueOnce(makeRoute('route-b'));

    const { result } = await renderHook(() => useDriverRoute());

    await waitFor(() => expect(result.current.route?.id).toBe('route-a'));

    await act(async () => {
      for (const handler of appStateHandlers) {
        handler('active');
      }
    });

    await waitFor(() => expect(result.current.route?.id).toBe('route-b'));
    expect(getTodayRoute).toHaveBeenCalledTimes(2);
  });

  it('reloads the route on pull-to-refresh', async () => {
    getTodayRoute
      .mockResolvedValueOnce(makeRoute('route-a'))
      .mockResolvedValueOnce(makeRoute('route-b'));

    const { result } = await renderHook(() => useDriverRoute());

    await waitFor(() => expect(result.current.route?.id).toBe('route-a'));

    await act(async () => {
      await result.current.refresh('manual');
    });

    expect(result.current.route?.id).toBe('route-b');
    expect(getTodayRoute).toHaveBeenCalledTimes(2);
  });

  it('groups simultaneous refreshes into a single request', async () => {
    let resolveSecond: (route: DriverRoute | null) => void = () => undefined;
    const secondRequest = new Promise<DriverRoute | null>((resolve) => {
      resolveSecond = resolve;
    });

    getTodayRoute
      .mockResolvedValueOnce(makeRoute('route-a'))
      .mockReturnValueOnce(secondRequest)
      .mockResolvedValue(makeRoute('route-b'));

    const { result } = await renderHook(() => useDriverRoute());

    await waitFor(() => expect(result.current.route?.id).toBe('route-a'));

    await act(async () => {
      emitSocketEvent(DRIVER_ROUTE_UPDATED_EVENT);
      emitSocketEvent(DRIVER_ROUTE_UPDATED_EVENT);
      void result.current.refresh('manual');
    });

    expect(getTodayRoute).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveSecond(makeRoute('route-b'));
      await secondRequest;
    });

    await waitFor(() => expect(result.current.route?.id).toBe('route-b'));
    expect(getTodayRoute).toHaveBeenCalledTimes(3);
  });

  it('shows the cached route when the first load fails', async () => {
    getTodayRoute.mockRejectedValue(new Error('offline'));
    loadCachedRouteMock.mockResolvedValue(makeRoute('cached-route'));

    const { result } = await renderHook(() => useDriverRoute());

    await waitFor(() => expect(result.current.route?.id).toBe('cached-route'));
    expect(result.current.isOffline).toBe(true);
    expect(result.current.error).toBe(ROUTE_OFFLINE_MESSAGE);
  });

  it('keeps the current route when a later refresh fails', async () => {
    getTodayRoute
      .mockResolvedValueOnce(makeRoute('route-a'))
      .mockRejectedValueOnce(new Error('offline'));

    const { result } = await renderHook(() => useDriverRoute());

    await waitFor(() => expect(result.current.route?.id).toBe('route-a'));

    await act(async () => {
      emitSocketEvent(DRIVER_ROUTE_UPDATED_EVENT);
    });

    await waitFor(() => expect(result.current.error).toBe(ROUTE_OFFLINE_MESSAGE));
    expect(result.current.route?.id).toBe('route-a');
    expect(saveCachedRouteMock).not.toHaveBeenCalledWith(null);
  });

  it('keeps local changes when the server no longer returns the route', async () => {
    getTodayRoute
      .mockResolvedValueOnce(makeRoute('route-a'))
      .mockResolvedValueOnce(null);
    getPendingActionCountMock.mockResolvedValue(2);

    const { result } = await renderHook(() => useDriverRoute());

    await waitFor(() => expect(result.current.route?.id).toBe('route-a'));

    await act(async () => {
      emitSocketEvent(DRIVER_ROUTE_UPDATED_EVENT);
    });

    await waitFor(() =>
      expect(result.current.error).toBe(ROUTE_PENDING_CHANGES_MESSAGE)
    );
    expect(result.current.route?.id).toBe('route-a');
    expect(saveCachedRouteMock).not.toHaveBeenCalledWith(null);
  });

  it('clears the route when the server no longer returns one and nothing is pending', async () => {
    getTodayRoute
      .mockResolvedValueOnce(makeRoute('route-a'))
      .mockResolvedValueOnce(null);

    const { result } = await renderHook(() => useDriverRoute());

    await waitFor(() => expect(result.current.route?.id).toBe('route-a'));

    await act(async () => {
      emitSocketEvent(DRIVER_ROUTE_UPDATED_EVENT);
    });

    await waitFor(() => expect(result.current.route).toBeNull());
    expect(saveCachedRouteMock).toHaveBeenCalledWith(null);
  });
});
