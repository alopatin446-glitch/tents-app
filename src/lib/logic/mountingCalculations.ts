/**
 * ЕДИНЫЙ ИСТОЧНИК ПРАВДЫ — Расчёты монтажного блока
 * @module src/lib/logic/mountingCalculations.ts
 *
 * Правила:
 *   РОЗНИЦА:
 *     = (площадь × розничный тариф бригады)
 *     + (площадь × ставка базового основания)
 *     + (Σ длина доп. оснований × ставка доп. основания)
 *     + (Σ длина балок × ставка балки)
 *     + (расстояние × 2 × розничный тариф км)
 *     + (высотные работы × количество дней)
 *     Минималка: max(розница, MIN_RETAIL_PRICE)
 *
 *   СЕБЕСТОИМОСТЬ:
 *     = (площадь × себестоимостный тариф бригады)
 *     + ((розница доп. оснований + розница балок) × EXTRA_WORKS_COST_FACTOR)
 *     + (расстояние × 2 × FUEL_COST_PER_KM)
 *
 *   effectiveRetail:
 *     = manualPrice, если она задана;
 *     = retailFinal, если ручная цена не задана.
 *
 *   9999 или нечисловое значение = ошибка прайса.
 */

import { MOUNTING_PRICES, TEAM_MEMBERS } from '@/constants/pricing';
import type {
  BeamType,
  CalendarEvent,
  ExtraFoundation,
  ExtraFoundationType,
  FoundationType,
  HeightWorkType,
  MountingBeam,
  MountingCalculationResult,
  MountingConfig,
  MountingPriceSnapshot,
  MountingStatus,
  TeamCategory,
} from '@/types/mounting';

import { parseWindowItems } from '@/types';
import { calculateTotalArea } from '@/lib/logic/windowCalculations';

// ─────────────────────────────────────────────────────────────────────────────
// Константы
// ─────────────────────────────────────────────────────────────────────────────

/** Сигнальное значение «цена не установлена» */
const PRICE_ERROR_SENTINEL = 9999;

const DEFAULT_TEAM_CATEGORY: TeamCategory = 'mid';
const DEFAULT_HEIGHT_WORK_TYPE: HeightWorkType = 'stairs';
export type MountingPriceMap = Record<string, number>;

// ─────────────────────────────────────────────────────────────────────────────
// Вспомогательные функции
// ─────────────────────────────────────────────────────────────────────────────

/** Проверяет, является ли значение ошибкой прайса */
function isPriceError(value: number): boolean {
  return value === PRICE_ERROR_SENTINEL || !Number.isFinite(value);
}

/** Округление до целых рублей */
function roundRub(value: number): number {
  return Math.round(Number.isFinite(value) ? value : 0);
}

/** Безопасное число: NaN/null/undefined/отрицательные значения приводятся к fallback */
function toSafeNumber(value: unknown, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num < 0 ? fallback : num;
}

/** Безопасная площадь: отрицательная/нечисловая площадь не участвует в расчёте */
function normalizeArea(value: unknown): number {
  return toSafeNumber(value, 0);
}

function normalizeDurationDays(value: unknown): number {
  const days = Math.floor(toSafeNumber(value, 1));
  return days > 0 ? days : 1;
}

function getTeamCategory(config: MountingConfig): TeamCategory {
  return config.team?.category ?? DEFAULT_TEAM_CATEGORY;
}

function getArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function getPrice(
  prices: MountingPriceMap,
  slug: string,
  fallback: number,
): number {
  const value = prices[slug];

  if (value === undefined || value === null) {
    return fallback;
  }

  return value;
}

function getTeamRetailSlug(category: TeamCategory): string {
  if (category === 'pro') return 'team_retail_pro';
  if (category === 'junior') return 'team_retail_junior';
  return 'team_retail_mid';
}

function getTeamCostSlug(category: TeamCategory): string {
  if (category === 'pro') return 'team_cost_pro';
  if (category === 'junior') return 'team_cost_junior';
  return 'team_cost_mid';
}

