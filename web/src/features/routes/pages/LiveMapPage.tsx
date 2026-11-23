import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  RouteMap,
  type DriverLocationMarker,
  type RouteMapStop,
} from '@/components/map/RouteMap';
import { routeApi } from '@/features/routes/api';
import { getRealtimeSocket, releaseRealtimeSocket } from '@/services/socket';
import { ROUTE_STATUS_LABELS, routeStatusVariant } from '@/lib/order-utils';
import {
  latestFromBatch,
  mergeLocationsByRoute,
  pickLatestLocation,
  type TrackedLocation,
} from '@/lib/route-location';

interface RouteStop {
  id: string;
  sequence: number;
  status: string;
  order?: {
    id: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
  student?: {
    id: string;
    fullName: string;
    pickupAddress: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
}

interface LiveRoute {
  id: string;
  routeDate: string;
  status: string;
  driverId: string;
  driver?: {
    user?: { fullName?: string | null } | null;
  } | null;
  stops: RouteStop[];
}

type LocationsByRoute = Record<string, TrackedLocation>;

export function LiveMapPage() {
  const location = useLocation();
  const basePath = location.pathname.startsWith('/supervisor')
    ? '/supervisor'
    : '/company';
  const [routes, setRoutes] = useState<LiveRoute[]>([]);
  const [locations, setLocations] = useState<LocationsByRoute>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRoutes = useCallback(async () => {
    try {
      const response = await routeApi.getRoutes({
        status: 'in_progress',
        pageSize: 100,
      });
      const items = (response.data?.items ?? []) as LiveRoute[];
      setRoutes(items);
      setError(null);

      const latest = await Promise.all(
        items.map(async (route) => {
          try {
            const response = await routeApi.getLatestLocation(route.id);
            const data = response.data as TrackedLocation | null;
            return data ? ([route.id, data] as const) : null;
          } catch {
            return null;
          }
        })
      );

      // Merge instead of replacing so a newer socket position is not lost on reload.
      const fetched = Object.fromEntries(
        latest.filter((entry) => entry !== null)
      ) as LocationsByRoute;
      setLocations((current) =>
        mergeLocationsByRoute(
          current,
          fetched,
          items.map((route) => route.id)
        )
      );
    } catch {
      setError('No se pudo cargar el mapa en vivo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  useEffect(() => {
    const socket = getRealtimeSocket();
    if (!socket) return;

    const refresh = () => loadRoutes();

    const onLocation = (payload: {
      routeId?: string;
      locations?: TrackedLocation[];
    }) => {
      const routeId = payload.routeId;
      const incoming = latestFromBatch(payload.locations);
      if (!routeId || !incoming) return;
      setLocations((current) => {
        const latest = pickLatestLocation(current[routeId], {
          latitude: incoming.latitude,
          longitude: incoming.longitude,
          capturedAt: incoming.capturedAt,
        });
        return latest ? { ...current, [routeId]: latest } : current;
      });
    };

    socket.on('route:location', onLocation);
    socket.on('route:status', refresh);
    socket.on('route:reassigned', refresh);
    socket.on('route:stop-status', refresh);
    socket.on('route:stop-reassigned', refresh);

    return () => {
      socket.off('route:location', onLocation);
      socket.off('route:status', refresh);
      socket.off('route:reassigned', refresh);
      socket.off('route:stop-status', refresh);
      socket.off('route:stop-reassigned', refresh);
      releaseRealtimeSocket();
    };
  }, [loadRoutes]);

  const mapStops = useMemo<RouteMapStop[]>(
    () =>
      routes.flatMap((route) =>
        route.stops.map((stop) => {
          const source = stop.order ?? stop.student;
          return {
            id: `${route.id}-${stop.id}`,
            sequence: stop.sequence,
            latitude: source?.latitude ?? null,
            longitude: source?.longitude ?? null,
            label:
              stop.order?.address ??
              stop.student?.pickupAddress ??
              `Parada ${stop.sequence}`,
          };
        })
      ),
    [routes]
  );

  const driverLocations = useMemo<DriverLocationMarker[]>(
    () =>
      routes.flatMap((route) => {
        const position = locations[route.id];
        if (!position) return [];
        return [
          {
            id: route.id,
            label: route.driver?.user?.fullName ?? 'Conductor',
            latitude: position.latitude,
            longitude: position.longitude,
          },
        ];
      }),
    [locations, routes]
  );

  return (
    <div className="space-y-6 animate-in">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            Mapa en vivo
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Ubicación de los conductores en las rutas en progreso.
          </p>
        </div>
        <Badge variant={routes.length > 0 ? 'warning' : 'neutral'}>
          {routes.length} {routes.length === 1 ? 'ruta activa' : 'rutas activas'}
        </Badge>
      </header>

      {error && <p className="font-body-md text-body-md text-error">{error}</p>}

      <Card>
        <CardHeader>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            Flota en ruta
          </h2>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="font-body-md text-body-md text-on-surface-variant">
              Cargando mapa en vivo...
            </p>
          ) : routes.length === 0 ? (
            <p className="font-body-md text-body-md text-on-surface-variant">
              No hay rutas en progreso en este momento.
            </p>
          ) : (
            <RouteMap
              stops={mapStops}
              driverLocations={driverLocations}
              className="w-full h-96 rounded-xl overflow-hidden"
            />
          )}
        </CardContent>
      </Card>

      {!loading && routes.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              Rutas activas
            </h2>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-surface-container">
              {routes.map((route) => {
                const position = locations[route.id];
                const completed = route.stops.filter(
                  (stop) => stop.status === 'completed'
                ).length;
                return (
                  <li
                    key={route.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <div>
                      <p className="font-label-lg text-label-lg text-on-surface">
                        {route.driver?.user?.fullName ?? 'Conductor sin asignar'}
                      </p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">
                        {route.routeDate.slice(0, 10)} · {completed} de{' '}
                        {route.stops.length} paradas completadas
                        {position?.capturedAt
                          ? ` · Última señal ${new Date(position.capturedAt).toLocaleTimeString()}`
                          : ' · Sin señal GPS todavía'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={routeStatusVariant(route.status)}>
                        {ROUTE_STATUS_LABELS[route.status] ?? route.status}
                      </Badge>
                      <Link
                        to={`${basePath}/routes/${route.id}`}
                        className="font-label-lg text-label-lg text-primary hover:underline"
                      >
                        Ver detalle
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
