'use client';

import { useMemo, useCallback } from 'react';
import DrawingCanvas from './DrawingCanvas';
import FastenersParams from './FastenersParams';
import styles from './FastenersStep.module.css';

// СТАЛО (Архитектурно верно)
import { calculateWindowGeometry } from '@/lib/logic/windowCalculations';
import { getFastenerUnitPrices } from '@/lib/logic/pricingLogic';
import { type WindowItem, type FastenerConfig, getInitialFastener } from '@/types';

/** Шаг расстановки точек крепления по периметру (см). */
const FASTENER_STEP_CM = 40;

interface FastenersStepProps {
  windows: WindowItem[];
  activeWindowId: number;
  onActiveWindowChange: (id: number) => void;
  onWindowsChange: (windows: WindowItem[]) => void;
  onSave: () => void | Promise<void>;
  priceMap: Record<string, number>;
  isReadOnly?: boolean;
}

export default function FastenersStep({
  windows,
  activeWindowId,
  onActiveWindowChange,
  onWindowsChange,
  onSave,
  priceMap,
  isReadOnly = false,
}: FastenersStepProps) {

  const activeWindow = useMemo(() =>
    windows.find((w) => w.id === activeWindowId),
    [windows, activeWindowId]);

  const activeFasteners = activeWindow?.fasteners ?? getInitialFastener();

  const handleParamsChange = useCallback((newConfig: FastenerConfig) => {
    if (!activeWindow) return;

    const geometry = calculateWindowGeometry(activeWindow);

    // Количество точек крепления: минимум 4 по углам, далее — шаг по периметру
    const pointsCount = Math.max(4, Math.ceil(geometry.perimeter / FASTENER_STEP_CM));

    // Цены берём из живого priceMap через тот же маппинг, что и calculateWindowFinance.
    // Fallback — на priceRetail/priceCost из конфига (snapshot закрытой сделки).
    const { unitRetail, unitCost } = getFastenerUnitPrices(
      newConfig.type,
      priceMap,
      { retail: newConfig.priceRetail, cost: newConfig.priceCost },
    );

    const retailCost = pointsCount * unitRetail;
    const costCost   = pointsCount * unitCost;

    const updatedFastenerConfig: FastenerConfig = {
      ...newConfig,
      priceRetail: unitRetail,
      priceCost:   unitCost,
      pointsCount,
      retailCost: Number(retailCost.toFixed(2)),
      costCost:   Number(costCost.toFixed(2)),
    };

    const updatedWindows = windows.map((w) =>
      w.id === activeWindowId
        ? {
            ...w,
            fasteners:           updatedFastenerConfig,
            totalFastenersRetail: updatedFastenerConfig.retailCost,
            totalFastenersCost:   updatedFastenerConfig.costCost,
          }
        : w,
    );

    onWindowsChange(updatedWindows);
  }, [activeWindow, activeWindowId, windows, onWindowsChange, priceMap]);

  const activeSidesCount = useMemo(() =>
    activeFasteners.type === 'none'
      ? 0
      : Object.values(activeFasteners.sides).filter(v => v === true).length,
    [activeFasteners]);

  return (
    <div className={styles.fastenersLayout}>
      <div className={styles.leftPanel}>
        <div className={styles.headerRow}>
          <h2 className={styles.sectionTitle}>Крепёж</h2>
          <span className={styles.windowName}>{activeWindow?.name || 'Окно не выбрано'}</span>
        </div>

        <FastenersParams
          fasteners={activeFasteners}
          onChange={handleParamsChange}
          isReadOnly={isReadOnly}
        />

        <button
          className={styles.saveButton}
          onClick={() => onSave()}
          disabled={isReadOnly || !activeWindow}
        >
          СОХРАНИТЬ КРЕПЁЖ
        </button>
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.tabsRow}>
          {windows.map((w, index) => (
            <div
              key={w.id}
              className={`${styles.tabItem} ${activeWindowId === w.id ? styles.activeTab : ''}`}
              onClick={() => onActiveWindowChange(w.id)}
            >
              Окно {index + 1}
            </div>
          ))}
        </div>

        {activeWindow ? (
          <div className={styles.drawingWrapper}>
            <DrawingCanvas item={activeWindow} showFasteners />
          </div>
        ) : (
          <div className={styles.emptyState}>Выберите окно для настройки крепежа</div>
        )}

        {activeWindow && (
          <div className={styles.infoBar}>
            <span className={styles.infoItem}>
              Выбрано: <strong>{activeWindow.name}</strong>
            </span>
            {/* НОВЫЙ БЛОК: Выводим количество точек крепления */}
            <span className={styles.infoItem}>
              Точек: <strong>{activeFasteners.pointsCount || 0} шт.</strong>
            </span>
            <span className={styles.infoItem}>
              Стороны: <strong>{activeSidesCount} / 4</strong>
            </span>
            <span className={styles.infoItem}>
              Цена: <strong>{activeFasteners.retailCost || 0} ₽</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}