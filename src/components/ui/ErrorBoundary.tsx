'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Название модуля — появится в сообщении об ошибке. */
  label?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

// ─── Инлайн-стили через CSS-переменные проекта ────────────────────────────
// Не добавляем новый CSS-модуль: используем то, что уже объявлено в globals.css

const wrapStyle: React.CSSProperties = {
  minHeight: '60vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2rem',
};

const boxStyle: React.CSSProperties = {
  maxWidth: '520px',
  width: '100%',
  border: '1px solid rgba(255, 77, 77, 0.35)',
  borderRadius: '16px',
  background: 'rgba(255, 77, 77, 0.07)',
  padding: '2rem 2.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

const titleStyle: React.CSSProperties = {
  color: 'var(--neon-red, #FF4D4D)',
  fontSize: '1rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  margin: 0,
};

const textStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.6)',
  fontSize: '0.82rem',
  lineHeight: 1.6,
  margin: 0,
};

const detailStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.3)',
  fontSize: '0.72rem',
  fontFamily: 'monospace',
  background: 'rgba(0,0,0,0.3)',
  borderRadius: '8px',
  padding: '0.6rem 0.9rem',
  overflowX: 'auto',
  margin: 0,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const btnStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  borderRadius: '999px',
  padding: '10px 20px',
  fontSize: '0.78rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.04)',
  color: '#ffffff',
  transition: 'border-color 0.2s, color 0.2s',
};

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : String(error ?? 'Неизвестная ошибка');
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }): void {
    // Ошибка уже видна в консоли через React DevTools.
    // console.error намеренно не вызываем — чтобы не засорять прод-консоль.
    // При наличии внешней системы мониторинга (Sentry и т.п.) — вставить сюда.
    void error;
    void info;
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, message: '' });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const label = this.props.label ?? 'модуля';

    return (
      <div style={wrapStyle}>
        <div style={boxStyle}>
          <p style={titleStyle}>Ошибка {label}</p>
          <p style={textStyle}>
            Что-то пошло не так. Попробуйте сбросить состояние — данные в базе
            не затронуты.
          </p>
          {this.state.message ? (
            <pre style={detailStyle}>{this.state.message}</pre>
          ) : null}
          <button
            type="button"
            style={btnStyle}
            onClick={this.handleReset}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                'rgba(0,243,255,0.4)';
              (e.currentTarget as HTMLButtonElement).style.color = '#7df9ff';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                'rgba(255,255,255,0.15)';
              (e.currentTarget as HTMLButtonElement).style.color = '#ffffff';
            }}
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }
}