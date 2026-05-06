/**
 * ДИАГНОСТИКА МАТЕРИАЛОВ — временный модуль
 *
 * Показывает расхождение между текущим расчётом материалов и ожидаемым.
 * После применения всех CORE-3 этапов диагностика должна показывать delta=0
 * для всех настроенных материалов.
 *
 * Принцип:
 *   — Не изменяет totalPrice, costPrice, balance, savedPrices, items.
 *   — Не пишет в БД.
 *   — Не вызывает onSave.
 *   — Только читает и сравнивает.
 *
 * Удаляется после завершения всех CORE-3 этапов и подтверждения delta=0.
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

/**
 * Статус ожидаемой цены:
 *   same                — expected === current, изменений нет
 *   ok                  — slug найден, цена валидна, есть дельта
 *   price_missing       — slug не существует в priceMap
 *   price_not_configured — slug есть, но значение = 0 или 9999
 *   slug_not_defined    — для этого материала expected slug не определён
 *                         (MOSQUITO retail и cost)
 */
export type DiagnosticPriceStatus =
  | 'same'
  | 'ok'
  | 'price_missing'
  | 'price_not_configured'
  | 'slug_not_defined';

/**
 * Диагностическая запись по одному изделию.
 * Все поля только для чтения — в сохранение не попадают.
 */
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

/**
 * mapPVC — те же slug, что в getRetailProductSlug / mapPVC.
 * Используется для PVC_700 и MOSQUITO (pending CORE-3C).
 */
const MAP_PVC: Readonly<Record<string, string>> = {
  none:         'prod_11',
  eyelet_10:    'prod_1',
  strap:        'prod_2',
  staple_pa:    'prod_3',
  staple_metal: 'prod_4',
  french_lock:  'prod_5',
};

/** mapTPU — те же slug, что в getRetailProductSlug / mapTPU. CORE-3A. */
const MAP_TPU: Readonly<Record<string, string>> = {
  none:         'prod_12',
  eyelet_10:    'prod_6',
  strap:        'prod_7',
  staple_pa:    'prod_8',
  staple_metal: 'prod_9',
  french_lock:  'prod_10',
};

