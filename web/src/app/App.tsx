import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FullScreenLoader } from '@/components/layout/FullScreenLoader';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { SetPasswordPage } from '@/features/auth/pages/SetPasswordPage';
import { PlatformAdminLayout } from '@/features/platform/pages/PlatformAdminLayout';
import { CompaniesPage } from '@/features/platform/pages/CompaniesPage';
import { RegisterCompanyPage } from '@/features/platform/pages/RegisterCompanyPage';
import { CompanyDetailPage } from '@/features/platform/pages/CompanyDetailPage';
import { PlansPage } from '@/features/platform/pages/PlansPage';
import { MonitoringPage } from '@/features/platform/pages/MonitoringPage';
import { SettingsPage } from '@/features/platform/pages/SettingsPage';
import { CompanyAdminLayout } from '@/features/company/pages/CompanyAdminLayout';
import { CompanyDashboardPage } from '@/features/company/pages/CompanyDashboardPage';
import { MyCompanyPage } from '@/features/company/pages/MyCompanyPage';
import { BranchesPage } from '@/features/company/pages/BranchesPage';
import { SupervisorsPage } from '@/features/company/pages/SupervisorsPage';
import { DriversPage } from '@/features/company/pages/DriversPage';
import { BillingPage } from '@/features/billing/pages/BillingPage';
import { CompanySupportPage } from '@/features/support/pages/CompanySupportPage';
import { PlatformSupportPage } from '@/features/support/pages/PlatformSupportPage';
import { StudentsPage } from '@/features/students/pages/StudentsPage';
import { ReportsPage } from '@/features/reports/pages/ReportsPage';
import { SupervisorLayout } from '@/features/supervisor/pages/SupervisorLayout';
import { SupervisorDashboardPage } from '@/features/supervisor/pages/SupervisorDashboardPage';
import { OrdersPage } from '@/features/orders/pages/OrdersPage';
import { RoutesPage } from '@/features/routes/pages/RoutesPage';
import { RouteDetailPage } from '@/features/routes/pages/RouteDetailPage';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={
        <PublicRoute>
          <LoginPage />
        </PublicRoute>
      } />
      <Route path="/set-password" element={
        <PublicRoute>
          <SetPasswordPage />
        </PublicRoute>
      } />

      <Route path="/platform/*" element={
        <ProtectedRoute allowedRoles={['platform_admin']}>
          <PlatformAdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="companies" replace />} />
        <Route path="companies" element={<CompaniesPage />} />
        <Route path="companies/new" element={<RegisterCompanyPage />} />
        <Route path="companies/:id" element={<CompanyDetailPage />} />
        <Route path="plans" element={<PlansPage />} />
        <Route path="monitoring" element={<MonitoringPage />} />
        <Route path="support" element={<PlatformSupportPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="/company/*" element={
        <ProtectedRoute allowedRoles={['company_admin']}>
          <CompanyAdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<CompanyDashboardPage />} />
        <Route path="profile" element={<MyCompanyPage />} />
        <Route path="branches" element={<BranchesPage />} />
        <Route path="supervisors" element={<SupervisorsPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="routes" element={<RoutesPage />} />
        <Route path="routes/:id" element={<RouteDetailPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="support" element={<CompanySupportPage />} />
        <Route path="billing" element={<BillingPage />} />
      </Route>

      <Route path="/supervisor/*" element={
        <ProtectedRoute allowedRoles={['supervisor']}>
          <SupervisorLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<SupervisorDashboardPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="routes" element={<RoutesPage />} />
        <Route path="routes/:id" element={<RouteDetailPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>

      <Route path="/dashboard" element={
        <ProtectedRoute allowedRoles={[]}>
          <RoleRedirect />
        </ProtectedRoute>
      }/>

      <Route path="/unauthorized" element={
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="text-center max-w-md">
            <span className="material-symbols-outlined text-6xl text-error">block</span>
            <h1 className="font-headline-lg text-headline-lg text-on-surface mt-4">Acceso no autorizado</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-2">No tienes permisos para acceder a esta sección.</p>
          </div>
        </div>
      } />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function RoleRedirect() {
  const { user } = useAuth();
  const homeByRole: Record<string, string> = {
    platform_admin: '/platform/companies',
    company_admin: '/company/dashboard',
    supervisor: '/supervisor/dashboard',
  };
  const target = user ? homeByRole[user.role] : undefined;
  return <Navigate to={target ?? '/unauthorized'} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;