import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { reportApi } from '@/features/reports/api';
import { formatDistance, formatDuration } from '@/lib/order-utils';
import type { CompanyDashboard } from '@/lib/report-utils';

export function SupervisorDashboardPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<CompanyDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reportApi
      .getDashboard()
      .then((response) => setDashboard(response.data as CompanyDashboard))
      .catch(() => setError('No se pudo cargar el panel de supervisión.'));
  }, []);

  if (error) {
    return <p className="font-body-md text-body-md text-error">{error}</p>;
  }

  if (!dashboard) {
    return (
      <p className="font-body-md text-body-md text-on-surface-variant">
        Cargando panel de supervisión...
      </p>
    );
  }

  const monthly = dashboard.month.metrics;

  return (
    <div className="space-y-6 animate-in">
      <header>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">
          Bienvenido, {user?.full_name || 'Supervisor'}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Supervisión logística para{' '}
          <span className="font-semibold text-on-surface">{user?.company_name || 'tu empresa'}</span>
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <span className="font-label-md text-label-md text-on-surface-variant">
              Conductores disponibles
            </span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">
              {dashboard.drivers.available} / {dashboard.drivers.total}
            </h2>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <span className="font-label-md text-label-md text-on-surface-variant">
              Rutas activas hoy
            </span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">
              {dashboard.today.active}
            </h2>
            <p className="mt-4 font-body-sm text-body-sm text-on-surface-variant">
              {dashboard.today.completed} completadas de {dashboard.today.routes}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <span className="font-label-md text-label-md text-on-surface-variant">
              Pedidos pendientes
            </span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">
              {dashboard.orders.pending}
            </h2>
            <p className="mt-4 font-body-sm text-body-sm text-on-surface-variant">
              {dashboard.orders.urgentPending} urgentes
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <span className="font-label-md text-label-md text-on-surface-variant">
              Incidencias abiertas
            </span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">
              {dashboard.incidents.open}
            </h2>
            {dashboard.incidents.open === 0 ? (
              <Badge variant="success" className="mt-4">Sin incidencias</Badge>
            ) : (
              <Badge variant="error" className="mt-4">Requieren atención</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Acciones rápidas</h2>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { to: '/supervisor/drivers', icon: 'person_add', label: 'Conductores' },
              { to: '/supervisor/orders', icon: 'add_circle', label: 'Crear pedido' },
              { to: '/supervisor/routes', icon: 'route', label: 'Crear ruta' },
              { to: '/supervisor/reports', icon: 'analytics', label: 'Reportes' },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="p-4 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors text-center"
              >
                <span className="material-symbols-outlined text-[28px] text-primary block mb-2">
                  {item.icon}
                </span>
                <span className="font-label-md text-label-md text-on-surface">{item.label}</span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Resumen del mes</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Rutas realizadas', value: monthly.routesTotal },
              { label: 'Cumplimiento de paradas', value: `${monthly.completionRate}%` },
              { label: 'Distancia real', value: formatDistance(monthly.actualDistanceM) },
              { label: 'Duración promedio por ruta', value: formatDuration(monthly.averageRouteDurationS) },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low"
              >
                <span className="font-label-md text-label-md text-on-surface">{item.label}</span>
                <span className="font-headline-md text-headline-md text-on-surface">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
