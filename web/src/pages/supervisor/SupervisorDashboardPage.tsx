import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function SupervisorDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 animate-in">
      <header>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Bienvenido, {user?.full_name || 'Supervisor'}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Supervisión logística para <span className="font-semibold text-on-surface">{user?.company_name || 'tu empresa'}</span>
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-label-md text-label-md text-on-surface-variant">Conductores en turno</span>
                <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">0</h2>
              </div>
              <div className="w-12 h-12 rounded-xl bg-tertiary-container text-on-tertiary flex items-center justify-center">
                <span className="material-symbols-outlined text-[28px]">directions_bike</span>
              </div>
            </div>
            <div className="mt-4 font-body-sm text-body-sm text-on-surface-variant">
              0 de 10 disponibles
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-label-md text-label-md text-on-surface-variant">Rutas activas hoy</span>
                <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">0</h2>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary-container text-on-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[28px]">route</span>
              </div>
            </div>
            <div className="mt-4 font-body-sm text-body-sm text-on-surface-variant">
              0 completadas, 0 en progreso
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-label-md text-label-md text-on-surface-variant">Pedidos pendientes</span>
                <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">0</h2>
              </div>
              <div className="w-12 h-12 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[28px]">pending_actions</span>
              </div>
            </div>
            <div className="mt-4 font-body-sm text-body-sm text-on-surface-variant">
              0 urgentes, 0 normales
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-label-md text-label-md text-on-surface-variant">Incidencias abiertas</span>
                <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">0</h2>
              </div>
              <div className="w-12 h-12 rounded-xl bg-error-container text-on-error-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[28px]">report_problem</span>
              </div>
            </div>
            <div className="mt-4 font-body-sm text-body-sm text-on-surface-variant">
              Sin incidencias reportadas
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">Acciones rápidas</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <a href="/supervisor/drivers" className="p-4 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors text-center">
                <span className="material-symbols-outlined text-[28px] text-tertiary block mb-2">person_add</span>
                <span className="font-label-md text-label-md text-on-surface">Iniciar turno</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant block mt-1">Próximamente</span>
              </a>
              <a href="/supervisor/orders" className="p-4 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors text-center">
                <span className="material-symbols-outlined text-[28px] text-primary block mb-2">add_circle</span>
                <span className="font-label-md text-label-md text-on-surface">Crear pedido</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant block mt-1">Próximamente</span>
              </a>
              <a href="/supervisor/routes" className="p-4 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors text-center">
                <span className="material-symbols-outlined text-[28px] text-secondary block mb-2">route</span>
                <span className="font-label-md text-label-md text-on-surface">Crear ruta</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant block mt-1">Próximamente</span>
              </a>
              <a href="/supervisor/live-map" className="p-4 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors text-center">
                <span className="material-symbols-outlined text-[28px] text-primary block mb-2">map</span>
                <span className="font-label-md text-label-md text-on-surface">Ver mapa</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant block mt-1">Próximamente</span>
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">Estado de la flota</h3>
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-surface-container-low flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-tertiary-container" />
                  <span className="font-label-md text-label-md text-on-surface">Flota operativa</span>
                </div>
                <Badge variant="success">Normal</Badge>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-low flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-secondary-container" />
                  <span className="font-label-md text-label-md text-on-surface">Cobertura GPS</span>
                </div>
                <Badge variant="warning">Sin datos</Badge>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-low flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-error-container" />
                  <span className="font-label-md text-label-md text-on-surface">Alertas de mantenimiento</span>
                </div>
                <Badge variant="error">0 alertas</Badge>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-low flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-primary-container" />
                  <span className="font-label-md text-label-md text-on-surface">Capacidad disponible</span>
                </div>
                <span className="font-headline-md text-headline-md text-primary">100%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">Resumen operativo del día</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-surface-container-low text-center">
              <span className="font-display-lg text-display-lg text-primary tracking-tight font-bold block">0</span>
              <span className="font-label-md text-label-md text-on-surface-variant">Entregas completadas</span>
            </div>
            <div className="p-4 rounded-xl bg-surface-container-low text-center">
              <span className="font-display-lg text-display-lg text-secondary tracking-tight font-bold block">0 km</span>
              <span className="font-label-md text-label-md text-on-surface-variant">Kilómetros recorridos</span>
            </div>
            <div className="p-4 rounded-xl bg-surface-container-low text-center">
              <span className="font-display-lg text-display-lg text-tertiary tracking-tight font-bold block">0 min</span>
              <span className="font-label-md text-label-md text-on-surface-variant">Tiempo promedio por entrega</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}