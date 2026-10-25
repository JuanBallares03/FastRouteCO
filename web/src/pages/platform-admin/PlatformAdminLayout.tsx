import { useAuth } from '@/context/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Outlet } from 'react-router-dom';

const PLATFORM_ADMIN_NAV = [
  { label: 'Empresas vinculadas', path: '/platform/companies', icon: 'apartment' },
  { label: 'Planes y módulos', path: '/platform/plans', icon: 'workspace_premium', comingSoon: true },
  { label: 'Cobros y pagos', path: '/platform/billing', icon: 'payments', comingSoon: true },
  { label: 'Soporte técnico', path: '/platform/support', icon: 'support_agent', comingSoon: true },
  { label: 'Configuración global', path: '/platform/settings', icon: 'settings', comingSoon: true },
];

export function PlatformAdminLayout() {
  const { user, logout } = useAuth();

  return (
    <DashboardLayout
      user={{ name: user?.full_name || 'Administrador', email: user?.email || '', role: 'Platform Admin' }}
      navItems={PLATFORM_ADMIN_NAV}
      onLogout={logout}
      headerTitle="Administración Global"
      headerSubtitle="Control y administración de clientes corporativos en la plataforma FastRouteCO"
    >
      <Outlet />
    </DashboardLayout>
  );
}