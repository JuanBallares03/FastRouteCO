import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function CompanyDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 animate-in">
      <header>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Bienvenido, {user?.full_name || 'Administrador'}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Panel de control de <span className="font-semibold text-on-surface">{user?.company_name || 'tu empresa'}</span>
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-label-md text-label-md text-on-surface-variant">Plan actual</span>
                <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">Pro</h2>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary-container text-on-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[28px]">workspace_premium</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Badge variant="success">Suscripción activa</Badge>
              <Badge variant="warning">10 conductores máx.</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-label-md text-label-md text-on-surface-variant">Créditos disponibles</span>
                <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">847</h2>
              </div>
              <div className="w-12 h-12 rounded-xl bg-tertiary-container text-on-tertiary flex items-center justify-center">
                <span className="material-symbols-outlined text-[28px]">account_balance_wallet</span>
              </div>
            </div>
            <div className="mt-4 font-body-sm text-body-sm text-on-surface-variant">
              Se renueban el 1 de cada mes
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-label-md text-label-md text-on-surface-variant">Estado Free Trial</span>
                <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">Finalizado</h2>
              </div>
              <div className="w-12 h-12 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[28px]">event</span>
              </div>
            </div>
            <div className="mt-4 font-body-sm text-body-sm text-on-surface-variant">
              Plan Pro activo desde marzo 2024
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">Accesos rápidos</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <a href="/company/branches" className="p-4 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors text-center">
                <span className="material-symbols-outlined text-[28px] text-primary block mb-2">location_city</span>
                <span className="font-label-md text-label-md text-on-surface">Sedes</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant block mt-1">Próximamente</span>
              </a>
              <a href="/company/supervisors" className="p-4 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors text-center">
                <span className="material-symbols-outlined text-[28px] text-secondary block mb-2">supervisor_account</span>
                <span className="font-label-md text-label-md text-on-surface">Supervisores</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant block mt-1">Próximamente</span>
              </a>
              <a href="/company/drivers" className="p-4 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors text-center">
                <span className="material-symbols-outlined text-[28px] text-tertiary block mb-2">directions_car</span>
                <span className="font-label-md text-label-md text-on-surface">Conductores</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant block mt-1">Próximamente</span>
              </a>
              <a href="/company/orders" className="p-4 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors text-center">
                <span className="material-symbols-outlined text-[28px] text-secondary block mb-2">inventory</span>
                <span className="font-label-md text-label-md text-on-surface">Pedidos</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant block mt-1">Próximamente</span>
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">Estado de la operación</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[24px] text-tertiary">check_circle</span>
                  <span className="font-label-md text-label-md text-on-surface">Conductores activos</span>
                </div>
                <span className="font-headline-md text-headline-md text-tertiary">0 / 10</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[24px] text-secondary">route</span>
                  <span className="font-label-md text-label-md text-on-surface">Rutas hoy</span>
                </div>
                <span className="font-headline-md text-headline-md text-secondary">0</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[24px] text-primary">pending_actions</span>
                  <span className="font-label-md text-label-md text-on-surface">Pedidos pendientes</span>
                </div>
                <span className="font-headline-md text-headline-md text-primary">0</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[24px] text-error">warning</span>
                  <span className="font-label-md text-label-md text-on-surface">Incidencias abiertas</span>
                </div>
                <span className="font-headline-md text-headline-md text-error">0</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">Próximos pasos recomendados</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low">
              <span className="material-symbols-outlined text-[24px] text-primary">add_location</span>
              <div className="flex-1">
                <span className="font-label-md text-label-md text-on-surface block">Registrar la primera sede</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">Define la ubicación central de operaciones</span>
              </div>
              <Badge variant="info">Pendiente</Badge>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low">
              <span className="material-symbols-outlined text-[24px] text-secondary">person_add</span>
              <div className="flex-1">
                <span className="font-label-md text-label-md text-on-surface block">Agregar supervisores de logística</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">Gestionarán conductores, pedidos y rutas</span>
              </div>
              <Badge variant="info">Pendiente</Badge>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low">
              <span className="material-symbols-outlined text-[24px] text-tertiary">directions_bike</span>
              <div className="flex-1">
                <span className="font-label-md text-label-md text-on-surface block">Registrar conductores y vehículos</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">Flota disponible para asignación de rutas</span>
              </div>
              <Badge variant="info">Pendiente</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}