function emptyCalculationResult(): MountingCalculationResult {
  return {
    retailWindowsBase: 0,
    retailFoundations: 0,
    retailBeams: 0,
    retailDistance: 0,
    retailHeightWork: 0,
    retailSubtotal: 0,
    retailAfterMinimum: 0,
    retailFinal: 0,
    costBase: 0,
    costExtra: 0,
    costDistance: 0,
    costTotal: 0,
    profit: 0,
    profitPercent: null,
    isMinimumApplied: false,
    isManualOverride: false,
    isLoss: false,
    hasPriceError: false,
    priceErrorFields: [],
  };
}

interface PriceResult {
  cost: number;
  hasError: boolean;
  field: string;
}

function priceOk(cost: number): PriceResult {
  return { cost, hasError: false, field: '' };
}

function priceError(field: string): PriceResult {
  return { cost: 0, hasError: true, field };
}

// ─────────────────────────────────────────────────────────────────────────────
// Расчёт стоимости отдельных составляющих
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Розничная ставка базового основания за м².
 * Для сайдинга цена задаётся менеджером вручную.
 */
function getBaseFoundationSlug(type: FoundationType): string {
  if (type === 'concrete') return 'base_foundation_concrete';
  if (type === 'brick') return 'base_foundation_brick';
  if (type === 'metal') return 'base_foundation_metal';
  if (type === 'round_wood') return 'base_foundation_round_wood';
  return 'base_foundation_wood';
}

/**
 * Розничная ставка базового основания за м².
 * Для сайдинга цена задаётся менеджером вручную.
 */
function calcBaseFoundationRetail(
  baseFoundation: FoundationType,
  baseFoundationCustomPrice: number | undefined,
  prices: MountingPriceMap,
): PriceResult {
  if (baseFoundation === 'siding') {
    const customPrice = toSafeNumber(baseFoundationCustomPrice, NaN);

    if (isPriceError(customPrice)) {
      return priceError('Базовое основание «сайдинг» — цена за м² не задана менеджером');
    }

    return priceOk(customPrice);
  }

  const rate = getPrice(
    prices,
    getBaseFoundationSlug(baseFoundation),
    MOUNTING_PRICES.BASE_FOUNDATION_SURCHARGE[
    baseFoundation as keyof typeof MOUNTING_PRICES.BASE_FOUNDATION_SURCHARGE
    ] ?? PRICE_ERROR_SENTINEL,
  );

  if (isPriceError(rate)) {
    return priceError(`Базовое основание «${baseFoundation}» — цена не установлена`);
  }

  return priceOk(rate);
}

function getExtraFoundationSlug(type: ExtraFoundationType): string {
  if (type === 'concrete') return 'extra_foundation_concrete';
  if (type === 'brick') return 'extra_foundation_brick';
  if (type === 'metal') return 'extra_foundation_metal';
  if (type === 'round_wood') return 'extra_foundation_round_wood';
  return 'extra_foundation_wood';
}

/**
 * Розничная стоимость одного дополнительного основания.
 */
function calcExtraFoundationRetail(
  foundation: ExtraFoundation,
  snapshot: MountingPriceSnapshot | null,
  prices: MountingPriceMap,
): PriceResult {
  const type = foundation.type as ExtraFoundationType;
  const length = toSafeNumber(foundation.length, 0);

  if (type === 'siding') {
    const customPrice = toSafeNumber(foundation.customPrice, NaN);

    if (isPriceError(customPrice)) {
      return priceError('Доп. основание «сайдинг» — цена за м.п. не задана менеджером');
    }

    return priceOk(customPrice * length);
  }

  const rate = getPrice(
    prices,
    getExtraFoundationSlug(type),
    (snapshot?.extraFoundationPrices ??
      MOUNTING_PRICES.EXTRA_FOUNDATION_PRICE_PER_M)[type] ??
    PRICE_ERROR_SENTINEL,
  );

  if (isPriceError(rate)) {
    return priceError(`Доп. основание «${type}» — цена не установлена`);
  }

  return priceOk(rate * length);
}

