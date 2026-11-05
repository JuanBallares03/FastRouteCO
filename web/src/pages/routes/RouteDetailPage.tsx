import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Toast } from '@/components/ui/Modal';
import { RouteMap, type RouteMapStop } from '@/components/map/RouteMap';
import { routeApi } from '@/services/api';
import {
  ORDER_PRIORITY_LABELS,
  ROUTE_STATUS_LABELS,
  STOP_STATUS_LABELS,
  formatDistance,
  formatDuration,
  orderStatusVariant,
  routeStatusVariant,
} from '@/lib/order-utils';

interface RouteOrder {
  id: string;
  address: string;
  customerName?: string | null;
  customerPhone?: string | null;
  priority: string;
  latitude: number | null;
  longitude: number | null;
}

interface RouteStop {
  id: string;
  sequence: number;
  status: string;
  order?: RouteOrder | null;
}

interface RouteDetail {
  id: string;
  routeDate: string;
  status: string;
  driver?: {
    user?: { fullName?: string | null; phone?: string | null } | null;
  } | null;
  stops: RouteStop[];
  optimizations?: Array<{
    totalDistanceM: number | null;
    estimatedDurationS: number | null;
    processingTimeMs: number | null;
    isSuccessful: boolean;
    optimizationDate: string;
  }>;
}

export function RouteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const basePath = location.pathname.replace(/\/[^/]+$/, '');
  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  const fetchRoute = useCallback(async () => {
    if (!id) return;
    try {
      const response = await routeApi.getRoute(id);
      setRoute(response.data);
    } catch {
      setToast({ show: true, message: 'No se pudo cargar la ruta' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRoute();
  }, [fetchRoute]);

  const mapStops = useMemo<RouteMapStop[]>(
    () =>
      (route?.stops ?? [])
        .filter((stop) => Boolean(stop.order))
        .map((stop) => ({
          id: stop.id,
          sequence: stop.sequence,
          latitude: stop.order?.latitude ?? null,
          longitude: stop.order?.longitude ?? null,
          label: stop.order?.address ?? `Parada ${stop.sequence}`,
        })),
    [route]
  );

  const optimization = route?.optimizations?.[0];

  if (loading) {
    return <p className="font-body-md text-body-md text-on-surface-variant">Cargando ruta...</p>;
  }

  if (!route) {
    return (
      <div className="space-y-4">
        <Link to={basePath} className="font-label-lg text-label-lg text-primary hover:underline">
          Volver a rutas
        </Link>
        <p className="font-body-md text-body-md text-on-surface-variant">La ruta no existe o no tienes acceso.</p>
      </div>
    );
  }

  const completedStops = route.stops.filter((stop) => stop.status === 'completed').length;

  return (
    <div className="space-y-6 animate-in">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to={basePath} className="font-label-md text-label-md text-primary hover:underline">
            Volver a rutas
          </Link>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mt-2">
            Ruta de {route.driver?.user?.fullName ?? 'conductor'}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {route.routeDate.slice(0, 10)} · {route.stops.length} paradas · {completedStops} completadas
          </p>
        </div>
        <Badge variant={routeStatusVariant(route.status)}>
          {ROUTE_STATUS_LABELS[route.status] ?? route.status}
        </Badge>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <span className="font-label-md text-label-md text-on-surface-variant">Distancia estimada</span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">
              {formatDistance(optimization?.totalDistanceM)}
            </h2>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <span className="font-label-md text-label-md text-on-surface-variant">Duración estimada</span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">
              {formatDuration(optimization?.estimatedDurationS)}
            </h2>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <span className="font-label-md text-label-md text-on-surface-variant">Teléfono del conductor</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface mt-2">
              {route.driver?.user?.phone || 'Sin teléfono'}
            </h2>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Mapa de paradas</h2>
        </CardHeader>
        <CardContent>
          <RouteMap stops={mapStops} />
          {mapStops.some((stop) => stop.latitude === null) && (
            <p className="font-label-sm text-label-sm text-on-surface-variant mt-2">
              Algunas paradas no tienen coordenadas y no se muestran en el mapa.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Secuencia de paradas</h2>
        </CardHeader>
        <CardContent className="p-0">
          {route.stops.length === 0 ? (
            <p className="p-6 font-body-md text-body-md text-on-surface-variant">La ruta no tiene paradas.</p>
          ) : (
            <ol className="divide-y divide-surface-container">
              {route.stops.map((stop, index) => (
                <li key={stop.id} className="flex items-start gap-4 p-4">
                  <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary-container text-on-primary font-label-lg shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <span className="font-label-lg text-label-lg block">
                      {stop.order?.address ?? `Parada ${stop.sequence}`}
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      {stop.order?.customerName || 'Sin nombre'} · {stop.order?.customerPhone || 'Sin teléfono'}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge variant="neutral">{STOP_STATUS_LABELS[stop.status] ?? stop.status}</Badge>
                      {stop.order && (
                        <Badge variant={stop.order.priority === 'urgent' ? 'error' : orderStatusVariant('pending')}>
                          {ORDER_PRIORITY_LABELS[stop.order.priority] ?? stop.order.priority}
                        </Badge>
                      )}
                      {stop.order?.latitude === null && (
                        <span className="font-label-sm text-label-sm text-error">Sin coordenadas</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Toast
        show={toast.show}
        onClose={() => setToast({ show: false, message: '' })}
        title={toast.message}
        variant="error"
      />
    </div>
  );
}
