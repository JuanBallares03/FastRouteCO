import { useAuth } from '@/context/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Outlet } from 'react-router-dom';

const COMPANY_ADMIN_NAV = [
  { label: 'Mi empresa', path: '/company/dashboard', icon: 'dashboard' },
  { label: 'Sedes', path: '/company/branches', icon: 'location_city', comingSoon: true },
  { label: 'Supervisores', path: '/company/supervisors', icon: 'supervisor_account', comingSoon: true },
  { label: 'Conductores', path: '/company/drivers', icon: 'directions_car', comingSoon: true },
  { label: 'Pedidos', path: '/company/orders', icon: 'inventory', comingSoon: true },
  { label: 'Rutas', path: '/company/routes', icon: 'route', comingSoon: true },
  { label: 'Reportes', path: '/company/reports', icon: 'analytics', comingSoon: true },
  { label: 'Suscripción', path: '/company/subscription', icon: 'workspace_premium', comingSoon: true },
  { label: 'Créditos', path: '/company/credits', icon: 'account_balance_wallet', comingSoon: true },
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