function getBeamSlug(type: BeamType): string {
  if (type === 'planed_wood_50x50') return 'beam_planed_wood_50x50';
  if (type === 'timber_100x100') return 'beam_timber_100x100';
  if (type === 'timber_150x150') return 'beam_timber_150x150';
  return 'beam_wood_50x50';
}

function getHeightWorkSlug(type: HeightWorkType): string {
  if (type === 'scaffold') return 'height_scaffold';
  if (type === 'both') return 'height_both';
  return 'height_stairs';
}

/**
 * Розничная стоимость одной монтажной балки.
 * Для custom_wood/custom_metal ручная цена за м.п. обязательна.
 */
function calcBeamRetail(
  beam: MountingBeam,
  snapshot: MountingPriceSnapshot | null,
  prices: MountingPriceMap,
): PriceResult {
  const type = beam.type as BeamType;
  const length = toSafeNumber(beam.length, 0);

  if (type === 'custom_wood' || type === 'custom_metal') {
    const customPrice = toSafeNumber(beam.customPrice, NaN);

    if (isPriceError(customPrice)) {
      return priceError(`Балка «${type}» — цена за м.п. не задана менеджером`);
    }

    return priceOk(customPrice * length);
  }

  const rate = getPrice(
    prices,
    getBeamSlug(type),
    (snapshot?.beamPrices ?? MOUNTING_PRICES.MOUNTING_BEAMS)[type] ??
    PRICE_ERROR_SENTINEL,
  );

  if (isPriceError(rate)) {
    return priceError(`Балка «${type}» — цена не установлена`);
  }

  return priceOk(rate * length);
}

// ─────────────────────────────────────────────────────────────────────────────
// Главная функция расчёта монтажа (SSOT)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Рассчитывает розницу, себестоимость и прибыль монтажного блока.
 * Это единственное место, где считается монтаж. UI не должен дублировать формулы.
 */
