'use client';

import { useMemo, useCallback } from 'react';
import DrawingCanvas from './DrawingCanvas';
import FastenersParams from './FastenersParams';
import styles from './FastenersStep.module.css';

// СТАЛО (Архитектурно верно)
import { calculateWindowGeometry } from '@/lib/logic/windowCalculations';
import { type WindowItem, type FastenerConfig, getInitialFastener } from '@/types';

interface FastenersStepProps {
  windows: WindowItem[];
  activeWindowId: number;
  onActiveWindowChange: (id: number) => void;
  onWindowsChange: (windows: WindowItem[]) => void;
  onSave: (windows: WindowItem[]) => void;
  isReadOnly?: boolean;
}

export default function FastenersStep({
  windows,
  activeWindowId,
  onActiveWindowChange,
  onWindowsChange,
  onSave,
  isReadOnly = false,
}: FastenersStepProps) {

  const activeWindow = useMemo(() =>
    windows.find((w) => w.id === activeWindowId),
    [windows, activeWindowId]);

  const activeFasteners = activeWindow?.fasteners || getInitialFastener();

  const handleParamsChange = useCallback((newConfig: FastenerConfig) => {
    if (!activeWindow) return;

    // 1. Вызов Единого мозга
    const geometry = calculateWindowGeometry(activeWindow);

    // 2. Ценовой суверенитет: расчет стоимости на основе периметра
    const retailCost = geometry.perimeter * (newConfig.priceRetail || 0);
    const costCost = geometry.perimeter * (newConfig.priceCost || 0);

    const updatedFastenerConfig: FastenerConfig = {
      ...newConfig,
      retailCost: Number(retailCost.toFixed(2)),
      costCost: Number(costCost.toFixed(2)),
    };

    // 3. Обновление стейта без потери фокуса (Keyboard Jump Prevention)
    const updatedWindows = windows.map((w) =>
      w.id === activeWindowId ? {
        ...w,
        fasteners: updatedFastenerConfig,
        // Фиксация в Гроссбухе изделия
        totalFastenersRetail: updatedFastenerConfig.retailCost,
        totalFastenersCost: updatedFastenerConfig.costCost
      } : w
    );

    onWindowsChange(updatedWindows);
  }, [activeWindow, activeWindowId, windows, onWindowsChange]);

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
          onClick={() => onSave(windows)}
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
            <span className={styles.infoItem}>
              Стороны: <strong>{activeSidesCount} / 4</strong>
            </span>
            <span className={styles.infoItem}>
              Тип: <strong>
                {activeFasteners.type === 'none'
                  ? 'Без крепежа'
                  : activeFasteners.type.toUpperCase()}
              </strong>
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