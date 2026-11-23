import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AxiosError, type AxiosResponse } from 'axios';
import { AppState, type AppStateStatus } from 'react-native';
import { getRealtimeSocket } from '@/services/realtime';
import { DRIVER_ROUTE_UPDATED_EVENT } from '@/services/realtime-events';
import { routesApi } from '../api';
import { getPendingActionSummary } from '../offline-queue';
import { loadCachedRoute, saveCachedRoute } from '../route-cache';
import {
  ROUTE_OFFLINE_MESSAGE,
  ROUTE_PENDING_CHANGES_MESSAGE,
  ROUTE_PENDING_UNSYNCABLE_MESSAGE,
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
    getRoute: jest.fn(),
  },
}));

jest.mock('../offline-queue', () => ({
  getPendingActionSummary: jest.fn(),
}));

jest.mock('../route-cache', () => ({
  loadCachedRoute: jest.fn(),
  saveCachedRoute: jest.fn(),
}));

const getTodayRoute = routesApi.getTodayRoute as jest.Mock;
const getRoute = routesApi.getRoute as jest.Mock;
const getRealtimeSocketMock = getRealtimeSocket as jest.Mock;
const getPendingActionSummaryMock = getPendingActionSummary as jest.Mock;
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

function pendingSummary(count: number, routeIds: string[] = [], stopIds: string[] = []) {
  return { count, routeIds, stopIds };
}

let appStateHandlers: ((state: AppStateStatus) => void)[];

beforeEach(() => {
  jest.clearAllMocks();

  getRealtimeSocketMock.mockReturnValue(makeSocket());
  getPendingActionSummaryMock.mockResolvedValue(pendingSummary(0));
  getRoute.mockResolvedValue(makeRoute('route-a'));
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
    getPendingActionSummaryMock.mockResolvedValue(pendingSummary(2, ['route-a'], ['stop-1']));

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

  it('warns that pending actions cannot sync when the route is no longer assigned', async () => {
    getTodayRoute
      .mockResolvedValueOnce(makeRoute('route-a'))
      .mockResolvedValueOnce(null);
    getPendingActionSummaryMock.mockResolvedValue(pendingSummary(1, ['route-a'], ['stop-1']));
    getRoute.mockRejectedValue(
      new AxiosError('Not Found', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 404,
        data: { code: 'ROUTE_NOT_FOUND' },
      } as AxiosResponse)
    );

    const { result } = await renderHook(() => useDriverRoute());

    await waitFor(() => expect(result.current.route?.id).toBe('route-a'));

    await act(async () => {
      emitSocketEvent(DRIVER_ROUTE_UPDATED_EVENT);
    });

    await waitFor(() =>
      expect(result.current.error).toBe(ROUTE_PENDING_UNSYNCABLE_MESSAGE)
    );
    expect(getRoute).toHaveBeenCalledWith('route-a');
    expect(result.current.route?.id).toBe('route-a');
  });

  it('keeps the sync warning when the route cannot be checked', async () => {
    getTodayRoute
      .mockResolvedValueOnce(makeRoute('route-a'))
      .mockResolvedValueOnce(null);
    getPendingActionSummaryMock.mockResolvedValue(pendingSummary(1, ['route-a'], ['stop-1']));
    getRoute.mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));

    const { result } = await renderHook(() => useDriverRoute());

    await waitFor(() => expect(result.current.route?.id).toBe('route-a'));

    await act(async () => {
      emitSocketEvent(DRIVER_ROUTE_UPDATED_EVENT);
    });

    await waitFor(() =>
      expect(result.current.error).toBe(ROUTE_PENDING_CHANGES_MESSAGE)
    );
  });

  it('does not check the previous route when pending actions belong to another route', async () => {
    getTodayRoute
      .mockResolvedValueOnce(makeRoute('route-a'))
      .mockResolvedValueOnce(makeRoute('route-b', 'stop-2'));
    getPendingActionSummaryMock.mockResolvedValue(pendingSummary(1, ['route-old'], []));

    const { result } = await renderHook(() => useDriverRoute());

    await waitFor(() => expect(result.current.route?.id).toBe('route-a'));

    await act(async () => {
      emitSocketEvent(DRIVER_ROUTE_UPDATED_EVENT);
    });

    await waitFor(() =>
      expect(result.current.error).toBe(ROUTE_PENDING_CHANGES_MESSAGE)
    );
    expect(getRoute).not.toHaveBeenCalled();
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

  it('shows the server stop state once the queued action is dropped', async () => {
    const serverRoute = makeRoute('route-a');
    serverRoute.stops = [{ ...serverRoute.stops[0], status: 'arrived' }];
    getTodayRoute.mockResolvedValue(serverRoute);

    const { result } = await renderHook(() => useDriverRoute());

    await waitFor(() => expect(result.current.route?.stops[0].status).toBe('arrived'));

    await act(async () => {
      result.current.updateRoute((current) =>
        current
          ? { ...current, stops: [{ ...current.stops[0], status: 'completed' }] }
          : current
      );
    });

    getPendingActionSummaryMock.mockResolvedValue(pendingSummary(1, ['route-a'], ['stop-1']));
    await act(async () => {
      await result.current.refresh('manual');
    });
    expect(result.current.route?.stops[0].status).toBe('completed');

    getPendingActionSummaryMock.mockResolvedValue(pendingSummary(0));
    await act(async () => {
      await result.current.refresh('manual');
    });
    expect(result.current.route?.stops[0].status).toBe('arrived');
  });
});
