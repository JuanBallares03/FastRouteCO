import { useAuth } from '@/context/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Outlet } from 'react-router-dom';

const COMPANY_ADMIN_NAV = [
  { label: 'Inicio', path: '/company/dashboard', icon: 'dashboard' },
  { label: 'Mi empresa', path: '/company/profile', icon: 'domain' },
  { label: 'Sedes', path: '/company/branches', icon: 'location_city' },
  { label: 'Supervisores', path: '/company/supervisors', icon: 'supervisor_account' },
  { label: 'Conductores', path: '/company/drivers', icon: 'directions_car' },
  { label: 'Pedidos', path: '/company/orders', icon: 'inventory' },
  { label: 'Rutas', path: '/company/routes', icon: 'route' },
  { label: 'Reportes', path: '/company/reports', icon: 'analytics', comingSoon: true },
  { label: 'Suscripción y créditos', path: '/company/billing', icon: 'workspace_premium' },
  { label: 'Configuración', path: '/company/settings', icon: 'settings', comingSoon: true },
];

export function CompanyAdminLayout() {
  const { user, logout } = useAuth();

  return (
    <DashboardLayout
      user={{ name: user?.full_name || 'Administrador', email: user?.email || '', role: 'Company Admin', company: user?.company_name }}
      navItems={COMPANY_ADMIN_NAV}
      onLogout={logout}
      headerTitle="Panel de la empresa"
      headerSubtitle="Gestión integral de la cuenta corporativa"
    >
      <Outlet />
    </DashboardLayout>
  );
}