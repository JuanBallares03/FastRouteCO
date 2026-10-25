import React, { type ReactNode } from 'react';
import { Avatar } from '@/components/ui/Avatar';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: Array<{ label: string; path?: string }>;
  actions?: ReactNode;
  user?: {
    name: string;
    avatar?: string;
  };
}

export function Header({ title, subtitle, breadcrumb, actions, user }: HeaderProps) {
  return (
    <header className="bg-surface-container-lowest border-b border-outline/50 px-6 py-4 sticky top-0 z-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col">
          {breadcrumb && breadcrumb.length > 0 && (
            <nav aria-label="Ruta de navegación" className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant mb-1">
              {breadcrumb.map((item, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <span className="material-symbols-outlined text-[14px] text-outline-variant">chevron_right</span>}
                  {item.path ? (
                    <a href={item.path} className="hover:text-primary transition-colors">{item.label}</a>
                  ) : (
                    <span className="text-on-surface font-label-lg text-label-lg truncate max-w-xs md:max-w-md">{item.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">{title}</h1>
          {subtitle && <p className="font-body-md text-body-md text-on-surface-variant mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {actions}
          {user && (
            <div className="flex items-center gap-3 pl-3 border-l border-outline/50">
              <Avatar name={user.name} src={user.avatar} size="sm" />
              <div className="hidden sm:block text-right">
                <p className="font-label-md text-label-md text-on-surface">{user.name}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}