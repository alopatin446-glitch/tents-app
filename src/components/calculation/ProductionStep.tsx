'use client';

/**
 * Шаг производства — просмотр раскроя мастером.
 *
 * Левая панель:
 *   1. Параметры материала (выбор ширины рулона для CuttingCanvas)
 *   2. Список изделий заказа
 *   3. Блок «ПЛАН РАСКРОЯ ЗАКАЗА» (CuttingDiagnostics) — та же математика,
 *      что была рассчитана на шаге ИЗДЕЛИЯ, теперь видна мастеру.
 *
 * Правая панель:
 *   Визуализация раскроя выбранного изделия (CuttingCanvas).
 *
 * @module src/components/calculation/ProductionStep.tsx
 */

import { useState } from 'react';
import { type WindowItem } from '@/types';
import CuttingCanvas from './CuttingCanvas';
import CuttingDiagnostics from '@/components/calculation/shared/CuttingDiagnostics';
// Сетка и общие контейнеры унаследованы от ItemsStep — один источник правды
import styles from './ItemsStep.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// Пропсы
// ─────────────────────────────────────────────────────────────────────────────

interface ProductionStepProps {
  windows: WindowItem[];
  activeWindowId: number;
  onActiveWindowChange: (id: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Компонент
// ─────────────────────────────────────────────────────────────────────────────

export default function ProductionStep({
  windows,
  activeWindowId,
  onActiveWindowChange,
}: ProductionStepProps) {
  const [rollWidth, setRollWidth] = useState<number>(1400);

  const activeWindow: WindowItem | undefined = windows.find(
    (w) => w.id === activeWindowId,
  );

  return (
    <div className={styles.itemsGrid}>

      {/* ── ЛЕВАЯ ПАНЕЛЬ ─────────────────────────────────────────────────── */}
      <aside className={styles.inputPanelWrapper}>

        {/* 1. Параметры материала */}
        <div className={styles.formSection}>
          <h4>Параметры материала</h4>
          <div className={styles.inputGroup} style={{ position: 'relative' }}>
            <select
              className={styles.selectInput}
              value={rollWidth}
              onChange={(e) => setRollWidth(Number(e.target.value))}
            >
              <option value={1400}>Рулон 1400 мм</option>
              <option value={2000}>Рулон 2000 мм</option>
              <option value={2500}>Рулон 2500 мм</option>
            </select>
            <div className={styles.selectArrow}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        </div>

        {/* 2. Список изделий */}
        <div className={styles.formSection}>
          <h4>Список изделий</h4>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              overflowY: 'auto',
              maxHeight: '30vh',
            }}
          >
            {windows.map((win) => (
              <div
                key={win.id}
                onClick={() => onActiveWindowChange(win.id)}
                className={styles.tabItem}
                style={{
                  background:
                    activeWindowId === win.id
                      ? '#7BFF00'
                      : 'rgba(255,255,255,0.05)',
                  color: activeWindowId === win.id ? '#111827' : 'white',
                  cursor: 'pointer',
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                  {win.name}
                </div>
                <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                  {win.widthBottom} × {win.heightLeft} мм
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Диагностический блок раскроя — ровно под списком изделий */}
        <CuttingDiagnostics windows={windows} />

      </aside>

      {/* ── ПРАВАЯ ПАНЕЛЬ ────────────────────────────────────────────────── */}
      <main style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Визуализация раскроя */}
        <div
          className={styles.drawingWrapper}
          style={{ flex: 1, display: 'flex' }}
        >
          {activeWindow ? (
            <CuttingCanvas windowItem={activeWindow} rollWidth={rollWidth} />
          ) : (
            <div
              style={{
                display: 'flex',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.2)',
              }}
            >
              Выберите окно
            </div>
          )}
        </div>

        {/* Инфо-бар снизу */}
        <div className={styles.bottomInfoBar}>
          <div className={styles.statLabel}>
            Изделие: <span>{activeWindow?.name ?? '—'}</span>
          </div>
          <div className={styles.statLabel}>
            Режим:{' '}
            <span style={{ color: '#7BFF00' }}>ИТОГОВЫЙ КРОЙ</span>
          </div>
        </div>

      </main>
    </div>
  );
}