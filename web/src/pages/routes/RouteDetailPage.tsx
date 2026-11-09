import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Toast } from '@/components/ui/Modal';
import { RouteMap, type DriverLocation, type RouteMapStop } from '@/components/map/RouteMap';
import { companyApi, incidentApi, routeApi, type IncidentPayload } from '@/services/api';
import { getRealtimeSocket, releaseRealtimeSocket } from '@/services/socket';
import { DRIVER_STATUS_LABELS, getApiErrorMessage } from '@/lib/company-validation';
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

interface RouteStudent {
  id: string;
  fullName: string;
  pickupAddress: string;
  latitude: number | null;
  longitude: number | null;
}

interface RouteStop {
  id: string;
  sequence: number;
  status: string;
  order?: RouteOrder | null;
  student?: RouteStudent | null;
}

interface RouteDetail {
  id: string;
  routeDate: string;
  status: string;
  driverId: string;
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

interface DriverOption {
  id: string;
  fullName: string;
  status: keyof typeof DRIVER_STATUS_LABELS;
  isActive: boolean;
}

const INCIDENT_STATUS_LABELS: Record<string, string> = {
  open: 'Abierta',
  in_progress: 'En curso',
  resolved: 'Resuelta',
};

const INCIDENT_CATEGORY_LABELS: Record<string, string> = {
  incident: 'Incidencia',
  question: 'Pregunta',
};

export function RouteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const basePath = location.pathname.replace(/\/[^/]+$/, '');
  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [incidents, setIncidents] = useState<IncidentPayload[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [targetDriverId, setTargetDriverId] = useState('');
  const [reassigningStopId, setReassigningStopId] = useState<string | null>(null);
  const [reassigningRoute, setReassigningRoute] = useState(false);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    variant: 'success' | 'error' | 'info';
  }>({ show: false, message: '', variant: 'error' });

