/**
 * Calculation state hook.
 * ЦЕНОВОЙ СУВЕРЕНИТЕТ ВОССТАНОВЛЕН: Расчеты переведены на единое ядро pricingLogic.
 * Реализована защита истории: закрытые сделки не пересчитываются по новым ценам.
 *
 * Разделение площадей (Закон Директора):
 *   totalAreaMaterial — сумма productionArea всех изделий (реальная геометрия → ЗП цеха).
 *   totalRetailArea   — сумма retailArea всех изделий (Max W × Max H → чек клиента).
 *
 * Разделение итогов (ADDONS-B / ADDONS-C / FINAL-D2):
 *   windowsRetailTotal  — розница изделий без допов.
 *   windowsExpensesTotal — расходы изделий без допов.
 *   extrasRetailTotal   — розница всех допов (молнии, юбки, утяжелители и т.д.).
 *   extrasCostTotal     — себестоимость всех допов.
 *   mountingRetailTotal — розница монтажа (manualPrice ?? retailFinal).
 *   mountingCostTotal   — себестоимость монтажа (costTotal).
 *   fastenersCostTotal  — себестоимость крепежа (display-only, уже входит в windowsExpensesTotal).
 *   totalPrice          = windowsRetailTotal + extrasRetailTotal + mountingRetailTotal.
 *   totalExpenses       = windowsExpensesTotal + extrasCostTotal + mountingCostTotal.
 *
 * Монтаж использует currentPrices (не activePrices), потому что calculateMounting
 * имеет собственную защиту цен через mountingSnapshot внутри MountingConfig.
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
  calculateExtrasAsServiceItems,
} from '@/lib/logic/extrasCalculations';
import { calculateWindowFinance } from '@/lib/logic/pricingLogic';
import { calculateMounting } from '@/lib/logic/mountingCalculations';
import { resolveActivePrices } from '@/lib/logic/priceResolution';
import { type MountingConfig } from '@/types/mounting';

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

  /** Розница изделий без допов (только материал + крепёж). */
  windowsRetailTotal: number;
  /** Расходы изделий без допов (материал + перерасход + ЗП + крепёж). */
  windowsExpensesTotal: number;
  /** Розница всех допов по всем окнам (молнии, юбки, утяжелители и т.д.). */
  extrasRetailTotal: number;
  /** Себестоимость всех допов по всем окнам. */
  extrasCostTotal: number;
  /** Розница монтажа: manualPrice ?? retailFinal. 0 если монтаж не подключён. */
  mountingRetailTotal: number;
  /** Себестоимость монтажа: costTotal. 0 если монтаж не подключён. */
  mountingCostTotal: number;

  /** Итого розница = windowsRetailTotal + extrasRetailTotal + mountingRetailTotal. */
  totalPrice: number;
  /** Себестоимость материала окон (без допов, без производства). */
  costPrice: number;
  /** Итого расходы = windowsExpensesTotal + extrasCostTotal + mountingCostTotal. */
  totalExpenses: number;

  totalMaterialInProduct: number;
  totalMaterialCut: number;
  totalOverspending: number;
  totalProductionCost: number;
  /**
   * Себестоимость крепежа по всем окнам (display-only).
   * Уже включена в windowsExpensesTotal → totalExpenses.
   * Экспортируется отдельно для отображения в строке "Стоимость изделия".
   */
  fastenersCostTotal: number;

  /**
   * true = frozen order (historical/locked) без savedPrices snapshot.
   * При true расчёты ненадёжны (activePrices = {}).
   * UI должен показать предупреждение и заблокировать ERP-действия.
   */
  isSnapshotIncomplete: boolean;

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
  // Единственная точка разрешения активного прайса — resolveActivePrices().
  // Монтаж НЕ использует activePrices — у него собственная защита через mountingSnapshot.

  const resolvedPrices = useMemo(() => {
    return resolveActivePrices({
      status: clientData.status,
      isPriceLocked: Boolean((clientData as Record<string, unknown>)['isPriceLocked']),
      savedPrices: (clientData as Record<string, unknown>)['savedPrices'] as Record<string, number> | null | undefined,
      currentPrices,
    });
  }, [
    clientData.status,
    (clientData as Record<string, unknown>)['isPriceLocked'],
    (clientData as Record<string, unknown>)['savedPrices'],
    currentPrices,
  ]);
  // Отдельные ссылки на поля результата — stable между рендерами
  const activePrices = resolvedPrices.prices;
  const isSnapshotIncomplete = resolvedPrices.isSnapshotIncomplete;

  // ── Площади ───────────────────────────────────────────────────────────────

  /**
   * Производственная площадь: сумма реальной геометрии всех изделий.
   * Используется для учёта ЗП цеха и передаётся в calculateMounting.
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

  // ── Финансовое ядро: изделия ──────────────────────────────────────────────
  // Все useMemo ниже считают только материал/производство/крепёж — без допов и монтажа.

  const windowsRetailTotal = useMemo(() => {
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

  const windowsExpensesTotal = useMemo(() => {
    return windows.reduce((sum, w) => {
      const finance = calculateWindowFinance(w, activePrices);
      return sum + finance.totalExpenses;
    }, 0);
  }, [windows, activePrices]);

  /**
   * Себестоимость крепежа (display-only).
   * fastenersCost уже входит в finance.totalExpenses → windowsExpensesTotal → totalExpenses.
   * Экспортируется отдельно только для отображения в строке "Стоимость изделия":
   *   productDisplayCost = costPrice + fastenersCostTotal + extrasCostTotal.
   * Не влияет на totalExpenses, totalPrice или сохранение.
   */
  const fastenersCostTotal = useMemo(() => {
    return windows.reduce((sum, w) => {
      const finance = calculateWindowFinance(w, activePrices);
      return sum + finance.fastenersCost;
    }, 0);
  }, [windows, activePrices]);

  // ── Финансовое ядро: допы ─────────────────────────────────────────────────
  // Использует activePrices — savedPrices-защита распространяется на допы автоматически.
  // Ключи addo_* — отдельный namespace, не пересекается с fast_* (крепёж).

  const extrasLedger = useMemo(() => {
    let extrasRetailTotal = 0;
    let extrasCostTotal   = 0;

    windows.forEach((w, idx) => {
      const items = calculateExtrasAsServiceItems(w, activePrices, idx);
      items.forEach((item) => {
        extrasRetailTotal += item.totalRetail;
        extrasCostTotal   += item.totalCost;
      });
    });

    return { extrasRetailTotal, extrasCostTotal };
  }, [windows, activePrices]);

  const { extrasRetailTotal, extrasCostTotal } = extrasLedger;

  // ── Финансовое ядро: монтаж ───────────────────────────────────────────────
  // Использует currentPrices (не activePrices):
  //   calculateMounting имеет собственную защиту цен через config.mountingSnapshot,
  //   который фиксируется при бронировании даты и приоритетнее переданного прайса.
  // При enabled=false → emptyCalculationResult() → оба = 0 (нет влияния на итоги).

  const mountingLedger = useMemo(() => {
    const mountingConfig = (clientData as Record<string, unknown>)['mountingConfig'] as MountingConfig | null | undefined;

    if (!mountingConfig?.enabled) {
      return { mountingRetailTotal: 0, mountingCostTotal: 0 };
    }

    const result = calculateMounting(mountingConfig, totalAreaMaterial, currentPrices);

    const mountingRetailTotal = mountingConfig.manualPrice ?? result.retailFinal ?? 0;
    const mountingCostTotal   = result.costTotal ?? 0;

    return { mountingRetailTotal, mountingCostTotal };
  }, [clientData, totalAreaMaterial, currentPrices]);

  const { mountingRetailTotal, mountingCostTotal } = mountingLedger;

  // ── Итоговые суммы: изделия + допы + монтаж ──────────────────────────────

  /** Итого розница: изделия + допы + монтаж. Передаётся в ClientStep как calculatedTotal. */
  const totalPrice = windowsRetailTotal + extrasRetailTotal + mountingRetailTotal;

  /** Итого расходы: изделия + допы + монтаж. Передаётся в ClientStep как calculatedTotalExpenses. */
  const totalExpenses = windowsExpensesTotal + extrasCostTotal + mountingCostTotal;

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
    windowsRetailTotal,
    windowsExpensesTotal,
    extrasRetailTotal,
    extrasCostTotal,
    mountingRetailTotal,
    mountingCostTotal,
    totalPrice,
    costPrice,
    totalExpenses,
    totalMaterialInProduct,
    totalMaterialCut,
    totalOverspending,
    totalProductionCost,
    fastenersCostTotal,
    isSnapshotIncomplete,
    handleWindowsChange,
    handleClientDataChange,
    handleExtrasChange,
  };
}