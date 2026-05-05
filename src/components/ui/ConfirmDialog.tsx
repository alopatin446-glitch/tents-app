'use client';

import type { CSSProperties, ReactNode } from 'react';

interface ConfirmDialogProps {
  /** Показывать ли диалог */
  open: boolean;
  /** Заголовок или основной вопрос */
  title: string;
  /** Дополнительный текст / детали (опционально) */
  description?: ReactNode;
  /** Текст кнопки подтверждения. По умолчанию «Подтвердить» */
  confirmLabel?: string;
  /** Текст кнопки отмены. По умолчанию «Отмена» */
  cancelLabel?: string;
  /** Вариант кнопки подтверждения: danger = красный, default = зелёный */
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

// ─── Стили через CSS-переменные проекта (globals.css) ─────────────────────

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.75)',
  backdropFilter: 'blur(6px)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  animation: 'cdFadeIn 0.2s ease',
};

const cardStyle: CSSProperties = {
  background: 'rgba(24, 34, 52, 0.97)',
  border: '1px solid rgba(123, 255, 0, 0.2)',
  borderRadius: '14px',
  padding: '2rem 2.25rem',
  width: '100%',
  maxWidth: '420px',
  margin: '0 1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem',
  boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 60px rgba(123,255,0,0.06)',
  animation: 'cdSlideUp 0.22s ease',
};

const titleStyle: CSSProperties = {
  color: '#ffffff',
  fontSize: '0.95rem',
  fontWeight: 700,
  margin: 0,
  lineHeight: 1.4,
};

const descStyle: CSSProperties = {
  color: 'rgba(255,255,255,0.55)',
  fontSize: '0.8rem',
  lineHeight: 1.6,
  margin: 0,
  whiteSpace: 'pre-wrap',
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  justifyContent: 'flex-end',
};

const baseBtnStyle: CSSProperties = {
  borderRadius: '50px',
  padding: '9px 22px',
  fontSize: '0.78rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  cursor: 'pointer',
  fontFamily: "'Montserrat', sans-serif",
  transition: 'transform 0.2s, box-shadow 0.2s, background 0.2s',
  border: 'none',
};

const cancelBtnStyle: CSSProperties = {
  ...baseBtnStyle,
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.15)',
  color: '#ffffff',
};

const confirmBtnStyles: Record<'danger' | 'default', CSSProperties> = {
  danger: {
    ...baseBtnStyle,
    background: 'rgba(255,77,77,0.15)',
    border: '1px solid rgba(255,77,77,0.4)',
    color: 'var(--neon-red, #FF4D4D)',
  },
  default: {
    ...baseBtnStyle,
    background: 'rgba(123,255,0,0.12)',
    border: '1px solid rgba(123,255,0,0.4)',
    color: 'var(--neon-green, #7BFF00)',
  },
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <>
      {/* keyframes объявляем инлайн — не добавляем новых CSS-файлов */}
      <style>{`
        @keyframes cdFadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cdSlideUp { from { transform: translateY(16px); opacity: 0 }
                               to   { transform: translateY(0);    opacity: 1 } }
      `}</style>

      <div style={overlayStyle} onClick={onCancel}>
        <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
          <p style={titleStyle}>{title}</p>

          {description && <p style={descStyle}>{description}</p>}

          <div style={actionsStyle}>
            <button type="button" style={cancelBtnStyle} onClick={onCancel}>
              {cancelLabel}
            </button>
            <button
              type="button"
              style={confirmBtnStyles[variant]}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}