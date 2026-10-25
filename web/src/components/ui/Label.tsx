import type { LabelHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn('block font-label-md text-label-md text-on-surface-variant mb-1.5', className)}
        {...props}
      >
        {children}
      </label>
    );
  }
);

Label.displayName = 'Label';
export { Label };