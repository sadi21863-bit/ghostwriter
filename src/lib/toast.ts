export type ToastType = 'error' | 'warning' | 'success' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

type ToastListener = (toast: Toast) => void;
const listeners: ToastListener[] = [];

export const toastEmitter = {
  emit(toast: Omit<Toast, 'id'>) {
    const t: Toast = { ...toast, id: Math.random().toString(36).slice(2) };
    listeners.forEach(l => l(t));
    return t.id;
  },
  subscribe(listener: ToastListener) {
    listeners.push(listener);
    return () => {
      const idx = listeners.indexOf(listener);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  },
};

export const toast = {
  error:   (message: string, action?: Toast['action']) =>
    toastEmitter.emit({ message, type: 'error', duration: 8000, action }),
  warning: (message: string, action?: Toast['action']) =>
    toastEmitter.emit({ message, type: 'warning', duration: 6000, action }),
  success: (message: string) =>
    toastEmitter.emit({ message, type: 'success', duration: 4000 }),
  info:    (message: string, action?: Toast['action']) =>
    toastEmitter.emit({ message, type: 'info', duration: 5000, action }),
};
