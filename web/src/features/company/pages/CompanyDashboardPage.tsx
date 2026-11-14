import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { reportApi } from '@/features/reports/api';
import { formatDistance, formatDuration } from '@/lib/order-utils';
import type { CompanyDashboard } from '@/lib/report-utils';

export function CompanyDashboardPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<CompanyDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reportApi
      .getDashboard()
      .then((response) => setDashboard(response.data as CompanyDashboard))
      .catch(() => setError('No se pudo cargar el panel de control.'));
  }, []);

  if (error) {
    return <p className="font-body-md text-body-md text-error">{error}</p>;
  }

  if (!dashboard) {
    return (
      <p className="font-body-md text-body-md text-on-surface-variant">
        Cargando panel de control...
      </p>
    );
  }

  const monthly = dashboard.month.metrics;

  return (
    <div className="space-y-6 animate-in">
      <header>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">
          Bienvenido, {user?.full_name || 'Administrador'}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Panel de control de{' '}
          <span className="font-semibold text-on-surface">{user?.company_name || 'tu empresa'}</span>
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <span className="font-label-md text-label-md text-on-surface-variant">Plan actual</span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">
              {dashboard.subscription?.planName ?? 'Sin plan'}
            </h2>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant={dashboard.subscription ? 'success' : 'error'}>
                {dashboard.subscription ? 'Suscripción activa' : 'Sin suscripción'}
              </Badge>
              {dashboard.subscription?.maxDrivers !== null && dashboard.subscription && (
                <Badge variant="warning">
                  {dashboard.subscription.maxDrivers} conductores máx.
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <span className="font-label-md text-label-md text-on-surface-variant">
              Créditos disponibles
            </span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">
              {dashboard.credits.total}
            </h2>
            <p className="mt-4 font-body-sm text-body-sm text-on-surface-variant">
              {dashboard.credits.planCredits} del plan + {dashboard.credits.extraCredits} adicionales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <span className="font-label-md text-label-md text-on-surface-variant">
              Conductores activos
            </span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">
              {dashboard.drivers.available} / {dashboard.drivers.total}
            </h2>
            <p className="mt-4 font-body-sm text-body-sm text-on-surface-variant">
              Disponibles ahora
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <span className="font-label-md text-label-md text-on-surface-variant">
              Rutas de hoy
            </span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">
              {dashboard.today.routes}
            </h2>
            <p className="mt-4 font-body-sm text-body-sm text-on-surface-variant">
              {dashboard.today.active} en progreso · {dashboard.today.completed} completadas
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Estado de la operación</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low">
              <span className="font-label-md text-label-md text-on-surface">Pedidos pendientes</span>
              <span className="font-headline-md text-headline-md text-primary">
                {dashboard.orders.pending}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low">
              <span className="font-label-md text-label-md text-on-surface">Pedidos urgentes</span>
              <span className="font-headline-md text-headline-md text-error">
                {dashboard.orders.urgentPending}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low">
              <span className="font-label-md text-label-md text-on-surface">Incidencias abiertas</span>
              <span className="font-headline-md text-headline-md text-error">
                {dashboard.incidents.open}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Resumen del mes</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low">
              <span className="font-label-md text-label-md text-on-surface">Rutas realizadas</span>
              <span className="font-headline-md text-headline-md text-on-surface">
                {monthly.routesTotal}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low">
              <span className="font-label-md text-label-md text-on-surface">Cumplimiento de paradas</span>
              <span className="font-headline-md text-headline-md text-tertiary">
                {monthly.completionRate}%
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low">
              <span className="font-label-md text-label-md text-on-surface">Distancia real</span>
              <span className="font-headline-md text-headline-md text-secondary">
                {formatDistance(monthly.actualDistanceM)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low">
              <span className="font-label-md text-label-md text-on-surface">Duración promedio por ruta</span>
              <span className="font-headline-md text-headline-md text-primary">
                {formatDuration(monthly.averageRouteDurationS)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Accesos rápidos</h2>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { to: '/company/orders', icon: 'inventory', label: 'Pedidos' },
            { to: '/company/routes', icon: 'route', label: 'Rutas' },
            { to: '/company/students', icon: 'school', label: 'Estudiantes' },
            { to: '/company/reports', icon: 'analytics', label: 'Reportes' },
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
    </div>
  );
}
