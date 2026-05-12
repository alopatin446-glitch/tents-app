'use client';

import { useMemo, useCallback } from 'react';
import DrawingCanvas from './DrawingCanvas';
import FastenersParams from './FastenersParams';
import styles from './FastenersStep.module.css';

import { calculateFastenerPoints } from '@/lib/logic/fastenerCalculations';
import { getFastenerUnitPrices } from '@/lib/logic/pricingLogic';
import { type WindowItem, type FastenerConfig, getInitialFastener } from '@/types';

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

    const fastenerPoints = calculateFastenerPoints({ ...activeWindow, fasteners: newConfig });
    const pointsCount = fastenerPoints.mainFastenerPointsCount;

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

  // ── Сводка для infoBar ───────────────────────────────────────────────────
  // Для активных заказов: runtime-пересчёт через helper.
  //   — mainFastenerPointsCount:     основной тип крепежа (идёт в pricingLogic)
  //   — defaultTopEyeletPointsCount: Ø10 верх, отдельный тип (не умножается на цену основного)
  //   — uniqueTotalPhysicalPoints:   физических точек без дублей (для склада в будущем)
  //
  // Для readonly / frozen заказов: null.
  //   infoBar показывает сохранённый activeFasteners.pointsCount, чтобы
  //   не расходиться с историческими суммами в "Прибыль и расход".
  const fastenerSummary = useMemo(
    () => (!isReadOnly && activeWindow)
      ? calculateFastenerPoints(activeWindow)
      : null,
    [activeWindow, isReadOnly],
  );

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

            {/* ── Сводка по точкам ───────────────────────────────────────────
                Активный заказ + top='default': три строки (main / Ø10 / физических).
                  — Склад в будущем будет списывать main и Ø10 раздельно.
                Активный заказ без Ø10 верха: одна строка (Точек: N шт.).
                Frozen / readonly заказ: одна строка из сохранённого pointsCount
                  — не пересчитываем, чтобы не расходиться с историческими суммами.
            ─────────────────────────────────────────────────────────────── */}
            {fastenerSummary && fastenerSummary.defaultTopEyeletPointsCount > 0 ? (
              <>
                <span className={styles.infoItem}>
                  Основной: <strong>{fastenerSummary.mainFastenerPointsCount} шт.</strong>
                </span>
                <span className={styles.infoItem}>
                  Ø10 верх: <strong>{fastenerSummary.defaultTopEyeletPointsCount} шт.</strong>
                </span>
                <span className={styles.infoItem}>
                  Физических: <strong>{fastenerSummary.uniqueTotalPhysicalPoints} шт.</strong>
                </span>
              </>
            ) : (
              <span className={styles.infoItem}>
                Точек: <strong>
                  {(fastenerSummary
                    ? fastenerSummary.mainFastenerPointsCount
                    : activeFasteners.pointsCount) || 0} шт.
                </strong>
              </span>
            )}

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