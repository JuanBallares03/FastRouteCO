import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { Toast } from '@/components/ui/Modal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { incidentApi, type IncidentPayload } from '@/features/incidents/api';
import {
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_STATUS_LABELS,
  incidentStatusVariant,
} from '@/features/incidents/labels';
import { getRealtimeSocket, releaseRealtimeSocket } from '@/services/socket';
import { getApiErrorMessage } from '@/lib/company-validation';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'open', label: INCIDENT_STATUS_LABELS.open },
  { value: 'in_progress', label: INCIDENT_STATUS_LABELS.in_progress },
  { value: 'resolved', label: INCIDENT_STATUS_LABELS.resolved },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'Todas las categorías' },
  { value: 'incident', label: INCIDENT_CATEGORY_LABELS.incident },
  { value: 'question', label: INCIDENT_CATEGORY_LABELS.question },
];

export function IncidentsPage() {
  const location = useLocation();
  const basePath = location.pathname.startsWith('/supervisor')
    ? '/supervisor'
    : '/company';
  const [incidents, setIncidents] = useState<IncidentPayload[]>([]);
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    variant: 'success' | 'error';
  }>({ show: false, message: '', variant: 'error' });

  const loadIncidents = useCallback(async () => {
    try {
      const response = await incidentApi.list({
        status: status || undefined,
        category: category || undefined,
      });
      setIncidents(response.data);
    } catch {
      setToast({
        show: true,
        message: 'No se pudieron cargar las incidencias',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [category, status]);

  useEffect(() => {
    setLoading(true);
    loadIncidents();
  }, [loadIncidents]);

  useEffect(() => {
    const socket = getRealtimeSocket();
    if (!socket) return;

    const refresh = () => loadIncidents();

    socket.on('incident:created', refresh);
    socket.on('incident:updated', refresh);
    socket.on('incident:message', refresh);

    return () => {
      socket.off('incident:created', refresh);
      socket.off('incident:updated', refresh);
      socket.off('incident:message', refresh);
      releaseRealtimeSocket();
    };
  }, [loadIncidents]);

  const handleResolve = async (incidentId: string) => {
    setResolvingId(incidentId);
    try {
      const response = await incidentApi.update(incidentId, { status: 'resolved' });
      setIncidents((current) =>
        current.map((incident) =>
          incident.id === response.data.id ? response.data : incident
        )
      );
      setToast({
        show: true,
        message: 'Incidencia marcada como resuelta',
        variant: 'success',
      });
    } catch (error) {
      setToast({
        show: true,
        message: getApiErrorMessage(error, 'No se pudo actualizar la incidencia'),
        variant: 'error',
      });
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in">
      <header>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">
          Incidencias
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Incidencias y preguntas reportadas por los conductores durante la ruta.
        </p>
      </header>

      <Card>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Estado"
            value={status}
            options={STATUS_OPTIONS}
            onChange={(event) => setStatus(event.target.value)}
          />
          <Select
            label="Categoría"
            value={category}
            options={CATEGORY_OPTIONS}
            onChange={(event) => setCategory(event.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            Reportes de los conductores
          </h2>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 font-body-md text-body-md text-on-surface-variant">
              Cargando incidencias...
            </p>
          ) : incidents.length === 0 ? (
            <p className="p-6 font-body-md text-body-md text-on-surface-variant">
              No hay incidencias para los filtros seleccionados.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reporte</TableHead>
                  <TableHead>Conductor</TableHead>
                  <TableHead>Ruta</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Mensajes</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((incident) => (
                  <TableRow key={incident.id}>
                    <TableCell>
                      <Badge
                        variant={incident.category === 'incident' ? 'error' : 'info'}
                      >
                        {INCIDENT_CATEGORY_LABELS[incident.category] ??
                          incident.category}
                      </Badge>
                      <p className="font-label-md text-label-md text-on-surface mt-2 line-clamp-2">
                        {incident.description}
                      </p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">
                        {new Date(incident.reportedAt).toLocaleString()}
                        {incident.stop
                          ? ` · Parada ${incident.stop.sequence}`
                          : ' · Sin parada asociada'}
                      </p>
                    </TableCell>
                    <TableCell>
                      {incident.route?.driver?.user?.fullName ?? 'Conductor'}
                    </TableCell>
                    <TableCell>{incident.route?.routeDate.slice(0, 10)}</TableCell>
                    <TableCell>
                      <Badge variant={incidentStatusVariant(incident.status)}>
                        {INCIDENT_STATUS_LABELS[incident.status] ?? incident.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{incident.messages.length}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-2">
                        <Link
                          to={`${basePath}/routes/${incident.routeId}`}
                          className="font-label-lg text-label-lg text-primary hover:underline"
                        >
                          Abrir conversación
                        </Link>
                        {incident.status !== 'resolved' && (
                          <Button
                            size="sm"
                            variant="success"
                            loading={resolvingId === incident.id}
                            onClick={() => handleResolve(incident.id)}
                          >
                            Marcar resuelta
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
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
