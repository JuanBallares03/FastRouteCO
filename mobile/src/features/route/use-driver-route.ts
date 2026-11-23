import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getRealtimeSocket } from '@/services/realtime';
import { DRIVER_ROUTE_UPDATED_EVENT } from '@/services/realtime-events';
import { routesApi } from './api';
import { getPendingActionSummary } from './offline-queue';
import { loadCachedRoute, saveCachedRoute } from './route-cache';
import { mergeRouteUpdate } from './route-merge';
import type { DriverRoute } from './types';

export const ROUTE_OFFLINE_MESSAGE =
  'Sin conexión. Estás viendo la última ruta guardada en este teléfono.';
export const ROUTE_LOAD_FAILED_MESSAGE =
  'No pudimos cargar tu ruta. Verifica tu conexión e intenta de nuevo.';
export const ROUTE_PENDING_CHANGES_MESSAGE =
  'Tu ruta cambió en la empresa, pero tienes acciones pendientes de sincronizar. Sincroniza para no perderlas.';
export const ROUTE_UPDATED_MESSAGE = 'La empresa actualizó tu ruta.';

export type RouteRefreshReason = 'initial' | 'manual' | 'realtime' | 'foreground';

type RouteUpdater =
  | DriverRoute
  | null
  | ((current: DriverRoute | null) => DriverRoute | null);

interface RefreshResult {
  ok: boolean;
  keptLocal: boolean;
}

export function useDriverRoute() {
  const [route, setRouteState] = useState<DriverRoute | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const routeRef = useRef<DriverRoute | null>(null);
  const inFlightRef = useRef<Promise<RefreshResult> | null>(null);
  const queuedRef = useRef(false);

  const updateRoute = useCallback((next: RouteUpdater) => {
    const value = typeof next === 'function' ? next(routeRef.current) : next;
    routeRef.current = value;
    setRouteState(value);
  }, []);

  const performRefresh = useCallback(async (): Promise<RefreshResult> => {
    try {
      const fetched = await routesApi.getTodayRoute();
      const pending = await getPendingActionSummary();

      const routeChangedAway =
        routeRef.current !== null &&
        (fetched === null || fetched.id !== routeRef.current.id);

      if (routeChangedAway && pending.count > 0) {
        setIsOffline(false);
        setError(ROUTE_PENDING_CHANGES_MESSAGE);
        return { ok: true, keptLocal: true };
      }

      const merged = mergeRouteUpdate(routeRef.current, fetched, new Set(pending.stopIds));
      routeRef.current = merged;
      setRouteState(merged);
      await saveCachedRoute(merged);
      setIsOffline(false);
      setError(null);
      return { ok: true, keptLocal: false };
    } catch {
      setIsOffline(true);
      if (routeRef.current) {
        setError(ROUTE_OFFLINE_MESSAGE);
      }
      return { ok: false, keptLocal: false };
    }
  }, []);

  const runRefresh = useCallback(async (): Promise<RefreshResult> => {
    if (inFlightRef.current) {
      queuedRef.current = true;
      return inFlightRef.current;
    }

    const task = (async () => {
      let result = await performRefresh();
      while (queuedRef.current) {
        queuedRef.current = false;
        result = await performRefresh();
      }
      return result;
    })();

    inFlightRef.current = task;
    try {
      return await task;
    } finally {
      inFlightRef.current = null;
    }
  }, [performRefresh]);

  const refresh = useCallback(
    async (reason: RouteRefreshReason = 'manual') => {
      const result = await runRefresh();

      if (reason === 'realtime') {
        if (result.ok && !result.keptLocal) {
          setNotice(ROUTE_UPDATED_MESSAGE);
        } else if (!result.ok && routeRef.current) {
          setError(ROUTE_OFFLINE_MESSAGE);
        }
      }

      return result;
    },
    [runRefresh]
  );

  const loadToday = useCallback(async () => {
    const result = await runRefresh();

    if (!result.ok && routeRef.current === null) {
      const cached = await loadCachedRoute();
      if (cached) {
        routeRef.current = cached;
        setRouteState(cached);
        setIsOffline(true);
        setError(ROUTE_OFFLINE_MESSAGE);
      } else {
        setError(ROUTE_LOAD_FAILED_MESSAGE);
      }
    }

    setIsLoading(false);
  }, [runRefresh]);

  useEffect(() => {
    void (async () => {
      await loadToday();
    })();
  }, [loadToday]);

  useEffect(() => {
    const socket = getRealtimeSocket();
    if (!socket) return;

    const handleRouteUpdated = () => {
      void refresh('realtime');
    };

    socket.on(DRIVER_ROUTE_UPDATED_EVENT, handleRouteUpdated);

    return () => {
      socket.off(DRIVER_ROUTE_UPDATED_EVENT, handleRouteUpdated);
    };
  }, [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh('foreground');
      }
    });

    return () => subscription.remove();
  }, [refresh]);

  return {
    route,
    updateRoute,
    isLoading,
    isOffline,
    error,
    setError,
    notice,
    setNotice,
    loadToday,
    refresh,
  };
}
