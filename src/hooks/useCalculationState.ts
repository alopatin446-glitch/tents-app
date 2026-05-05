/**
 * Calculation state hook.
 * ЦЕНОВОЙ СУВЕРЕНИТЕТ ВОССТАНОВЛЕН: Расчеты переведены на единое ядро pricingLogic.
 * Реализована защита истории: закрытые сделки не пересчитываются по новым ценам.
 *
 * Разделение площадей (Закон Директора):
 *   totalAreaMaterial — сумма productionArea всех изделий (реальная геометрия → ЗП цеха).
 *   totalRetailArea   — сумма retailArea всех изделий (Max W × Max H → чек клиента).
 */
import { useCallback, useMemo, useState } from 'react';
import { type WindowItem } from '@/types';
import { type ClientFormData } from '@/components/calculation/ClientStep';
import {
  calculateTotalArea,
  calculateTotalRetailArea,
  calculateTotalAreaWithKant,
  calculateWindowGeometry,
} from '@/lib/logic/windowCalculations';
import {
  normalizeAllWindowExtras,
  normalizeExtrasOnResize,
} from '@/lib/logic/extrasCalculations';
import { calculateWindowFinance } from '@/lib/logic/pricingLogic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalculationState {
  windows: WindowItem[];
  clientDataWithArea: ClientFormData;

  /** Сумма productionArea всех изделий (м²). Для ЗП цеха и производственного учёта. */
  totalAreaMaterial: number;
  /** Сумма retailArea всех изделий (м²). Для чека клиента и расчёта розничной цены. */
  totalRetailArea: number;
  /** Сумма areaWithKant всех изделий (м²). */
  totalAreaWithKant: number;

  totalPrice: number;
  costPrice: number;
  totalExpenses: number;
  totalMaterialInProduct: number;
  totalMaterialCut: number;
  totalOverspending: number;
  totalProductionCost: number;

  handleWindowsChange: (updated: WindowItem[]) => void;
  handleClientDataChange: (updated: ClientFormData) => void;
  handleExtrasChange: (windowId: number, extras: WindowItem['additionalElements']) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCalculationState(
  initialClientData: ClientFormData,
  initialWindows: WindowItem[],
  currentPrices: Record<string, number>,
): CalculationState {
  const [windows, setWindows] = useState<WindowItem[]>(
    () => normalizeAllWindowExtras(initialWindows),
  );
  const [clientData, setClientData] = useState<ClientFormData>(initialClientData);

  // ── Прайс-лист (Архив vs Живой) ───────────────────────────────────────────

  const activePrices = useMemo(() => {
    const isClosed = clientData.status === 'done' || clientData.status === 'cancelled';
    return isClosed && (clientData as Record<string, unknown>)['savedPrices']
      ? (clientData as Record<string, unknown>)['savedPrices'] as Record<string, number>
      : currentPrices;
  }, [clientData.status, (clientData as Record<string, unknown>)['savedPrices'], currentPrices]);

  // ── Площади ───────────────────────────────────────────────────────────────

  /**
   * Производственная площадь: сумма реальной геометрии всех изделий.
   * Используется для учёта ЗП цеха.
   */
  const totalAreaMaterial = useMemo(
    () => calculateTotalArea(windows),
    [windows],
  );

  /**
   * Розничная площадь: сумма Max W × Max H всех изделий.
   * Используется для чека клиента и формирования итоговой цены.
   */
  const totalRetailArea = useMemo(
    () => calculateTotalRetailArea(windows),
    [windows],
  );

  const totalAreaWithKant = useMemo(
    () => calculateTotalAreaWithKant(windows),
    [windows],
  );

  // ── Финансовое ядро ───────────────────────────────────────────────────────

  const totalPrice = useMemo(() => {
    return windows.reduce((sum, w) => {
      const finance = calculateWindowFinance(w, activePrices);
      return sum + finance.retailPrice;
    }, 0);
  }, [windows, activePrices]);

  const costPrice = useMemo(() => {
    return windows.reduce((sum, w) => {
      const finance = calculateWindowFinance(w, activePrices);
      return sum + finance.costPrice;
    }, 0);
  }, [windows, activePrices]);

  const totalMaterialInProduct = useMemo(() => {
    return windows.reduce((sum, w) => {
      const finance = calculateWindowFinance(w, activePrices);
      return sum + finance.materialInProductCost;
    }, 0);
  }, [windows, activePrices]);

  const totalMaterialCut = useMemo(() => {
    return windows.reduce((sum, w) => {
      const finance = calculateWindowFinance(w, activePrices);
      return sum + finance.materialCutCost;
    }, 0);
  }, [windows, activePrices]);

  const totalOverspending = useMemo(() => {
    return windows.reduce((sum, w) => {
      const finance = calculateWindowFinance(w, activePrices);
      return sum + finance.overspending;
    }, 0);
  }, [windows, activePrices]);

  const totalProductionCost = useMemo(() => {
    return windows.reduce((sum, w) => {
      const finance = calculateWindowFinance(w, activePrices);
      return sum + finance.productionCost;
    }, 0);
  }, [windows, activePrices]);

  const totalExpenses = useMemo(() => {
    return windows.reduce((sum, w) => {
      const finance = calculateWindowFinance(w, activePrices);
      return sum + finance.totalExpenses;
    }, 0);
  }, [windows, activePrices]);

  // ── Инъекция площади в данные клиента ────────────────────────────────────
  // На чек идёт totalRetailArea — клиент видит прямоугольный габарит.
  const clientDataWithArea = useMemo<ClientFormData>(
    () => ({ ...clientData, area: totalRetailArea }),
    [clientData, totalRetailArea],
  );

  // ── Обработчики ───────────────────────────────────────────────────────────

  const handleWindowsChange = useCallback((updated: WindowItem[]): void => {
    setWindows((prev) => {
      const prevById   = new Map(prev.map((w) => [w.id, w]));
      const normalized = normalizeAllWindowExtras(updated);
      return normalized.map((curr) => {
        const prevWindow = prevById.get(curr.id);
        if (!prevWindow) return curr;
        const dimsChanged =
          curr.widthTop     !== prevWindow.widthTop    ||
          curr.widthBottom  !== prevWindow.widthBottom ||
          curr.heightLeft   !== prevWindow.heightLeft  ||
          curr.heightRight  !== prevWindow.heightRight;
        if (!dimsChanged) return curr;
        return { ...curr, additionalElements: normalizeExtrasOnResize(curr, prevWindow) };
      });
    });
  }, []);

  const handleExtrasChange = useCallback(
    (windowId: number, extras: WindowItem['additionalElements']): void => {
      setWindows((prev) =>
        prev.map((w) => (w.id === windowId ? { ...w, additionalElements: extras } : w)),
      );
    },
    [],
  );

  const handleClientDataChange = useCallback(
    (updated: ClientFormData): void => {
      setClientData((prev) => {
        const { area: _ignored, ...rest } = updated;
        const hasChanges = Object.keys(rest).some(
          (k) => prev[k as keyof ClientFormData] !== (rest as Record<string, unknown>)[k],
        );
        if (!hasChanges) return prev;
        return { ...prev, ...rest };
      });
    },
    [],
  );

  return {
    windows,
    clientDataWithArea,
    totalAreaMaterial,
    totalRetailArea,
    totalAreaWithKant,
    totalPrice,
    costPrice,
    totalExpenses,
    totalMaterialInProduct,
    totalMaterialCut,
    totalOverspending,
    totalProductionCost,
    handleWindowsChange,
    handleClientDataChange,
    handleExtrasChange,
  };
}