import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'neutral', children, ...props }, ref) => {
    const variants = {
      success: 'bg-tertiary-fixed text-tertiary',
      warning: 'bg-secondary-fixed text-on-secondary-fixed',
      error: 'bg-error-container text-on-error-container',
      info: 'bg-primary-fixed text-on-primary-fixed',
      neutral: 'bg-surface-container-high text-on-surface-variant',
    };
    
    const indicatorColors = {
      success: 'bg-tertiary-container',
      warning: 'bg-secondary-container',
      error: 'bg-error',
      info: 'bg-primary-container',
      neutral: 'bg-outline',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm',
          variants[variant],
          className
        )}
        {...props}
      >
        <span className={cn('w-2 h-2 rounded-full', indicatorColors[variant])} />
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
export { Badge };