'use client';

/**
 * Шаг производства — просмотр раскроя мастером.
 *
 * Левая панель:
 *   1. Параметры материала (выбор ширины рулона для CuttingCanvas)
 *   2. Блок «ПЛАН РАСКРОЯ ЗАКАЗА» (CuttingDiagnostics)
 *
 * Правая панель:
 *   Вкладки переключения окон сверху.
 *   Визуализация раскроя выбранного изделия (CuttingCanvas).
 */

import { useState } from 'react';
import { type WindowItem } from '@/types';
import CuttingCanvas from './CuttingCanvas';
import CuttingDiagnostics from '@/components/calculation/shared/CuttingDiagnostics';
import styles from './ItemsStep.module.css';
import { calculateWindowGeometry } from '@/lib/logic/windowCalculations';

interface ProductionStepProps {
  windows: WindowItem[];
  activeWindowId: number;
  onActiveWindowChange: (id: number) => void;
}

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
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        </div>

        {/* 2. Диагностический блок раскроя */}
        <CuttingDiagnostics windows={windows} />
      </aside>

      {/* ── ПРАВАЯ ПАНЕЛЬ ────────────────────────────────────────────────── */}
      <div className={styles.rightColumn}>
        {/* Вкладки сверху как на первом шаге */}
        <div className={styles.tabsRow}>
          {windows.map((win, index) => (
            <div
              key={win.id}
              className={`${styles.tabItem} ${activeWindowId === win.id ? styles.activeTab : ''}`}
              onClick={() => onActiveWindowChange(win.id)}
            >
              Окно {index + 1}
            </div>
          ))}
        </div>

        {/* Визуализация */}
        <div className={styles.drawingWrapper}>
          {activeWindow ? (
            <CuttingCanvas
              windowItem={activeWindow}
              // Вместо стейта rollWidth берем реальную ширину списания из ядра
              rollWidth={calculateWindowGeometry(activeWindow).rollWidth * 10}
            />
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.2)' }}>Выберите окно</div>
          )}
        </div>

        {/* Инфо-бар снизу */}
        <div className={styles.bottomInfoBar}>
          <div className={styles.statLabel}>
            Изделие: <span>{activeWindow?.name ?? '—'}</span>
          </div>
          <div className={styles.statLabel}>
            Режим: <span style={{ color: '#7BFF00' }}>ИТОГОВЫЙ КРОЙ</span>
          </div>
        </div>
      </div>
    </div>
  );
}