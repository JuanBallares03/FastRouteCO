import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LoginPage } from '@/pages/auth/LoginPage';
import { SetPasswordPage } from '@/pages/auth/SetPasswordPage';
import { PlatformAdminLayout } from '@/pages/platform-admin/PlatformAdminLayout';
import { CompaniesPage } from '@/pages/platform-admin/CompaniesPage';
import { RegisterCompanyPage } from '@/pages/platform-admin/RegisterCompanyPage';
import { CompanyDetailPage } from '@/pages/platform-admin/CompanyDetailPage';
import { CompanyAdminLayout } from '@/pages/company-admin/CompanyAdminLayout';
import { CompanyDashboardPage } from '@/pages/company-admin/CompanyDashboardPage';
import { SupervisorLayout } from '@/pages/supervisor/SupervisorLayout';
import { SupervisorDashboardPage } from '@/pages/supervisor/SupervisorDashboardPage';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="font-body-md text-body-md text-on-surface-variant">Cargando...</span>
        </div>
      </div>
    );
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="font-body-md text-body-md text-on-surface-variant">Cargando...</span>
        </div>
      </div>
    );
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
      </Route>

      <Route path="/company/*" element={
        <ProtectedRoute allowedRoles={['company_admin']}>
          <CompanyAdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<CompanyDashboardPage />} />
      </Route>

      <Route path="/supervisor/*" element={
        <ProtectedRoute allowedRoles={['supervisor']}>
          <SupervisorLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<SupervisorDashboardPage />} />
      </Route>

      <Route path="/dashboard" element={
        <ProtectedRoute allowedRoles={[]}>
          <Navigate to="/login" replace />
        </ProtectedRoute>
      } />

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