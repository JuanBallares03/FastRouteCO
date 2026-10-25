import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  confirmLabel?: string;
  onConfirm?: () => void;
  confirmVariant?: 'primary' | 'destructive';
  cancelLabel?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ 
  open, 
  onClose, 
  title, 
  description, 
  children, 
  confirmLabel = 'Confirmar',
  onConfirm,
  confirmVariant = 'primary',
  cancelLabel = 'Cancelar',
  size = 'md'
}: ModalProps) {
  if (!open) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  };

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className={cn('bg-surface-container-lowest rounded-xl p-6 shadow-xl w-full', sizes[size])}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-outline/50">
          <div>
            <h4 className="font-headline-sm text-headline-sm text-on-surface">{title}</h4>
            {description && (
              <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">{description}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div>{children}</div>
        {(onConfirm || confirmLabel) && (
          <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-outline/50">
            <Button variant="secondary" onClick={onClose}>{cancelLabel}</Button>
            <Button variant={confirmVariant} onClick={() => { onConfirm?.(); onClose(); }}>
              {confirmLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export interface ToastProps {
  show: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  variant?: 'success' | 'error' | 'info';
}

export function Toast({ show, onClose, title, description, variant = 'success' }: ToastProps) {
  if (!show) return null;

  const variants = {
    success: 'bg-tertiary-container text-on-tertiary',
    error: 'bg-error-container text-on-error-container',
    info: 'bg-secondary-container text-on-secondary-container',
  };

  const icons = {
    success: 'done_all',
    error: 'error',
    info: 'info',
  };

  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-50 transform transition-all duration-300 pointer-events-none px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 max-w-md',
      show ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0',
      variants[variant]
    )}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
        <span className="material-symbols-outlined text-[20px]">{icons[variant]}</span>
      </div>
      <div className="flex flex-col">
        <span className="font-label-lg text-label-lg font-semibold">{title}</span>
        {description && <span className="font-body-sm text-body-sm opacity-80">{description}</span>}
      </div>
      <button onClick={onClose} className="ml-2 p-1 rounded-full hover:bg-white/20 transition-colors">
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}