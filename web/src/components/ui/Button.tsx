import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-label-lg text-label-lg rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variants = {
      primary: 'bg-primary text-on-primary hover:bg-primary-container active:bg-on-primary-fixed shadow-md hover:shadow-lg active:scale-[0.99]',
      secondary: 'bg-surface-container-lowest border border-outline text-on-surface hover:bg-surface-container shadow-sm',
      destructive: 'bg-error text-on-error hover:bg-red-700',
      ghost: 'bg-transparent hover:bg-surface-container text-on-surface',
      success: 'bg-tertiary-container text-on-tertiary hover:bg-tertiary hover:text-on-tertiary shadow-md hover:shadow-lg active:scale-[0.99]',
    };
    
    const sizes = {
      sm: 'px-3 py-1.5 text-label-sm gap-1.5',
      md: 'px-5 py-2.5',
      lg: 'px-6 py-3 text-label-lg',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export { Button };