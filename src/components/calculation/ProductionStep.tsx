'use client';

/**
 * Шаг производства — просмотр раскроя мастером.
 *
 * Chapter 4: добавлены price props для корректного отображения
 *   себестоимости, допов и крепежей в CuttingDiagnostics.
 *   Используется resolveActivePrices — frozen orders читают savedPrices,
 *   живые — currentPrices. Монтаж не затрагивается.
 */

import { useMemo } from 'react';
import { type WindowItem } from '@/types';
import { type PriceMap } from '@/lib/logic/pricingLogic';
import { resolveActivePrices } from '@/lib/logic/priceResolution';
import CuttingCanvas from './CuttingCanvas';
import CuttingDiagnostics, { type OrderTotals } from '@/components/calculation/shared/CuttingDiagnostics';
import styles from './ItemsStep.module.css';
import { calculateWindowGeometry } from '@/lib/logic/windowCalculations';

interface ProductionStepProps {
  windows: WindowItem[];
  activeWindowId: number;
  onActiveWindowChange: (id: number) => void;
  currentPrices?: PriceMap;
  clientStatus?: string | null;
  isPriceLocked?: boolean;
  savedPrices?: Record<string, number> | null;
  /** Агрегаты из useCalculationState — для сверки с per-window расчётом */
  orderTotals?: OrderTotals;
}

export default function ProductionStep({
  windows,
  activeWindowId,
  onActiveWindowChange,
  currentPrices = {},
  clientStatus,
  isPriceLocked = false,
  savedPrices,
  orderTotals,
}: ProductionStepProps) {
  const activeWindow: WindowItem | undefined = windows.find(
    (w) => w.id === activeWindowId,
  );

  /**
   * Резолвим активный прайс — инвариант Chapter 1:
   * frozen/locked → savedPrices, live → currentPrices.
   * Монтаж не участвует (собственный mountingSnapshot).
   */
  const activePrices = useMemo<PriceMap>(() => {
    return resolveActivePrices({
      status:        clientStatus,
      isPriceLocked: isPriceLocked,
      savedPrices:   savedPrices,
      currentPrices,
    }).prices;
  }, [clientStatus, isPriceLocked, savedPrices, currentPrices]);

  return (
    <div className={styles.itemsGrid}>
      <aside className={styles.inputPanelWrapper}>
        <CuttingDiagnostics windows={windows} priceMap={activePrices} orderTotals={orderTotals} />
      </aside>

      <div className={styles.rightColumn}>
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

        <div className={styles.drawingWrapper}>
          {activeWindow ? (
            <CuttingCanvas
              windowItem={activeWindow}
              rollWidth={calculateWindowGeometry(activeWindow).rollWidth * 10}
            />
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.2)' }}>Выберите окно</div>
          )}
        </div>

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