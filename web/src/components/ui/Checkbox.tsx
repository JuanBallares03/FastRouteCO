import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
  error?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, error, id, ...props }, ref) => {
    const checkboxId = id || label.toLowerCase().replace(/\s+/g, '-');
    
    return (
      <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-4', className)}>
        <label className="flex items-start gap-3 cursor-pointer select-none" htmlFor={checkboxId}>
          <div className="relative flex items-center mt-0.5 flex-shrink-0">
            <input
              ref={ref}
              type="checkbox"
              id={checkboxId}
              className="peer h-5 w-5 appearance-none rounded bg-surface-container-lowest checked:bg-primary-container checked:shadow-sm transition-all cursor-pointer focus:outline-none"
              {...props}
            />
            <span className="material-symbols-outlined pointer-events-none absolute left-0 text-[20px] text-on-primary opacity-0 peer-checked:opacity-100 transition-opacity">
              check
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-label-lg text-label-lg text-on-surface font-semibold flex items-center gap-1.5">
              {label}
              {error && <span className="text-error font-bold">*</span>}
            </span>
            {description && (
              <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                {description}
              </span>
            )}
          </div>
        </label>
        {error && (
          <p className="font-body-sm text-body-sm text-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
export { Checkbox };