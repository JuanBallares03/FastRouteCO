import { useState, useRef, useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface DropdownProps {
  trigger: ReactNode;
  items: Array<{
    label: string;
    onClick: () => void;
    icon?: ReactNode;
    variant?: 'default' | 'destructive';
    disabled?: boolean;
  }>;
  align?: 'left' | 'right';
}

export function Dropdown({ trigger, items, align = 'right' }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative inline-block">
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            'absolute mt-1 w-44 bg-surface-container-lowest rounded-lg shadow-xl py-1 z-20',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {items.map((item, index) => (
            <button
              key={index}
              onClick={() => { item.onClick(); setOpen(false); }}
              disabled={item.disabled}
              className={cn(
                'w-full text-left px-4 py-2 font-label-sm text-label-sm flex items-center gap-2 transition-colors',
                item.variant === 'destructive' 
                  ? 'text-error hover:bg-error-container/30' 
                  : 'text-on-surface hover:bg-surface-container',
                item.disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {item.icon && <span className="material-symbols-outlined text-[16px]">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface DropdownMenuProps {
  open: boolean;
  onClose: () => void;
  items?: Array<{
    label: string;
    onClick: () => void;
    icon?: ReactNode;
    variant?: 'default' | 'destructive' | 'success';
    disabled?: boolean;
  }>;
  children?: ReactNode;
  className?: string;
}

export function DropdownMenu({ open, onClose, items, children, className }: DropdownMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      className={cn('absolute right-0 mt-1 w-44 bg-surface-container-lowest rounded-lg shadow-xl py-1 z-20', className)}
    >
      {children || items?.map((item, index) => (
        <button
          key={index}
          onClick={() => { item.onClick(); onClose(); }}
          disabled={item.disabled}
          className={cn(
            'w-full text-left px-4 py-2 font-label-sm text-label-sm flex items-center gap-2 transition-colors',
            item.variant === 'destructive' 
              ? 'text-error hover:bg-error-container/30' 
              : item.variant === 'success'
              ? 'text-tertiary-container hover:bg-tertiary-fixed/30'
              : 'text-on-surface hover:bg-surface-container',
            item.disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {item.icon && <span className="material-symbols-outlined text-[16px]">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  );
}