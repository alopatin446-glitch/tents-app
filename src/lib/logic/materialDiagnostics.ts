/**
 * ДИАГНОСТИКА МАТЕРИАЛОВ — временный модуль
 *
 * После применения CORE-3A/3B/3C при настроенных ценах все материалы
 * должны показывать delta=0 и status=same. Это сигнал к удалению файла.
 *
 * Не изменяет totalPrice, costPrice, balance, savedPrices, items.
 * Не пишет в БД. Только читает и сравнивает.
 *
 * @module src/lib/logic/materialDiagnostics.ts
 */

import { type WindowItem } from '@/types';
import {
  calculateWindowFinance,
  type PriceMap,
} from '@/lib/logic/pricingLogic';
import { calculateWindowGeometry } from '@/lib/logic/windowCalculations';

// ─────────────────────────────────────────────────────────────────────────────
// Типы
// ─────────────────────────────────────────────────────────────────────────────

export type DiagnosticPriceStatus =
  | 'same'
  | 'ok'
  | 'price_missing'
  | 'price_not_configured'
  | 'slug_not_defined';

export interface WindowMaterialDiagnosticItem {
  windowId:   number;
  windowName: string;
  materialCode: string;

  currentRetailSlug:  string;
  expectedRetailSlug: string;
  currentProductRetail:  number;
  expectedProductRetail: number | null;
  retailDelta:   number | null;
  retailStatus:  DiagnosticPriceStatus;

  currentBuySlug:  string;
  expectedBuySlug: string;
  currentMaterialCost:  number;
  expectedMaterialCost: number | null;
  costDelta:  number | null;
  costStatus: DiagnosticPriceStatus;

  currentTotalExpenses:  number;
  expectedTotalExpenses: number | null;
  currentProfit:  number;
  expectedProfit: number | null;

  reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Константы — зеркало pricingLogic.ts
// ─────────────────────────────────────────────────────────────────────────────

const PRICE_ERROR_SENTINEL = 9999;

const MAP_PVC: Readonly<Record<string, string>> = {
  none:         'prod_11',
  eyelet_10:    'prod_1',
  strap:        'prod_2',
  staple_pa:    'prod_3',
  staple_metal: 'prod_4',
  french_lock:  'prod_5',
};

const MAP_TPU: Readonly<Record<string, string>> = {
  none:         'prod_12',
  eyelet_10:    'prod_6',
  strap:        'prod_7',
  staple_pa:    'prod_8',
  staple_metal: 'prod_9',
  french_lock:  'prod_10',
};

const MAP_TINTED: Readonly<Record<string, string>> = {
  none:         'prod_18',
  eyelet_10:    'prod_13',
  strap:        'prod_14',
  staple_pa:    'prod_15',
  staple_metal: 'prod_16',
  french_lock:  'prod_17',
};

// ── CORE-3C ──────────────────────────────────────────────────────────────────
const MAP_MOSQUITO: Readonly<Record<string, string>> = {
  none:         'prod_19',
  eyelet_10:    'prod_20',
  strap:        'prod_21',
  staple_pa:    'prod_22',
  staple_metal: 'prod_23',
  french_lock:  'prod_24',
};

// ─────────────────────────────────────────────────────────────────────────────
// Приватные хелперы
// ─────────────────────────────────────────────────────────────────────────────

function computeTopFactor(item: WindowItem): number {
  const fastenerType  = item.fasteners?.type ?? 'none';
  const leftEnabled   = item.fasteners?.sides?.left === true;
  const rightEnabled  = item.fasteners?.sides?.right === true;
  const topState      = item.fasteners?.sides?.top ?? false;
  const topEnabled    = topState === true;
  const baseType      = leftEnabled && rightEnabled ? fastenerType : 'none';
  return topEnabled && baseType !== 'none' ? 4 / 3 : 1;
}

function computeBaseType(item: WindowItem): string {
  const fastenerType = item.fasteners?.type ?? 'none';
  const leftEnabled  = item.fasteners?.sides?.left === true;
  const rightEnabled = item.fasteners?.sides?.right === true;
  return leftEnabled && rightEnabled ? fastenerType : 'none';
}

/**
 * ТЕКУЩИЙ retail slug — зеркало АКТУАЛЬНОГО состояния pricingLogic.ts.
 * После CORE-3A + 3B + 3C все четыре материала имеют собственные карты.
 */
function getCurrentRetailSlug(item: WindowItem): string {
  const baseType = computeBaseType(item);

  if (item.material === 'TPU') {
    return MAP_TPU[baseType] || 'prod_12';
  }
  if (item.material === 'TINTED') {
    return MAP_TINTED[baseType] || 'prod_18';
  }
  if (item.material === 'MOSQUITO') {
    return MAP_MOSQUITO[baseType] || 'prod_19';
  }
  // PVC_700
  return MAP_PVC[baseType] || 'prod_11';
}

/**
 * ТЕКУЩИЙ buy slug — зеркало resolveBuyPrice в pricingLogic.ts.
 * После всех CORE-3 этапов каждый материал имеет свой slug.
 */
function getCurrentBuySlug(material: string): string {
  switch (material) {
    case 'TPU':      return 'c_pr_3';
    case 'TINTED':   return 'c_pr_2';
    case 'MOSQUITO': return 'c_pr_5';
    default:         return 'c_pr_1';
  }
}

/**
 * ОЖИДАЕМЫЙ retail slug.
 * После CORE-3A + 3B + 3C expected === current для всех материалов.
 */
function getExpectedRetailSlug(item: WindowItem): string | null {
  // Все четыре материала теперь имеют собственные slug
  return getCurrentRetailSlug(item);
}

/**
 * ОЖИДАЕМЫЙ buy slug.
 * После CORE-3A + 3B + 3C expected === current для всех материалов.
 */
function getExpectedBuySlug(material: string): string | null {
  return getCurrentBuySlug(material);
}

/**
 * Проверяет статус ожидаемой цены в priceMap.
 *
 * Порядок: сначала проверяем наличие и валидность цены, только потом same/ok.
 * same возвращается ТОЛЬКО при валидной цене.
 */
function resolvePriceStatus(
  expectedSlug: string | null,
  currentSlug:  string,
  priceMap:     PriceMap,
): { status: DiagnosticPriceStatus; priceM2: number | null } {
  if (expectedSlug === null) {
    return { status: 'slug_not_defined', priceM2: null };
  }

  const value = priceMap[expectedSlug];

  if (value === undefined) {
    return { status: 'price_missing', priceM2: null };
  }

  if (value === 0 || value === PRICE_ERROR_SENTINEL) {
    return { status: 'price_not_configured', priceM2: null };
  }

  if (expectedSlug === currentSlug) {
    return { status: 'same', priceM2: value };
  }

  return { status: 'ok', priceM2: value };
}

function buildReason(item: WindowMaterialDiagnosticItem): string {
  switch (item.materialCode) {
    case 'PVC_700':
      return 'ПВХ прозрачная: retail и закупочный slug без изменений.';

    case 'TINTED': {
      const r = item.retailStatus === 'same'
        ? `Retail: ${item.currentRetailSlug} (mapTINTED, настроен)`
        : `Retail: ${item.currentRetailSlug} (${item.retailStatus})`;
      const c = item.costStatus === 'same'
        ? `Закупка: c_pr_2 настроена`
        : `Закупка: ${item.expectedBuySlug} (${item.costStatus})`;
      return `Тонировка: ${r}. ${c}.`;
    }

    case 'TPU': {
      const r = item.retailStatus === 'same'
        ? `Retail: ${item.currentRetailSlug} (mapTPU, настроен)`
        : `Retail: ${item.currentRetailSlug} (${item.retailStatus})`;
      const c = item.costStatus === 'same'
        ? `Закупка: c_pr_3 настроена`
        : `Закупка: ${item.expectedBuySlug} (${item.costStatus})`;
      return `ТПУ: ${r}. ${c}.`;
    }

    case 'MOSQUITO': {
      const r = item.retailStatus === 'same'
        ? `Retail: ${item.currentRetailSlug} (mapMOSQUITO, настроен)`
        : `Retail: ${item.currentRetailSlug} (${item.retailStatus})`;
      const c = item.costStatus === 'same'
        ? `Закупка: c_pr_5 настроена`
        : `Закупка: ${item.expectedBuySlug} (${item.costStatus})`;
      return `Москитка: ${r}. ${c}.`;
    }

    default:
      return `Неизвестный материал: ${item.materialCode}.`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Публичный экспорт
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Строит диагностический отчёт по всем изделиям заказа.
 *
 * После CORE-3A + 3B + 3C при настроенных ценах:
 *   PVC_700  → same/same, delta=0
 *   TPU      → same/same, delta=0
 *   TINTED   → same/same, delta=0
 *   MOSQUITO → same/same, delta=0
 *
 * Не изменяет стейт. Не пишет в БД.
 */
export function buildMaterialDiagnostics(
  windows:  WindowItem[],
  priceMap: PriceMap,
): WindowMaterialDiagnosticItem[] {
  return windows.map((w): WindowMaterialDiagnosticItem => {
    const finance = calculateWindowFinance(w, priceMap);
    const geo     = calculateWindowGeometry(w);

    const currentRetailSlug  = getCurrentRetailSlug(w);
    const currentBuySlug     = getCurrentBuySlug(w.material);
    const topFactor          = computeTopFactor(w);

    const currentProductRetail = finance.retailPrice - finance.fastenersRetail;
    const currentMaterialCost  = finance.materialInProductCost;
    const currentTotalExpenses = finance.totalExpenses;
    const currentProfit        = finance.retailPrice - finance.totalExpenses;

    // ── Retail ───────────────────────────────────────────────────────────────
    const expectedRetailSlugValue = getExpectedRetailSlug(w);
    const retailCheck = resolvePriceStatus(expectedRetailSlugValue, currentRetailSlug, priceMap);

    let expectedProductRetail: number | null = null;
    if (retailCheck.status === 'same') {
      expectedProductRetail = Math.round(currentProductRetail);
    } else if (retailCheck.status === 'ok' && retailCheck.priceM2 !== null) {
      expectedProductRetail = Math.round(geo.retailArea * retailCheck.priceM2 * topFactor);
    }

    const retailDelta =
      expectedProductRetail !== null
        ? expectedProductRetail - Math.round(currentProductRetail)
        : null;

    // ── Buy / cost ────────────────────────────────────────────────────────────
    const expectedBuySlugValue = getExpectedBuySlug(w.material);
    const costCheck = resolvePriceStatus(expectedBuySlugValue, currentBuySlug, priceMap);

    let expectedMaterialCost: number | null = null;
    if (costCheck.status === 'same') {
      expectedMaterialCost = Math.round(currentMaterialCost);
    } else if (costCheck.status === 'ok' && costCheck.priceM2 !== null) {
      expectedMaterialCost = Math.round(
        (geo.cutWidth * geo.cutHeight / 10_000) * costCheck.priceM2,
      );
    }

    const costDelta =
      expectedMaterialCost !== null
        ? expectedMaterialCost - Math.round(currentMaterialCost)
        : null;

    // ── Агрегаты ─────────────────────────────────────────────────────────────
    const expectedTotalExpenses =
      costDelta !== null ? Math.round(currentTotalExpenses) + costDelta : null;

    const expectedProfit =
      retailDelta !== null && costDelta !== null
        ? Math.round(currentProfit) + retailDelta - costDelta
        : null;

    const record: WindowMaterialDiagnosticItem = {
      windowId:   w.id,
      windowName: w.name,
      materialCode: w.material,

      currentRetailSlug,
      expectedRetailSlug: expectedRetailSlugValue ?? '—',
      currentProductRetail:  Math.round(currentProductRetail),
      expectedProductRetail,
      retailDelta,
      retailStatus: retailCheck.status,

      currentBuySlug,
      expectedBuySlug: expectedBuySlugValue ?? '—',
      currentMaterialCost:  Math.round(currentMaterialCost),
      expectedMaterialCost,
      costDelta,
      costStatus: costCheck.status,

      currentTotalExpenses:  Math.round(currentTotalExpenses),
      expectedTotalExpenses,
      currentProfit:  Math.round(currentProfit),
      expectedProfit,

      reason: '',
    };

    record.reason = buildReason(record);
    return record;
  });
}