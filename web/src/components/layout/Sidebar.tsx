import { cn } from '@/lib/utils';
import { NavLink } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  comingSoon?: boolean;
}

export interface SidebarProps {
  user: {
    name: string;
    email: string;
    role: string;
    company?: string;
  };
  navItems: NavItem[];
  onLogout: () => void;
  className?: string;
}

export function Sidebar({ user, navItems, onLogout, className }: SidebarProps) {
  return (
    <aside className={cn('w-64 bg-surface-container-low border-r border-outline/50 flex flex-col h-full', className)}>
      <div className="p-4 border-b border-outline/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">local_shipping</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-headline-sm text-headline-sm text-on-surface truncate">FastRouteCO</h1>
            <p className="font-label-sm text-label-sm text-on-surface-variant">Panel de control</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto" role="navigation" aria-label="Navegación principal">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg font-label-md text-label-md transition-all',
                  isActive
                    ? 'bg-primary-container text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
                  item.comingSoon && 'opacity-60'
                )}
                title={item.comingSoon ? 'Próximamente' : ''}
              >
                <span className="material-symbols-outlined text-[20px] flex-shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
                {item.comingSoon && (
                  <span className="ml-auto px-1.5 py-0.5 text-[10px] font-label-sm font-semibold rounded-full bg-surface-container-highest text-on-surface-variant">
                    Próximamente
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-outline/50">
        <div className="flex items-center gap-3 mb-3">
          <Avatar name={user.name} size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-label-md text-label-md text-on-surface truncate">{user.name}</p>
            <p className="font-label-sm text-label-sm text-on-surface-variant truncate">{user.company || user.role}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md text-label-md transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}