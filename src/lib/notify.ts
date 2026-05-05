export type ToastType = 'success' | 'error';

export interface ToastEvent {
  type: ToastType;
  message: string;
}

/**
 * Вызов из любого клиентского кода.
 * Диспатчит CustomEvent — ToastContainer на layout-уровне его подхватывает.
 * Сигнатура намеренно совпадает со старым window.alert:
 * менять 15 точек вызова не нужно.
 */
export function notifySuccess(message: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<ToastEvent>('app:toast', {
      detail: { type: 'success', message },
    })
  );
}

export function notifyError(message: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<ToastEvent>('app:toast', {
      detail: { type: 'error', message },
    })
  );
}