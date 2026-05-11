/**
 * ЕДИНЫЙ ИСТОЧНИК ПРАВДЫ — Разрешение активного прайс-листа
 *
 * АРХИТЕКТУРНЫЙ ИНВАРИАНТ:
 *   Для frozen orders (historical / price-locked) currentPrices НИКОГДА
 *   не используется — даже если snapshot отсутствует или неполный.
 *   При missing snapshot → пустой прайс {} + isSnapshotIncomplete = true.
 *
 * ЗАПРЕЩЕНО:
 *   — savedPrices + currentPrices hybrid
 *   — partial fallback / silent merge / auto patching
 *   — source='live' для frozen orders
 *
 * @module src/lib/logic/priceResolution.ts
 */

export type PriceSnapshot = Record<string, number>;

const HISTORICAL_STATUSES = new Set(['completed', 'rejected']);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function isHistoricalOrder(status: string | null | undefined): boolean {
  return HISTORICAL_STATUSES.has(status ?? '');
}

export function isPriceFixed(
  status: string | null | undefined,
  isPriceLocked: boolean,
): boolean {
  return isHistoricalOrder(status) || isPriceLocked;
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveActivePrices
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolvePricesParams {
  status: string | null | undefined;
  isPriceLocked: boolean;
  savedPrices: PriceSnapshot | null | undefined;
  currentPrices: PriceSnapshot;
}

export type PriceSource = 'snapshot' | 'live';

export interface ResolvedPrices {
  /**
   * frozen + snapshot present  → savedPrices
   * frozen + snapshot missing  → {} (пустой объект, расчёты дадут 0)
   * live                       → currentPrices
   *
   * ИНВАРИАНТ: для frozen orders это НИКОГДА не currentPrices.
   */
  prices: PriceSnapshot;

  /** 'snapshot' для frozen (даже при incomplete). 'live' только для живых заказов. */
  source: PriceSource;

  /**
   * true = frozen order без снапшота.
   * UI ОБЯЗАН показать предупреждение и заблокировать ERP/production-действия.
   */
  isSnapshotIncomplete: boolean;
}

/**
 * ЕДИНСТВЕННАЯ точка разрешения активного прайс-листа.
 *
 *   completed / rejected → savedPrices (или {} + isSnapshotIncomplete)
 *   isPriceLocked=true  → savedPrices (или {} + isSnapshotIncomplete)
 *   всё остальное       → currentPrices
 */
export function resolveActivePrices(params: ResolvePricesParams): ResolvedPrices {
  const { status, isPriceLocked, savedPrices, currentPrices } = params;

  if (isPriceFixed(status, isPriceLocked)) {
    if (savedPrices && Object.keys(savedPrices).length > 0) {
      return { prices: savedPrices, source: 'snapshot', isSnapshotIncomplete: false };
    }
    // ЗАПРЕЩЕНО fallback на currentPrices.
    // Пустой прайс → расчёты дадут 0. Честно, не вводит в заблуждение.
    return { prices: {}, source: 'snapshot', isSnapshotIncomplete: true };
  }

  return { prices: currentPrices, source: 'live', isSnapshotIncomplete: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// validateHistoricalSnapshot
// ─────────────────────────────────────────────────────────────────────────────

export interface SnapshotValidationResult {
  isComplete: boolean;
  missingSlugs: string[];
}

export function validateHistoricalSnapshot(
  snapshot: PriceSnapshot | null | undefined,
  required: string[],
): SnapshotValidationResult {
  if (!snapshot || Object.keys(snapshot).length === 0) {
    return { isComplete: false, missingSlugs: required };
  }
  const missingSlugs = required.filter((slug) => snapshot[slug] === undefined);
  return { isComplete: missingSlugs.length === 0, missingSlugs };
}

// ─────────────────────────────────────────────────────────────────────────────
// buildAuditDelta
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditDeltaField {
  field: string;
  dbValue: number | null;
  runtimeValue: number;
  delta: number | null;
  isSignificant: boolean;
}

export interface AuditDeltaResult {
  hasSignificantDelta: boolean;
  fields: AuditDeltaField[];
}

/**
 * Сравнивает DB-значения с runtime-пересчётом.
 * ТОЛЬКО для диагностики. НЕ пишет в DB. НЕ меняет runtime.
 */
export function buildAuditDelta(
  db: {
    totalExpenses?: number | null;
    costPrice?: number | null;
    productionCost?: number | null;
    overspending?: number | null;
  },
  runtime: {
    totalExpenses: number;
    costPrice: number;
    productionCost: number;
    overspending: number;
  },
): AuditDeltaResult {
  const pairs: Array<[string, number | null | undefined, number]> = [
    ['totalExpenses',  db.totalExpenses,  runtime.totalExpenses],
    ['costPrice',      db.costPrice,      runtime.costPrice],
    ['productionCost', db.productionCost, runtime.productionCost],
    ['overspending',   db.overspending,   runtime.overspending],
  ];

  const fields: AuditDeltaField[] = pairs.map(([field, dbVal, rtVal]) => {
    const dbValue      = dbVal ?? null;
    const runtimeValue = Math.round(rtVal);
    const delta        = dbValue !== null ? runtimeValue - Math.round(dbValue) : null;
    return {
      field,
      dbValue:       dbValue !== null ? Math.round(dbValue) : null,
      runtimeValue,
      delta,
      isSignificant: delta !== null && Math.abs(delta) > 1,
    };
  });

  return {
    hasSignificantDelta: fields.some((f) => f.isSignificant),
    fields,
  };
}