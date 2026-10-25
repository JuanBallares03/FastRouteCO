import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, name, size = 'md', ...props }, ref) => {
    const sizes = {
      sm: 'w-8 h-8 text-label-sm',
      md: 'w-10 h-10 text-label-md',
      lg: 'w-12 h-12 text-label-lg',
      xl: 'w-16 h-16 text-headline-sm',
    };

    const getInitials = (name: string) => {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    };

    const getColorFromName = (name: string) => {
      const colors = [
        'bg-primary-fixed text-on-primary-fixed',
        'bg-secondary-fixed text-on-secondary-fixed',
        'bg-tertiary-fixed text-on-tertiary-fixed',
        'bg-primary-container text-on-primary-container',
        'bg-secondary-container text-on-secondary-container',
        'bg-tertiary-container text-on-tertiary-container',
        'bg-surface-container-highest text-on-surface',
      ];
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
      }
      return colors[Math.abs(hash) % colors.length];
    };

    return (
      <div
        ref={ref}
        className={cn('rounded-full flex items-center justify-center font-semibold shrink-0 overflow-hidden', sizes[size], className)}
        {...props}
      >
        {src ? (
          <img src={src} alt={alt || name || 'Avatar'} className="w-full h-full object-cover" />
        ) : name ? (
          <span className={cn('w-full h-full flex items-center justify-center', getColorFromName(name))}>
            {getInitials(name)}
          </span>
        ) : (
          <span className="material-symbols-outlined text-on-surface-variant">person</span>
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';
export { Avatar };