/** mapTINTED — те же slug, что в getRetailProductSlug / mapTINTED. CORE-3B. */
const MAP_TINTED: Readonly<Record<string, string>> = {
  none:         'prod_18',
  eyelet_10:    'prod_13',
  strap:        'prod_14',
  staple_pa:    'prod_15',
  staple_metal: 'prod_16',
  french_lock:  'prod_17',
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
 *
 * После CORE-3A и CORE-3B:
 *   PVC_700  → mapPVC  (неизменно)
 *   TPU      → mapTPU  (исправлено CORE-3A)
 *   TINTED   → mapTINTED (исправлено CORE-3B)
 *   MOSQUITO → mapPVC  (pending CORE-3C)
 */
function getCurrentRetailSlug(item: WindowItem): string {
  const baseType = computeBaseType(item);

  if (item.material === 'TPU') {
    const slug = MAP_TPU[baseType];
    return slug || 'prod_12';
  }

  if (item.material === 'TINTED') {
    const slug = MAP_TINTED[baseType];
    return slug || 'prod_18';
  }

  // PVC_700 и MOSQUITO → mapPVC
  const slug = MAP_PVC[baseType];
  return slug || 'prod_11';
}

/**
 * ТЕКУЩИЙ buy slug — зеркало resolveBuyPrice в pricingLogic.ts.
 *
 * После CORE-3A и CORE-3B:
 *   PVC_700  → c_pr_1
 *   TPU      → c_pr_3 (CORE-3A; если не настроен — fallback c_pr_1)
 *   TINTED   → c_pr_2 (CORE-3B; если не настроен — возвращает 0, slug остаётся c_pr_2)
 *   MOSQUITO → c_pr_1 (pending CORE-3C)
 *
 * Возвращает slug, который pricingLogic ПЫТАЕТСЯ использовать.
 * Фактическое значение buyPrice определяется calculateWindowFinance.
 */
function getCurrentBuySlug(material: string): string {
  switch (material) {
    case 'TPU':    return 'c_pr_3';
    case 'TINTED': return 'c_pr_2';
    default:       return 'c_pr_1';
  }
}

/**
 * ОЖИДАЕМЫЙ retail slug.
 *
 * После CORE-3A + CORE-3B ожидаемое = текущее для PVC_700, TPU, TINTED.
 * MOSQUITO → null (slug не определён → slug_not_defined).
 */
function getExpectedRetailSlug(item: WindowItem): string | null {
  if (item.material === 'MOSQUITO') return null;

  // TINTED — теперь mapTINTED (CORE-3B внедрён)
  if (item.material === 'TINTED') {
    const baseType = computeBaseType(item);
    const slug = MAP_TINTED[baseType];
    return slug || 'prod_18';
  }

  // TPU — mapTPU (CORE-3A внедрён)
  if (item.material === 'TPU') {
    const baseType = computeBaseType(item);
    const slug = MAP_TPU[baseType];
    return slug || 'prod_12';
  }

  // PVC_700 → mapPVC (без изменений)
  const baseType = computeBaseType(item);
  const slug = MAP_PVC[baseType];
  return slug || 'prod_11';
}

/**
 * ОЖИДАЕМЫЙ buy slug.
 *
 *   PVC_700  → c_pr_1 (без изменений)
 *   TINTED   → c_pr_2 (CORE-3B)
 *   TPU      → c_pr_3 (CORE-3A)
 *   MOSQUITO → null (slug не определён → slug_not_defined)
 */
function getExpectedBuySlug(material: string): string | null {
  switch (material) {
    case 'PVC_700':  return 'c_pr_1';
    case 'TINTED':   return 'c_pr_2';
    case 'TPU':      return 'c_pr_3';
    case 'MOSQUITO': return null;
    default:         return null;
  }
}

/**
 * Проверяет статус ожидаемой цены в priceMap.
 *
 * Порядок проверок намеренно поставлен «цена раньше сравнения slug'ов»:
 *   1. expectedSlug === null          → slug_not_defined
 *   2. slug отсутствует в priceMap    → price_missing
 *   3. value === 0 или value === 9999 → price_not_configured
 *   4. Цена валидна:
 *      expectedSlug === currentSlug   → same  (slug совпадает, цена ок)
 *      expectedSlug !== currentSlug   → ok    (slug изменился, цена ок)
 *
 * Важно: same возвращается ТОЛЬКО при валидной цене.
 * Если priceMap[slug] отсутствует или равен 0/9999 — это price_missing/
 * price_not_configured даже тогда, когда expected === current.
 * Иначе TINTED мог бы показывать same при нулевой цене prod_13..prod_18.
 */
function resolvePriceStatus(
  expectedSlug: string | null,
  currentSlug:  string,
  priceMap:     PriceMap,
): { status: DiagnosticPriceStatus; priceM2: number | null } {
  // 1. Slug не определён для этого материала
  if (expectedSlug === null) {
    return { status: 'slug_not_defined', priceM2: null };
  }

  // 2–3. Проверяем наличие и валидность цены ДО сравнения slug'ов
  const value = priceMap[expectedSlug];

  if (value === undefined) {
    return { status: 'price_missing', priceM2: null };
  }

  if (value === 0 || value === PRICE_ERROR_SENTINEL) {
    return { status: 'price_not_configured', priceM2: null };
  }

  // 4. Цена валидна — теперь определяем same vs ok
  if (expectedSlug === currentSlug) {
    return { status: 'same', priceM2: value };
  }

  return { status: 'ok', priceM2: value };
}

/**
 * Формирует человекочитаемую причину расхождения.
 */
function buildReason(item: WindowMaterialDiagnosticItem): string {
  switch (item.materialCode) {
    case 'PVC_700':
      return 'ПВХ прозрачная: retail и закупочный slug без изменений.';

    case 'TINTED': {
      const retailNote = item.retailStatus === 'same'
        ? `Retail: ${item.currentRetailSlug} настроен (mapTINTED)`
        : `Retail: ${item.currentRetailSlug} → ${item.expectedRetailSlug} (${item.retailStatus})`;
      const costNote = item.costStatus === 'same'
        ? `Закупка: c_pr_2 настроена`
        : `Закупка: ${item.currentBuySlug} → ${item.expectedBuySlug} (${item.costStatus})`;
      return `Тонировка: ${retailNote}. ${costNote}.`;
    }

    case 'TPU': {
      const retailNote = item.retailStatus === 'same'
        ? `Retail: ${item.currentRetailSlug} настроен (mapTPU)`
        : `Retail: ${item.currentRetailSlug} → ${item.expectedRetailSlug} (${item.retailStatus})`;
      const costNote = item.costStatus === 'same'
        ? `Закупка: c_pr_3 настроена`
        : `Закупка: ${item.currentBuySlug} → ${item.expectedBuySlug} (${item.costStatus})`;
      return `ТПУ: ${retailNote}. ${costNote}.`;
    }

    case 'MOSQUITO':
      return 'Москитная сетка: retail и закупочный slug не определены. Требуется бизнес-решение (CORE-3C).';

    default:
      return `Неизвестный материал: ${item.materialCode}.`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Публичный экспорт
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Строит диагностический отчёт по всем изделиям заказа.
 * После применения CORE-3A + CORE-3B:
 *   PVC_700, TPU, TINTED (при настроенных ценах) → delta = 0, status = same.
 *   MOSQUITO → slug_not_defined (pending CORE-3C).
 */
export function buildMaterialDiagnostics(
  windows:  WindowItem[],
  priceMap: PriceMap,
): WindowMaterialDiagnosticItem[] {
  return windows.map((w): WindowMaterialDiagnosticItem => {
    // ── Текущие значения из pricingLogic ─────────────────────────────────────
    const finance = calculateWindowFinance(w, priceMap);
    const geo     = calculateWindowGeometry(w);

    const currentRetailSlug   = getCurrentRetailSlug(w);
    const currentBuySlug      = getCurrentBuySlug(w.material);
    const topFactor           = computeTopFactor(w);

    const currentProductRetail  = finance.retailPrice - finance.fastenersRetail;
    const currentMaterialCost   = finance.materialInProductCost;
    const currentTotalExpenses  = finance.totalExpenses;
    const currentProfit         = finance.retailPrice - finance.totalExpenses;

    // ── Ожидаемый retail ─────────────────────────────────────────────────────
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

    // ── Ожидаемый buy ────────────────────────────────────────────────────────
    const expectedBuySlugValue = getExpectedBuySlug(w.material);
    const costCheck = resolvePriceStatus(expectedBuySlugValue, currentBuySlug, priceMap);

    let expectedMaterialCost: number | null = null;
    if (costCheck.status === 'same') {
      expectedMaterialCost = Math.round(currentMaterialCost);
    } else if (costCheck.status === 'ok' && costCheck.priceM2 !== null) {
      // Зеркало pricingLogic.ts строка 156
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