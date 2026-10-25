import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export interface DashboardLayoutProps {
  user: {
    name: string;
    email: string;
    role: string;
    company?: string;
  };
  navItems: Array<{
    label: string;
    path: string;
    icon: string;
    comingSoon?: boolean;
  }>;
  onLogout: () => void;
  headerTitle: string;
  headerSubtitle?: string;
  headerBreadcrumb?: Array<{ label: string; path?: string }>;
  headerActions?: ReactNode;
  children?: ReactNode;
}

export function DashboardLayout({ 
  user, 
  navItems, 
  onLogout, 
  headerTitle, 
  headerSubtitle, 
  headerBreadcrumb, 
  headerActions,
  children
}: DashboardLayoutProps) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar user={user} navItems={navItems} onLogout={onLogout} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title={headerTitle}
          subtitle={headerSubtitle}
          breadcrumb={headerBreadcrumb}
          actions={headerActions}
          user={{ name: user.name }}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}