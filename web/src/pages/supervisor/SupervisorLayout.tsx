import { useAuth } from '@/context/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Outlet } from 'react-router-dom';

const SUPERVISOR_NAV = [
  { label: 'Inicio', path: '/supervisor/dashboard', icon: 'dashboard' },
  { label: 'Conductores', path: '/supervisor/drivers', icon: 'directions_car', comingSoon: true },
  { label: 'Pedidos', path: '/supervisor/orders', icon: 'inventory', comingSoon: true },
  { label: 'Rutas', path: '/supervisor/routes', icon: 'route', comingSoon: true },
  { label: 'Mapa en vivo', path: '/supervisor/live-map', icon: 'map', comingSoon: true },
  { label: 'Incidencias', path: '/supervisor/incidents', icon: 'report_problem', comingSoon: true },
  { label: 'Reportes', path: '/supervisor/reports', icon: 'analytics', comingSoon: true },
];

export function SupervisorLayout() {
  const { user, logout } = useAuth();

  return (
    <DashboardLayout
      user={{ name: user?.full_name || 'Supervisor', email: user?.email || '', role: 'Logistics Supervisor', company: user?.company_name }}
      navItems={SUPERVISOR_NAV}
      onLogout={logout}
      headerTitle="Supervisión logística"
      headerSubtitle="Gestión diaria de operaciones de reparto y flota"
    >
      <Outlet />
    </DashboardLayout>
  );
}