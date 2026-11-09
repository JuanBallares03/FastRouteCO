import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
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
import { monitoringApi } from '@/services/api';
import { getApiErrorMessage } from '@/lib/company-validation';

interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  source: string | null;
  message: string;
  createdAt: string;
  resolvedAt: string | null;
}

interface Overview {
  generatedAt: string;
  companies: { total: number; active: number; inactive: number };
  subscriptions: { active: number; trialsActive: number; expiringInSevenDays: number };
  operations: {
    routesToday: number;
    routesInProgress: number;
    incidentsOpen: number;
    supportOpen: number;
  };
  alerts: {
    unresolved: number;
    bySeverity: Record<'info' | 'warning' | 'critical', number>;
    latest: Alert[];
  };
}

const SEVERITY_LABELS: Record<string, string> = {
  info: 'Información',
  warning: 'Advertencia',
  critical: 'Crítica',
};

const SEVERITY_VARIANTS: Record<string, 'info' | 'warning' | 'error'> = {
  info: 'info',
  warning: 'warning',
  critical: 'error',
};

export function MonitoringPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [resolvedFilter, setResolvedFilter] = useState('false');
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    variant: 'success' | 'error';
  }>({ show: false, message: '', variant: 'error' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewResponse, alertsResponse] = await Promise.all([
        monitoringApi.getOverview(),
        monitoringApi.listAlerts({
          resolved: resolvedFilter || undefined,
          pageSize: 50,
        }),
      ]);
      setOverview(overviewResponse.data as Overview);
      setAlerts(alertsResponse.data.items as Alert[]);
    } catch {
      setToast({ show: true, message: 'No se pudo cargar el monitoreo', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [resolvedFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    try {
      await monitoringApi.resolveAlert(id);
      setToast({ show: true, message: 'Alerta marcada como resuelta', variant: 'success' });
      await loadData();
    } catch (error) {
      setToast({
        show: true,
        message: getApiErrorMessage(error, 'No se pudo resolver la alerta'),
        variant: 'error',
      });
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Monitoreo de la plataforma</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Estado general, operación y alertas del sistema.
          </p>
        </div>
        <Button variant="secondary" onClick={loadData} loading={loading}>
          <span className="material-symbols-outlined text-[20px]">refresh</span>
          Actualizar
        </Button>
      </header>

      {overview && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: 'Empresas', value: `${overview.companies.active} / ${overview.companies.total}`, detail: `${overview.companies.inactive} inactivas`, icon: 'apartment' },
              { label: 'Suscripciones activas', value: overview.subscriptions.active, detail: `${overview.subscriptions.trialsActive} en Free Trial`, icon: 'workspace_premium' },
              { label: 'Rutas hoy', value: overview.operations.routesToday, detail: `${overview.operations.routesInProgress} en progreso`, icon: 'route' },
              { label: 'Alertas sin resolver', value: overview.alerts.unresolved, detail: `${overview.alerts.bySeverity.critical} críticas`, icon: 'notifications_active' },
            ].map((item) => (
              <Card key={item.label}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      {item.label}
                    </span>
                    <span className="material-symbols-outlined text-[22px] text-primary">
                      {item.icon}
                    </span>
                  </div>
                  <p className="font-headline-lg text-headline-lg text-on-surface mt-2">{item.value}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{item.detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">
                  Operación y soporte
                </h2>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Incidencias abiertas', value: overview.operations.incidentsOpen },
                  { label: 'Solicitudes de soporte abiertas', value: overview.operations.supportOpen },
                  { label: 'Suscripciones que vencen en 7 días', value: overview.subscriptions.expiringInSevenDays },
                  { label: 'Alertas informativas', value: overview.alerts.bySeverity.info },
                  { label: 'Alertas de advertencia', value: overview.alerts.bySeverity.warning },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low"
                  >
                    <span className="font-label-md text-label-md text-on-surface">{item.label}</span>
                    <span className="font-headline-md text-headline-md text-on-surface">
                      {item.value}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">Últimas alertas</h2>
              </CardHeader>
              <CardContent className="space-y-2 max-h-72 overflow-y-auto">
                {overview.alerts.latest.length === 0 ? (
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    No hay alertas registradas.
                  </p>
                ) : (
                  overview.alerts.latest.map((alert) => (
                    <div key={alert.id} className="rounded-lg bg-surface-container-low p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={SEVERITY_VARIANTS[alert.severity] ?? 'neutral'}>
                          {SEVERITY_LABELS[alert.severity] ?? alert.severity}
                        </Badge>
                        <span className="font-label-sm text-label-sm text-on-surface-variant">
                          {new Date(alert.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface mt-2 line-clamp-2">
                        {alert.message}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Historial de alertas</h2>
          <div className="w-48">
            <Select
              label="Estado"
              value={resolvedFilter}
              onChange={(event) => setResolvedFilter(event.target.value)}
              options={[
                { value: 'false', label: 'Sin resolver' },
                { value: 'true', label: 'Resueltas' },
                { value: '', label: 'Todas' },
              ]}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {alerts.length === 0 ? (
            <p className="p-6 font-body-md text-body-md text-on-surface-variant">
              No hay alertas con el filtro seleccionado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severidad</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Mensaje</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell>
                      <Badge variant={SEVERITY_VARIANTS[alert.severity] ?? 'neutral'}>
                        {SEVERITY_LABELS[alert.severity] ?? alert.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>{alert.source ?? 'Sistema'}</TableCell>
                    <TableCell className="max-w-md">{alert.message}</TableCell>
                    <TableCell>{new Date(alert.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={alert.resolvedAt ? 'success' : 'error'}>
                        {alert.resolvedAt ? 'Resuelta' : 'Sin resolver'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {!alert.resolvedAt && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={resolvingId === alert.id}
                          onClick={() => handleResolve(alert.id)}
                        >
                          Resolver
                        </Button>
                      )}
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
