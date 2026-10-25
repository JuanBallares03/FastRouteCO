import type { HTMLAttributes, TableHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type TableProps = TableHTMLAttributes<HTMLTableElement>;

const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ className, ...props }, ref) => (
    <div className="overflow-x-auto">
      <table
        ref={ref}
        className={cn('w-full text-left border-collapse', className)}
        {...props}
      />
    </div>
  )
);
Table.displayName = 'Table';

const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn('[&_tr]:bg-surface-container-low [&_th]:text-on-surface-variant [&_th]:font-label-sm [&_th]:text-label-sm [&_th]:uppercase [&_th]:tracking-wider [&_th]:select-none', className)} {...props} />
  )
);
TableHeader.displayName = 'TableHeader';

const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('[&_tr:last-child]:border-0 [&_tr]:hover:bg-surface-container-low/70 [&_tr]:transition-colors font-body-md text-body-md text-on-surface divide-y divide-surface-container', className)} {...props} />
  )
);
TableBody.displayName = 'TableBody';

const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr ref={ref} className={cn('', className)} {...props} />
  )
);
TableRow.displayName = 'TableRow';

interface TableCellProps extends HTMLAttributes<HTMLTableCellElement> {
  colSpan?: number;
}

const TableHead = forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, colSpan, ...props }, ref) => (
    <th ref={ref} colSpan={colSpan} className={cn('py-3 px-4 font-semibold', className)} {...props} />
  )
);
TableHead.displayName = 'TableHead';

const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, colSpan, ...props }, ref) => (
    <td ref={ref} colSpan={colSpan} className={cn('py-3.5 px-4', className)} {...props} />
  )
);
TableCell.displayName = 'TableCell';

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };