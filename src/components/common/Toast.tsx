/**
 * Toast Component System
 * Phase 4 - Edge Cases & Error Handling
 *
 * A simple toast notification system for showing messages to users.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Toast types for different visual styles
 */
export type ToastType = 'info' | 'error' | 'success' | 'warn';

/**
 * Toast action button configuration (ITR-007, ITR-009)
 */
export interface ToastAction {
  label: string;
  callback: () => void;
}

/**
 * Toast configuration
 */
export interface ToastConfig {
  message: string;
  type: ToastType;
  duration?: number;
  action?: ToastAction;
}

/**
 * Internal toast state with ID
 */
interface ToastItem extends ToastConfig {
  id: number;
  isExiting: boolean;
  action?: ToastAction;
}

/**
 * Toast context value
 */
interface ToastContextValue {
  showToast: (config: ToastConfig) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Hook to access toast functionality
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

let toastId = 0;

/**
 * Toast Provider Component
 *
 * Wraps the app and provides toast notification functionality.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((config: ToastConfig) => {
    const id = ++toastId;
    const toast: ToastItem = {
      ...config,
      id,
      duration: config.duration ?? 5000,
      isExiting: false,
    };

    setToasts((prev) => [...prev, toast]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) =>
      prev.map((toast) => (toast.id === id ? { ...toast, isExiting: true } : toast))
    );

    // Remove after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 300);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container" data-testid="toast-container">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Individual Toast Component
 */
function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(onDismiss, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, onDismiss]);

  const typeClass = `toast-${toast.type}`;

  return (
    <div
      className={`toast ${typeClass} ${toast.isExiting ? 'toast-exiting' : ''}`}
      role="alert"
      data-testid={`toast-${toast.id}`}
    >
      <span className="toast-message">{toast.message}</span>
      {toast.action && (
        <button
          className="toast-action"
          onClick={() => {
            toast.action!.callback();
            onDismiss();
          }}
          aria-label={toast.action.label}
        >
          {toast.action.label}
        </button>
      )}
      <button
        className="toast-close"
        onClick={onDismiss}
        aria-label="Close"
        data-testid={`toast-close-${toast.id}`}
      >
        <X size={16} />
      </button>
    </div>
  );
}

export { Toast };
