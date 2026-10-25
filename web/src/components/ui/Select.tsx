import type { SelectHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Array<{ value: string; label: string }>;
  error?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, error, id, ...props }, ref) => {
    const selectId = id || label.toLowerCase().replace(/\s+/g, '-');
    
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={selectId} className="font-label-md text-label-md text-on-surface-variant">
          {label}
        </label>
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'w-full h-11 px-4 bg-surface-container-low text-on-surface font-label-lg text-label-lg rounded-lg',
              'focus:outline-none focus:bg-surface-container-lowest',
              'transition-all cursor-pointer appearance-none',
              error
                ? 'focus:ring-2 focus:ring-error/20 border border-error pr-10'
                : 'focus:ring-2 focus:ring-primary/20 border-0 pr-10',
              className
            )}
            aria-invalid={error ? 'true' : 'false'}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">
            expand_more
          </span>
        </div>
        {error && (
          <p className="font-body-sm text-body-sm text-error" role="alert">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
export { Select };