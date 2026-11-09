import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
import { useAuth } from '@/context/AuthContext';
import { companyApi, reportApi } from '@/services/api';
import { getApiErrorMessage } from '@/lib/company-validation';
import {
  ROUTE_STATUS_LABELS,
  formatDistance,
  formatDuration,
  routeStatusVariant,
  todayInBogota,
} from '@/lib/order-utils';
import {
  addDaysToBusinessDate,
  downloadCsv,
  type ReportRouteRow,
  type ReportSummary,
  type RouteReport,
} from '@/lib/report-utils';

interface Branch {
  id: string;
  name: string;
}

export function ReportsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const routeBasePath = location.pathname.startsWith('/supervisor')
    ? '/supervisor/routes'
    : '/company/routes';
  const isCompanyAdmin = user?.role === 'company_admin';
  const today = todayInBogota();
  const [filters, setFilters] = useState({
    from: addDaysToBusinessDate(today, -29),
    to: today,
    branchId: '',
  });
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [routeReport, setRouteReport] = useState<RouteReport | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    variant: 'success' | 'error';
  }>({ show: false, message: '', variant: 'error' });

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        from: filters.from || undefined,
        to: filters.to || undefined,
        branchId: filters.branchId || undefined,
      };
      if (isCompanyAdmin) {
        const response = await reportApi.getSummary(params);
        setSummary(response.data as ReportSummary);
        setRouteReport(null);
      } else {
        const response = await reportApi.getRoutes(params);
        setRouteReport(response.data as RouteReport);
        setSummary(null);
      }
    } catch (error) {
      setToast({
        show: true,
        message: getApiErrorMessage(error, 'No se pudieron cargar los reportes'),
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [filters, isCompanyAdmin]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    companyApi
      .getBranches()
      .then((response) => setBranches((response.data as Branch[]) ?? []))
      .catch(() => setBranches([]));
  }, []);

  const data = isCompanyAdmin ? summary : routeReport;
  const metrics = summary?.metrics;
  const routes = data?.routes ?? [];
  const driverRanking = data?.driverRanking ?? [];

  const branchOptions = useMemo(
    () => [
      { value: '', label: 'Todas las sedes' },
      ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
    ],
    [branches]
  );

  const exportCsv = () => {
    downloadCsv(`reporte-rutas-${filters.from || 'inicio'}-${filters.to || 'hoy'}.csv`, [
      ['Ruta', 'Fecha', 'Estado', 'Conductor', 'Paradas', 'Completadas', 'Pendientes', 'Distancia planificada (m)', 'Distancia real (m)', 'Duración (s)'],
      ...routes.map((route) => [
        route.id,
        route.routeDate,
        ROUTE_STATUS_LABELS[route.status] ?? route.status,
        route.driver.fullName,
        route.stopsTotal,
        route.stopsCompleted,
        route.stopsPending,
        route.plannedDistanceM,
        route.actualDistanceM,
        route.durationS,
      ]),
      [],
      ['Conductor', 'Rutas', 'Paradas completadas', 'Distancia planificada (m)', 'Distancia real (m)'],
      ...driverRanking.map((driver) => [
        driver.fullName,
        driver.routes,
        driver.stopsCompleted,
        driver.plannedDistanceM,
        driver.actualDistanceM,
      ]),
    ]);
  };

  const metricCards = metrics
    ? [
        { label: 'Rutas', value: metrics.routesTotal, icon: 'route', tone: 'text-primary' },
        { label: 'Completadas', value: metrics.routesCompleted, icon: 'task_alt', tone: 'text-tertiary' },
        { label: 'Paradas completadas', value: metrics.stopsCompleted, icon: 'pin_drop', tone: 'text-secondary' },
        { label: 'Cumplimiento', value: `${metrics.completionRate}%`, icon: 'percent', tone: 'text-tertiary' },
        { label: 'Distancia planificada', value: formatDistance(metrics.plannedDistanceM), icon: 'straighten', tone: 'text-primary' },
        { label: 'Distancia real', value: formatDistance(metrics.actualDistanceM), icon: 'my_location', tone: 'text-secondary' },
        { label: 'Créditos consumidos', value: metrics.creditsConsumed, icon: 'toll', tone: 'text-error' },
        { label: 'Duración promedio por parada', value: formatDuration(metrics.averageStopDurationS), icon: 'timer', tone: 'text-primary' },
      ]
    : [];

  return (
    <div className="space-y-6 animate-in">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            {isCompanyAdmin ? 'Reportes de la empresa' : 'Reporte de rutas'}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {isCompanyAdmin
              ? 'Indicadores de eficiencia por ruta, conductor y empresa.'
              : 'Datos de rutas activas y completadas para el informe logístico.'}
          </p>
        </div>
        <Button variant="secondary" onClick={exportCsv} disabled={routes.length === 0}>
          <span className="material-symbols-outlined text-[20px]">download</span>
          Exportar CSV
        </Button>
      </header>

      <Card>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            type="date"
            label="Desde"
            value={filters.from}
            onChange={(event) => setFilters({ ...filters, from: event.target.value })}
          />
          <Input
            type="date"
            label="Hasta"
            value={filters.to}
            onChange={(event) => setFilters({ ...filters, to: event.target.value })}
          />
          <Select
            label="Sede"
            value={filters.branchId}
            options={branchOptions}
            onChange={(event) => setFilters({ ...filters, branchId: event.target.value })}
          />
          <div className="flex items-end">
            <Button onClick={loadReport} loading={loading} className="w-full">
              Aplicar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="font-body-md text-body-md text-on-surface-variant">Cargando reportes...</p>
      ) : (
        <>
          {metricCards.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {metricCards.map((metric) => (
                <Card key={metric.label}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        {metric.label}
                      </span>
                      <span className={`material-symbols-outlined text-[22px] ${metric.tone}`}>
                        {metric.icon}
                      </span>
                    </div>
                    <p className="font-headline-md text-headline-md text-on-surface mt-3">
                      {metric.value}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {metrics && (
            <Card>
              <CardHeader>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">
                  Rutas por estado
                </h2>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                {Object.entries(metrics.byStatus).map(([status, total]) => (
                  <div key={status} className="rounded-lg bg-surface-container-low px-4 py-3">
                    <span className="font-label-sm text-label-sm text-on-surface-variant block">
                      {ROUTE_STATUS_LABELS[status] ?? status}
                    </span>
                    <span className="font-headline-md text-headline-md text-on-surface">{total}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                Eficiencia por conductor
              </h2>
            </CardHeader>
            <CardContent className="p-0">
              {driverRanking.length === 0 ? (
                <p className="p-6 font-body-md text-body-md text-on-surface-variant">
                  No hay rutas en el periodo seleccionado.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conductor</TableHead>
                      <TableHead>Rutas</TableHead>
                      <TableHead>Paradas completadas</TableHead>
                      <TableHead>Distancia planificada</TableHead>
                      <TableHead>Distancia real</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {driverRanking.map((driver) => (
                      <TableRow key={driver.driverId}>
                        <TableCell>{driver.fullName}</TableCell>
                        <TableCell>{driver.routes}</TableCell>
                        <TableCell>{driver.stopsCompleted}</TableCell>
                        <TableCell>{formatDistance(driver.plannedDistanceM)}</TableCell>
                        <TableCell>{formatDistance(driver.actualDistanceM)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Detalle de rutas</h2>
            </CardHeader>
            <CardContent className="p-0">
              {routes.length === 0 ? (
                <p className="p-6 font-body-md text-body-md text-on-surface-variant">
                  No hay rutas en el periodo seleccionado.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Conductor</TableHead>
                      <TableHead>Paradas</TableHead>
                      <TableHead>Distancia</TableHead>
                      <TableHead>Duración</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routes.map((route: ReportRouteRow) => (
                      <TableRow key={route.id}>
                        <TableCell>{route.routeDate}</TableCell>
                        <TableCell>{route.driver.fullName}</TableCell>
                        <TableCell>
                          {route.stopsCompleted} de {route.stopsTotal}
                        </TableCell>
                        <TableCell>{formatDistance(route.actualDistanceM)}</TableCell>
                        <TableCell>{formatDuration(route.durationS)}</TableCell>
                        <TableCell>
                          <Badge variant={routeStatusVariant(route.status)}>
                            {ROUTE_STATUS_LABELS[route.status] ?? route.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            to={`${routeBasePath}/${route.id}`}
                            className="font-label-lg text-label-lg text-primary hover:underline"
                          >
                            Ver ruta
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Toast
        show={toast.show}
        onClose={() => setToast({ ...toast, show: false })}
        title={toast.message}
        variant={toast.variant}
      />
    </div>
  );
}
