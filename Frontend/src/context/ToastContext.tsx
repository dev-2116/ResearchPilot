import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X, RotateCcw } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: ToastAction;
}

export interface ToastOptions {
  title?: string;
  message: string;
  type?: ToastType;
  duration?: number;
  action?: ToastAction;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => string;
  dismissToast: (id: string) => void;
  toasts: ToastItem[];
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((options: ToastOptions): string => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const duration = options.duration ?? 4500;
    const newToast: ToastItem = {
      id,
      title: options.title,
      message: options.message,
      type: options.type || 'info',
      duration,
      action: options.action,
    };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }

    return id;
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, toasts }}>
      {children}
      {/* Toast Notification Container - HCI Rule 3 (Informative Feedback) & Rule 6 (Action Reversal) */}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => {
          let Icon = Info;
          let colorClass = 'toast-info';
          if (toast.type === 'success') {
            Icon = CheckCircle2;
            colorClass = 'toast-success';
          } else if (toast.type === 'warning') {
            Icon = AlertTriangle;
            colorClass = 'toast-warning';
          } else if (toast.type === 'error') {
            Icon = AlertCircle;
            colorClass = 'toast-error';
          }

          return (
            <div key={toast.id} className={`toast-item ${colorClass}`}>
              <div className="toast-icon">
                <Icon size={18} />
              </div>
              <div className="toast-body">
                {toast.title && <div className="toast-title">{toast.title}</div>}
                <div className="toast-message">{toast.message}</div>
              </div>
              {toast.action && (
                <button
                  type="button"
                  className="toast-action-btn"
                  onClick={() => {
                    toast.action?.onClick();
                    dismissToast(toast.id);
                  }}
                  title={toast.action.label}
                >
                  <RotateCcw size={13} style={{ marginRight: 4 }} />
                  {toast.action.label}
                </button>
              )}
              <button
                type="button"
                className="toast-close-btn"
                onClick={() => dismissToast(toast.id)}
                aria-label="Close notification"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};
