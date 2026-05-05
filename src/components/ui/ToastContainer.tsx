'use client';

import { useEffect, useState } from 'react';
import type { ToastEvent, ToastType } from '@/lib/notify';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

const TOAST_DURATION_MS = 4000;

// ─── Стили совпадают с calendar.module.css: те же цвета, та же анимация ──────

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: '2rem',
  right: '2rem',
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  maxWidth: '360px',
  pointerEvents: 'none',
};

const baseToastStyle: React.CSSProperties = {
  padding: '0.75rem 1.1rem',
  borderRadius: '10px',
  fontSize: '0.8rem',
  fontWeight: 600,
  backdropFilter: 'blur(10px)',
  border: '1px solid transparent',
  lineHeight: 1.4,
  animation: 'toastSlideIn 0.3s ease',
};

const typeStyles: Record<ToastType, React.CSSProperties> = {
  success: {
    background: 'rgba(123, 255, 0, 0.1)',
    borderColor: 'rgba(123, 255, 0, 0.3)',
    color: '#7BFF00',
  },
  error: {
    background: 'rgba(255, 77, 77, 0.15)',
    borderColor: 'rgba(255, 77, 77, 0.4)',
    color: '#FF6B6B',
  },
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    function handleToast(e: Event) {
      const { type, message } = (e as CustomEvent<ToastEvent>).detail;
      const id = `${Date.now()}-${Math.random()}`;

      setToasts((prev) => [...prev, { id, type, message }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, TOAST_DURATION_MS);
    }

    window.addEventListener('app:toast', handleToast);
    return () => window.removeEventListener('app:toast', handleToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <>
      {/* keyframe объявляем инлайн — не добавляем новых CSS-файлов */}
      <style>{`
        @keyframes toastSlideIn {
          from { transform: translateX(100px); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
      `}</style>

      <div style={containerStyle}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{ ...baseToastStyle, ...typeStyles[t.type] }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </>
  );
}