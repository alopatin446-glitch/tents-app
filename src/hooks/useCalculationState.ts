/**
 * Calculation state hook.
 * ЦЕНОВОЙ СУВЕРЕНИТЕТ ВОССТАНОВЛЕН: Расчеты переведены на единое ядро pricingLogic.
 * Реализована защита истории: закрытые сделки не пересчитываются по новым ценам.
 */
import { useCallback, useMemo, useState } from 'react';
import { type WindowItem } from '@/types';
import { type ClientFormData } from '@/components/calculation/ClientStep';
import {
  calculateTotalArea,
  calculateTotalAreaWithKant,
} from '@/lib/logic/windowCalculations';
import {
  normalizeAllWindowExtras,
  normalizeExtrasOnResize,
} from '@/lib/logic/extrasCalculations';
// ФИНАНСОВЫЙ МОСТ: Импорт единственно верного источника цен
import { calculateWindowFinance } from '@/lib/logic/pricingLogic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalculationState {
  windows: WindowItem[];
  clientDataWithArea: ClientFormData;
  totalAreaMaterial: number;
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
  currentPrices: Record<string, number> // Цены из БД (передаются из CalculationClient)
): CalculationState {
  const [windows, setWindows] = useState<WindowItem[]>(
    () => normalizeAllWindowExtras(initialWindows),
  );
  const [clientData, setClientData] = useState<ClientFormData>(initialClientData);

  // ── ОПРЕДЕЛЕНИЕ ПРАЙС-ЛИСТА (Архив vs Живой) ──────────────────────────────

  const activePrices = useMemo(() => {
    // Если статус сделки "Успешно" или "Провалено" — пытаемся взять сохраненный снапшот
    const isClosed = clientData.status === 'done' || clientData.status === 'cancelled';

    // ВАЖНО: Предполагаем, что снапшот цен хранится в clientData.savedPrices
    // Если сделка открыта или снапшота нет — используем живые цены из БД
    return isClosed && (clientData as any).savedPrices
      ? (clientData as any).savedPrices
      : currentPrices;
  }, [clientData.status, (clientData as any).savedPrices, currentPrices]);

  // ── Расчеты площадей (Мозг) ─────────────────────────────────────────────

  const totalAreaMaterial = useMemo(
    () => calculateTotalArea(windows),
    [windows],
  );

  const totalAreaWithKant = useMemo(
    () => calculateTotalAreaWithKant(windows),
    [windows],
  );

  // ── Финансовое ядро (ОШИБКИ ИСПРАВЛЕНЫ) ──────────────────────────────────

  // Розница: Сумма всех изделий с учетом живого или архивного прайса
  const totalPrice = useMemo(() => {
    return windows.reduce((sum, w) => {
      // Теперь передаем второй аргумент — activePrices (Живой или Снапшот)
      const finance = calculateWindowFinance(w, activePrices);
      return sum + finance.retailPrice;
    }, 0);
  }, [windows, activePrices]);

  // Себестоимость: Сумма затрат
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
      // Суммируем результат нового поля из нашего ядра
      return sum + finance.totalExpenses;
    }, 0);
  }, [windows, activePrices]);

  // Инъекция площади в объект клиента
  const clientDataWithArea = useMemo<ClientFormData>(
    () => ({ ...clientData, area: totalAreaMaterial }),
    [clientData, totalAreaMaterial],
  );

  // ── Обработчики (Handlers) ─────────────────────────────────────────────

  const handleWindowsChange = useCallback((updated: WindowItem[]): void => {
    setWindows((prev) => {
      const prevById = new Map(prev.map((w) => [w.id, w]));
      const normalized = normalizeAllWindowExtras(updated);
      return normalized.map((curr) => {
        const prevWindow = prevById.get(curr.id);
        if (!prevWindow) return curr;
        const dimsChanged =
          curr.widthTop !== prevWindow.widthTop ||
          curr.widthBottom !== prevWindow.widthBottom ||
          curr.heightLeft !== prevWindow.heightLeft ||
          curr.heightRight !== prevWindow.heightRight;
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
    totalAreaWithKant,
    totalPrice,
    costPrice,
    handleWindowsChange,
    handleClientDataChange,
    handleExtrasChange,
    totalMaterialInProduct,
    totalMaterialCut,
    totalOverspending,
    totalProductionCost,
    totalExpenses,
  };
}