  const fetchRoute = useCallback(async () => {
    if (!id) return;
    try {
      const response = await routeApi.getRoute(id);
      setRoute(response.data);
    } catch {
      setToast({ show: true, message: 'No se pudo cargar la ruta', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchIncidents = useCallback(async () => {
    if (!id) return;
    try {
      const response = await incidentApi.list({ routeId: id });
      setIncidents(response.data);
    } catch {
      // The route can load even if incidents are not available yet.
    }
  }, [id]);

  const fetchDriverLocation = useCallback(async () => {
    if (!id) return;
    try {
      const response = await routeApi.getLatestLocation(id);
      const location = response.data as
        | { latitude: number; longitude: number }
        | null;
      if (location) {
        setDriverLocation({
          latitude: location.latitude,
          longitude: location.longitude,
        });
      }
    } catch {
      // Initial position is optional.
    }
  }, [id]);

  useEffect(() => {
    fetchRoute();
    fetchIncidents();
    fetchDriverLocation();
    companyApi
      .getDrivers()
      .then((response) => setDrivers(response.data as DriverOption[]))
      .catch(() => setDrivers([]));
  }, [fetchDriverLocation, fetchIncidents, fetchRoute]);

  useEffect(() => {
    if (!selectedIncidentId && incidents.length > 0) {
      setSelectedIncidentId(incidents[0].id);
    }
  }, [incidents, selectedIncidentId]);

  useEffect(() => {
    if (!id) return;

    const socket = getRealtimeSocket();
    if (!socket) return;

    const onRouteStatus = (payload: {
      routeId?: string;
      status?: string;
      route?: RouteDetail;
    }) => {
      if (payload.routeId !== id) return;
      if (payload.route) setRoute(payload.route);
      else fetchRoute();
      if (payload.status) {
        setToast({
          show: true,
          message: `La ruta cambió a estado ${ROUTE_STATUS_LABELS[payload.status] ?? payload.status}`,
          variant: 'info',
        });
      }
    };

    const onRouteLocation = (payload: {
      routeId?: string;
      locations?: Array<{ latitude: number; longitude: number }>;
    }) => {
      if (payload.routeId !== id) return;
      const last = payload.locations?.[payload.locations.length - 1];
      if (last) {
        setDriverLocation({ latitude: last.latitude, longitude: last.longitude });
      }
    };

    const onStopStatus = (payload: { routeId?: string; route?: RouteDetail }) => {
      if (payload.routeId !== id) return;
      if (payload.route) setRoute(payload.route);
      else fetchRoute();
    };

    const onRouteReassigned = (payload: {
      routeId?: string;
      route?: RouteDetail;
    }) => {
      if (payload.routeId !== id) return;
      if (payload.route) setRoute(payload.route);
      setToast({
        show: true,
        message: 'La ruta fue reasignada a otro conductor',
        variant: 'info',
      });
    };

    const onStopReassigned = (payload: {
      routeId?: string;
      targetRouteId?: string;
    }) => {
      if (payload.routeId !== id && payload.targetRouteId !== id) return;
      fetchRoute();
      fetchIncidents();
      setToast({
        show: true,
        message: 'Una parada fue reasignada',
        variant: 'info',
      });
    };

    const onIncidentCreated = (payload: { routeId?: string }) => {
      if (payload.routeId === id) fetchIncidents();
    };

    const onIncidentUpdated = (payload: { routeId?: string }) => {
      if (payload.routeId === id) fetchIncidents();
    };

    const onIncidentMessage = () => {
      fetchIncidents();
    };

    socket.on('route:status', onRouteStatus);
    socket.on('route:location', onRouteLocation);
    socket.on('route:stop-status', onStopStatus);
    socket.on('route:reassigned', onRouteReassigned);
    socket.on('route:stop-reassigned', onStopReassigned);
    socket.on('incident:created', onIncidentCreated);
    socket.on('incident:updated', onIncidentUpdated);
    socket.on('incident:message', onIncidentMessage);

    return () => {
      socket.off('route:status', onRouteStatus);
      socket.off('route:location', onRouteLocation);
      socket.off('route:stop-status', onStopStatus);
      socket.off('route:reassigned', onRouteReassigned);
      socket.off('route:stop-reassigned', onStopReassigned);
      socket.off('incident:created', onIncidentCreated);
      socket.off('incident:updated', onIncidentUpdated);
      socket.off('incident:message', onIncidentMessage);
      releaseRealtimeSocket();
    };
  }, [fetchIncidents, fetchRoute, id]);

  const handleOptimize = async () => {
    if (!id) return;
    setOptimizing(true);
    try {
      const response = await routeApi.optimizeRoute(id);
      const optimization = response.data?.optimization;
      const prefix = response.data?.approximate ? 'Ruta optimizada con distancias aproximadas' : 'Ruta optimizada';
      setToast({
        show: true,
        message: `${prefix}: ${formatDistance(optimization?.totalDistanceM)}, ${formatDuration(optimization?.estimatedDurationS)}`,
        variant: 'success',
      });
      await fetchRoute();
    } catch (error) {
      const candidate = error as { response?: { data?: { message?: string } } };
      setToast({
        show: true,
        message: candidate.response?.data?.message ?? 'No se pudo optimizar la ruta',
        variant: 'error',
      });
    } finally {
      setOptimizing(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedIncidentId || !messageText.trim()) return;
    setSendingMessage(true);
    try {
      const response = await incidentApi.addMessage(selectedIncidentId, messageText.trim());
      setMessageText('');
      setIncidents((prev) =>
        prev.map((incident) =>
          incident.id === response.data.incident.id ? response.data.incident : incident
        )
      );
    } catch (error) {
      setToast({
        show: true,
        message: getApiErrorMessage(error, 'No se pudo enviar el mensaje'),
        variant: 'error',
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleUpdateIncident = async (status: 'in_progress' | 'resolved') => {
    if (!selectedIncidentId) return;
    try {
      const response = await incidentApi.update(selectedIncidentId, { status });
      setIncidents((prev) =>
        prev.map((incident) =>
          incident.id === response.data.id ? response.data : incident
        )
      );
      setToast({
        show: true,
        message: `Incidencia marcada como ${INCIDENT_STATUS_LABELS[status].toLowerCase()}`,
        variant: 'success',
      });
    } catch (error) {
      setToast({
        show: true,
        message: getApiErrorMessage(error, 'No se pudo actualizar la incidencia'),
        variant: 'error',
      });
    }
  };

  const handleReassignRoute = async () => {
    if (!id || !targetDriverId) return;
    setReassigningRoute(true);
    try {
      const response = await routeApi.reassignRoute(id, targetDriverId);
      setRoute(response.data);
      await Promise.all([fetchRoute(), fetchDriverLocation()]);
      setDriverLocation(null);
      setToast({ show: true, message: 'Ruta reasignada', variant: 'success' });
    } catch (error) {
      setToast({
        show: true,
        message: getApiErrorMessage(error, 'No se pudo reasignar la ruta'),
        variant: 'error',
      });
    } finally {
      setReassigningRoute(false);
    }
  };

  const handleReassignStop = async (stopId: string) => {
    if (!id || !targetDriverId) return;
    setReassigningStopId(stopId);
    try {
      await routeApi.reassignStop(id, stopId, targetDriverId);
      await Promise.all([fetchRoute(), fetchIncidents()]);
      setToast({ show: true, message: 'Parada reasignada', variant: 'success' });
    } catch (error) {
      setToast({
        show: true,
        message: getApiErrorMessage(error, 'No se pudo reasignar la parada'),
        variant: 'error',
      });
    } finally {
      setReassigningStopId(null);
    }
  };

  const mapStops = useMemo<RouteMapStop[]>(
    () =>
      (route?.stops ?? []).map((stop) => {
        const source = stop.order ?? stop.student;
        return {
          id: stop.id,
          sequence: stop.sequence,
          latitude: source?.latitude ?? null,
          longitude: source?.longitude ?? null,
          label:
            stop.order?.address ??
            stop.student?.pickupAddress ??
            `Parada ${stop.sequence}`,
        };
      }),
    [route]
  );

  const optimization = route?.optimizations?.[0];
  const selectedIncident =
    incidents.find((incident) => incident.id === selectedIncidentId) ?? null;
  const driverOptions = useMemo(
    () =>
      drivers
        .filter((driver) => driver.isActive && driver.id !== route?.driverId)
        .map((driver) => ({
          value: driver.id,
          label: `${driver.fullName} · ${DRIVER_STATUS_LABELS[driver.status] ?? driver.status}`,
        })),
    [drivers, route?.driverId]
  );

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
        <div className="flex items-center gap-3">
          <Badge variant={routeStatusVariant(route.status)}>
            {ROUTE_STATUS_LABELS[route.status] ?? route.status}
          </Badge>
          {(route.status === 'created' || route.status === 'optimized') && route.stops.length > 0 && (
            <Button onClick={handleOptimize} loading={optimizing}>
              <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
              Optimizar ruta
            </Button>
          )}
        </div>
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
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Reasignación</h2>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex-1">
            <Select
              label="Conductor destino"
              value={targetDriverId}
              onChange={(event) => setTargetDriverId(event.target.value)}
              options={[
                { value: '', label: 'Selecciona un conductor' },
                ...driverOptions,
              ]}
            />
          </div>
          <Button
            onClick={handleReassignRoute}
            disabled={!targetDriverId}
            loading={reassigningRoute}
            variant="secondary"
          >
            Reasignar ruta completa
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Mapa de paradas</h2>
        </CardHeader>
        <CardContent>
          <RouteMap stops={mapStops} driverLocation={driverLocation} />
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
                      {stop.order?.address ??
                        stop.student?.pickupAddress ??
                        `Parada ${stop.sequence}`}
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      {stop.order
                        ? `${stop.order.customerName || 'Sin nombre'} · ${stop.order.customerPhone || 'Sin teléfono'}`
                        : stop.student
                          ? `Estudiante: ${stop.student.fullName}`
                          : 'Parada sin destino'}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge variant="neutral">{STOP_STATUS_LABELS[stop.status] ?? stop.status}</Badge>
                      {stop.student && <Badge variant="info">Transporte escolar</Badge>}
                      {stop.order && (
                        <Badge variant={stop.order.priority === 'urgent' ? 'error' : orderStatusVariant('pending')}>
                          {ORDER_PRIORITY_LABELS[stop.order.priority] ?? stop.order.priority}
                        </Badge>
                      )}
                      {(stop.order ?? stop.student)?.latitude === null && (
                        <span className="font-label-sm text-label-sm text-error">Sin coordenadas</span>
                      )}
                    </div>
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!targetDriverId || stop.status === 'completed'}
                        loading={reassigningStopId === stop.id}
                        onClick={() => handleReassignStop(stop.id)}
                      >
                        Reasignar parada
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            Incidencias y preguntas
          </h2>
          <Badge variant={incidents.some((incident) => incident.status === 'open') ? 'warning' : 'neutral'}>
            {incidents.length} reportadas
          </Badge>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            {incidents.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">
                No hay incidencias reportadas para esta ruta.
              </p>
            ) : (
              incidents.map((incident) => (
                <button
                  key={incident.id}
                  type="button"
                  onClick={() => setSelectedIncidentId(incident.id)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    selectedIncidentId === incident.id
                      ? 'border-primary bg-primary-fixed/40'
                      : 'border-outline/40 hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={incident.category === 'incident' ? 'error' : 'info'}>
                      {INCIDENT_CATEGORY_LABELS[incident.category] ?? incident.category}
                    </Badge>
                    <Badge
                      variant={
                        incident.status === 'resolved'
                          ? 'success'
                          : incident.status === 'in_progress'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {INCIDENT_STATUS_LABELS[incident.status] ?? incident.status}
                    </Badge>
                  </div>
                  <p className="font-label-md text-label-md mt-2 line-clamp-2">
                    {incident.description}
                  </p>
                  <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">
                    {incident.stop
                      ? `Parada ${incident.stop.sequence}`
                      : 'Sin parada asociada'}{' '}
                    · {incident.messages.length} mensajes
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="lg:col-span-2">
            {selectedIncident ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-label-lg text-label-lg">{selectedIncident.description}</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">
                      Reportada por {selectedIncident.route?.driver?.user?.fullName ?? 'conductor'} ·{' '}
                      {new Date(selectedIncident.reportedAt).toLocaleString()}
                    </p>
                  </div>
                  {selectedIncident.status !== 'resolved' && (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => handleUpdateIncident('resolved')}
                    >
                      Marcar resuelta
                    </Button>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 rounded-lg bg-surface-container p-3">
                  {selectedIncident.messages.length === 0 ? (
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Aún no hay mensajes.
                    </p>
                  ) : (
                    selectedIncident.messages.map((message) => (
                      <div key={message.id} className="rounded-lg bg-surface-container-lowest p-2">
                        <p className="font-label-sm text-label-sm text-on-surface-variant">
                          {message.sender?.fullName ?? 'Usuario'} ·{' '}
                          {new Date(message.sentAt).toLocaleString()}
                        </p>
                        <p className="font-body-md text-body-md">{message.message}</p>
                      </div>
                    ))
                  )}
                </div>

                {selectedIncident.status !== 'resolved' && (
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Input
                        label="Responder al conductor"
                        value={messageText}
                        onChange={(event) => setMessageText(event.target.value)}
                        placeholder="Escribe una respuesta..."
                      />
                    </div>
                    <Button
                      onClick={handleSendMessage}
                      loading={sendingMessage}
                      disabled={!messageText.trim()}
                    >
                      Enviar
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="font-body-md text-body-md text-on-surface-variant">
                Selecciona una incidencia para ver la conversación.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Toast
        show={toast.show}
        onClose={() => setToast({ ...toast, show: false })}
        title={toast.message}
        variant={toast.variant}
      />
    </div>
  );
}