export function calculateMounting(
  config: MountingConfig,
  totalAreaM2: number,
  prices: MountingPriceMap = {},
): MountingCalculationResult {
  if (!config?.enabled) {
    return emptyCalculationResult();
  }

  const snapshot = config.mountingSnapshot ?? null;
  const category = getTeamCategory(config);
  const areaM2 = normalizeArea(totalAreaM2);
  const distance = toSafeNumber(config.distance, 0);
  const durationDays = normalizeDurationDays(config.durationDays);

  const priceErrorFields: string[] = [];
  let hasPriceError = false;

  const guard = (value: number, field: string): number => {
    if (isPriceError(value)) {
      hasPriceError = true;
      priceErrorFields.push(field);
      return 0;
    }
    return value;
  };

  const collect = (result: PriceResult): number => {
    if (result.hasError) {
      hasPriceError = true;
      priceErrorFields.push(result.field);
    }
    return result.cost;
  };

  // ── Ставки: снимок прайса приоритетнее текущего прайса ──────────────────

  const retailRate = guard(
    snapshot?.teamRetailRate ??
    getPrice(
      prices,
      getTeamRetailSlug(category),
      MOUNTING_PRICES.TEAM_RETAIL_RATES[category],
    ),
    'Тариф бригады (розница)',
  );

  const costRate = guard(
    snapshot?.teamCostRate ??
    getPrice(
      prices,
      getTeamCostSlug(category),
      MOUNTING_PRICES.TEAM_COST_RATES[category],
    ),
    'Тариф бригады (себестоимость)',
  );

  const fuelCostPerKm = guard(
    snapshot?.fuelCostPerKm ?? getPrice(prices, 'fuel_cost_per_km', MOUNTING_PRICES.FUEL_COST_PER_KM),
    'Ставка ГСМ (себестоимость)',
  );
  const kmTariffRetail = guard(
    snapshot?.kmTariffRetail ?? getPrice(prices, 'km_retail', MOUNTING_PRICES.KM_TARIFF_RETAIL),
    'Тариф ГСМ (розница)',
  );
  const minRetailPrice = guard(
    snapshot?.minRetailPrice ?? getPrice(prices, 'min_retail_mounting', MOUNTING_PRICES.MIN_RETAIL_PRICE),
    'Минимальная стоимость монтажа',
  );

  const extraWorksCostFactor = guard(
    getPrice(prices, 'extra_works_cost_factor', MOUNTING_PRICES.EXTRA_WORKS_COST_FACTOR),
    'Коэффициент себеса доп. работ',
  );

  // ── РОЗНИЦА ──────────────────────────────────────────────────────────────
  const retailWindowsBase = areaM2 * retailRate;

  const baseFoundationCost =
    areaM2 *
    collect(
      calcBaseFoundationRetail(
        config.baseFoundation ?? 'wood',
        config.baseFoundationCustomPrice,
        prices,
      ),
    );

  const retailExtraFoundations = getArray(config.extraFoundations).reduce(
    (sum, foundation) =>
      sum + collect(calcExtraFoundationRetail(foundation, snapshot, prices)),
    0,
  );

  const retailFoundations = baseFoundationCost + retailExtraFoundations;

  const retailBeams = getArray(config.mountingBeams).reduce(
    (sum, beam) => sum + collect(calcBeamRetail(beam, snapshot, prices)),
    0,
  );

  const retailDistance = distance * 2 * kmTariffRetail;

  let retailHeightWork = 0;
  if (config.heightWork?.active) {
    const heightWorkType = config.heightWork.type ?? DEFAULT_HEIGHT_WORK_TYPE;
    const heightWorkRate = guard(
      getPrice(
        prices,
        getHeightWorkSlug(heightWorkType),
        (snapshot?.heightWorkPrices ?? MOUNTING_PRICES.HEIGHT_WORK)[heightWorkType] ??
        PRICE_ERROR_SENTINEL,
      ),
      `Высотные работы «${heightWorkType}»`,
    );
    retailHeightWork = heightWorkRate * durationDays;
  }

  const retailSubtotal =
    retailWindowsBase +
    retailFoundations +
    retailBeams +
    retailDistance +
    retailHeightWork;

  const isMinimumApplied = retailSubtotal < minRetailPrice;
  const retailAfterMinimum = isMinimumApplied ? minRetailPrice : retailSubtotal;
  const retailFinal = roundRub(retailAfterMinimum);

  // ── СЕБЕСТОИМОСТЬ ───────────────────────────────────────────────────────
  const costBase = areaM2 * costRate;
  const costExtra = (retailFoundations + retailBeams) * extraWorksCostFactor;
  const costDistance = distance * 2 * fuelCostPerKm;
  const costTotal = roundRub(costBase + costExtra + costDistance);

  // ── ИТОГИ ────────────────────────────────────────────────────────────────
  const isManualOverride = config.manualPrice !== null && config.manualPrice !== undefined;
  const manualPrice = isManualOverride ? toSafeNumber(config.manualPrice, 0) : null;
  const effectiveRetail = manualPrice ?? retailFinal;
  const profit = effectiveRetail - costTotal;
  const profitPercent =
    effectiveRetail > 0
      ? Math.round((profit / effectiveRetail) * 1000) / 10
      : null;

  return {
    retailWindowsBase: roundRub(retailWindowsBase),
    retailFoundations: roundRub(retailFoundations),
    retailBeams: roundRub(retailBeams),
    retailDistance: roundRub(retailDistance),
    retailHeightWork: roundRub(retailHeightWork),
    retailSubtotal: roundRub(retailSubtotal),
    retailAfterMinimum: roundRub(retailAfterMinimum),
    retailFinal,
    costBase: roundRub(costBase),
    costExtra: roundRub(costExtra),
    costDistance: roundRub(costDistance),
    costTotal,
    profit: roundRub(profit),
    profitPercent,
    isMinimumApplied,
    isManualOverride,
    isLoss: profit < 0,
    hasPriceError,
    priceErrorFields: [...new Set(priceErrorFields)],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Снимок прайса — фиксация при бронировании
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Делает снимок актуальных цен для сохранения в заказ.
 * Вызывается при первом назначении mountingDate.
 */
export function captureCurrentPriceSnapshot(
  teamCategory: TeamCategory,
  prices: MountingPriceMap = {},
): MountingPriceSnapshot {
  const category = teamCategory ?? DEFAULT_TEAM_CATEGORY;

  return {
    capturedAt: new Date().toISOString(),

    teamRetailRate: getPrice(
      prices,
      getTeamRetailSlug(category),
      MOUNTING_PRICES.TEAM_RETAIL_RATES[category],
    ),

    teamCostRate: getPrice(
      prices,
      getTeamCostSlug(category),
      MOUNTING_PRICES.TEAM_COST_RATES[category],
    ),

    fuelCostPerKm: getPrice(
      prices,
      'fuel_cost_per_km',
      MOUNTING_PRICES.FUEL_COST_PER_KM,
    ),

    kmTariffRetail: getPrice(
      prices,
      'km_retail',
      MOUNTING_PRICES.KM_TARIFF_RETAIL,
    ),

    extraFoundationPrices: {
      wood: getPrice(prices, 'extra_foundation_wood', MOUNTING_PRICES.EXTRA_FOUNDATION_PRICE_PER_M.wood),
      concrete: getPrice(prices, 'extra_foundation_concrete', MOUNTING_PRICES.EXTRA_FOUNDATION_PRICE_PER_M.concrete),
      brick: getPrice(prices, 'extra_foundation_brick', MOUNTING_PRICES.EXTRA_FOUNDATION_PRICE_PER_M.brick),
      metal: getPrice(prices, 'extra_foundation_metal', MOUNTING_PRICES.EXTRA_FOUNDATION_PRICE_PER_M.metal),
      round_wood: getPrice(prices, 'extra_foundation_round_wood', MOUNTING_PRICES.EXTRA_FOUNDATION_PRICE_PER_M.round_wood),
    },

    beamPrices: {
      wood_50x50: getPrice(prices, 'beam_wood_50x50', MOUNTING_PRICES.MOUNTING_BEAMS.wood_50x50),
      planed_wood_50x50: getPrice(prices, 'beam_planed_wood_50x50', MOUNTING_PRICES.MOUNTING_BEAMS.planed_wood_50x50),
      timber_100x100: getPrice(prices, 'beam_timber_100x100', MOUNTING_PRICES.MOUNTING_BEAMS.timber_100x100),
      timber_150x150: getPrice(prices, 'beam_timber_150x150', MOUNTING_PRICES.MOUNTING_BEAMS.timber_150x150),
    },

    heightWorkPrices: {
      stairs: getPrice(prices, 'height_stairs', MOUNTING_PRICES.HEIGHT_WORK.stairs),
      scaffold: getPrice(prices, 'height_scaffold', MOUNTING_PRICES.HEIGHT_WORK.scaffold),
      both: getPrice(prices, 'height_both', MOUNTING_PRICES.HEIGHT_WORK.both),
    },

    minRetailPrice: getPrice(
      prices,
      'min_retail_mounting',
      MOUNTING_PRICES.MIN_RETAIL_PRICE,
    ),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Детектор конфликтов расписания
// ─────────────────────────────────────────────────────────────────────────────

export interface ScheduleEntry {
  clientId: string;
  memberId: string;
  mountingDate: string;
  durationDays: number;
}

/**
 * Находит конфликты расписания: один монтажник назначен на несколько заказов
 * в один календарный день.
 */
export function detectScheduleConflicts(
  entries: ScheduleEntry[],
): Map<string, boolean> {
  const memberDateMap = new Map<string, Map<string, string[]>>();

  for (const entry of entries) {
    if (!entry.memberId || !entry.mountingDate) continue;

    if (!memberDateMap.has(entry.memberId)) {
      memberDateMap.set(entry.memberId, new Map());
    }

    const dateMap = memberDateMap.get(entry.memberId)!;
    const startDate = new Date(entry.mountingDate);
    const durationDays = normalizeDurationDays(entry.durationDays);

    if (Number.isNaN(startDate.getTime())) continue;

    for (let i = 0; i < durationDays; i += 1) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      if (!dateMap.has(dateStr)) dateMap.set(dateStr, []);
      dateMap.get(dateStr)!.push(entry.clientId);
    }
  }

  const conflictedClientIds = new Set<string>();

  for (const dateMap of memberDateMap.values()) {
    for (const clientIds of dateMap.values()) {
      if (clientIds.length > 1) {
        clientIds.forEach((clientId) => conflictedClientIds.add(clientId));
      }
    }
  }

  const result = new Map<string, boolean>();
  for (const entry of entries) {
    result.set(entry.clientId, conflictedClientIds.has(entry.clientId));
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Построение событий для календаря
// ─────────────────────────────────────────────────────────────────────────────

export interface RawClientCalendarData {
  id: string;
  fio: string;
  address: string | null;
  mountingConfig: MountingConfig | null;
  items?: unknown;
}

/**
 * Преобразует клиентов из БД в события глобального календаря.
 */
export function buildCalendarEvents(
  clients: RawClientCalendarData[],
  prices: MountingPriceMap = {},
): CalendarEvent[] {
  const scheduled = clients.filter(
    (client) =>
      client.mountingConfig?.enabled &&
      Boolean(client.mountingConfig.mountingDate),
  );

  const scheduleEntries: ScheduleEntry[] = scheduled.map((client) => ({
    clientId: client.id,
    memberId: client.mountingConfig?.team?.memberId ?? '',
    mountingDate: client.mountingConfig?.mountingDate ?? '',
    durationDays: normalizeDurationDays(client.mountingConfig?.durationDays),
  }));

  const conflictMap = detectScheduleConflicts(scheduleEntries);

  return scheduled.map((client) => {
    const mountingConfig = client.mountingConfig!;
    const memberId = mountingConfig.team?.memberId ?? '';
    const member = TEAM_MEMBERS.find((item) => item.id === memberId);
    const parsedItems = parseWindowItems(client.items ?? []);
    const areaM2 = calculateTotalArea(parsedItems);

    const calcResult = calculateMounting(mountingConfig, areaM2, prices);
    console.log('[buildCalendarEvents]', {
      clientId: client.id,
      clientName: client.fio,
      rawItems: client.items,
      parsedItemsCount: parsedItems.length,
      areaM2,
      manualPrice: mountingConfig.manualPrice,
      calcRetailFinal: calcResult.retailFinal,
      finalRetail: mountingConfig.manualPrice ?? calcResult.retailFinal,
    });


    return {
      clientId: client.id,
      clientName: client.fio,
      address: client.address ?? 'Адрес не указан',
      mountingDate: mountingConfig.mountingDate!,
      durationDays: normalizeDurationDays(mountingConfig.durationDays),
      startTime: mountingConfig.startTime || '09:00',
      endTime: mountingConfig.endTime || '18:00',
      memberId,
      memberName: member?.name ?? 'Не назначен',
      memberColor: member?.color ?? '#7BFF00',
      status: (mountingConfig.status ?? 'pending') as MountingStatus,
      retailFinal: mountingConfig.manualPrice ?? calcResult.retailFinal,
      isConflict: conflictMap.get(client.id) ?? false,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Форматирование для отображения
// ─────────────────────────────────────────────────────────────────────────────

const rubleFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

/** Форматирует число в рубли: «7 500 ₽» */
export function formatMountingMoney(value: number): string {
  return rubleFormatter.format(Number.isFinite(value) ? value : 0);
}

/** Строит список дат заказа для многодневных событий в календаре */
export function getEventDates(
  mountingDate: string,
  durationDays: number,
): string[] {
  const dates: string[] = [];
  const startDate = new Date(mountingDate);

  if (Number.isNaN(startDate.getTime())) return dates;

  const days = normalizeDurationDays(durationDays);

  for (let i = 0; i < days; i += 1) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }

  return dates;
}
