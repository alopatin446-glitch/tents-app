/**
 * ЕДИНЫЙ ИСТОЧНИК ПРАВДЫ — Расчёты монтажного блока
 * @module src/lib/logic/mountingCalculations.ts
 *
 * Правила:
 *   РОЗНИЦА:
 *     = (площадь × розничный тариф бригады)
 *     + базовое основание, если по прайсу есть надбавка
 *     + (Σ длина доп. оснований × ставка доп. основания)
 *     + (Σ длина балок × ставка балки)
 *     + (расстояние × 2 × розничный тариф км)
 *     + (высотные работы × количество дней)
 *     Минималка: max(розница, MIN_RETAIL_PRICE)
 *     После минималки: × complexityFactor
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

// ─────────────────────────────────────────────────────────────────────────────
// Константы
// ─────────────────────────────────────────────────────────────────────────────

/** Сигнальное значение «цена не установлена» */
const PRICE_ERROR_SENTINEL = 9999;

const DEFAULT_TEAM_CATEGORY: TeamCategory = 'mid';
const DEFAULT_HEIGHT_WORK_TYPE: HeightWorkType = 'stairs';

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

function normalizeComplexityFactor(value: unknown): number {
  const factor = toSafeNumber(value, MOUNTING_PRICES.DEFAULT_COMPLEXITY_FACTOR);
  return factor > 0 ? factor : MOUNTING_PRICES.DEFAULT_COMPLEXITY_FACTOR;
}

function getTeamCategory(config: MountingConfig): TeamCategory {
  return config.team?.category ?? DEFAULT_TEAM_CATEGORY;
}

function getArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
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
 * Розничная надбавка за базовое основание.
 * Для metal в текущем MountingConfig нет поля ручной цены, поэтому это корректно
 * ловится как ошибка прайса и должно блокировать сохранение.
 */
function calcBaseFoundationRetail(baseFoundation: FoundationType): PriceResult {
  const rate =
    MOUNTING_PRICES.BASE_FOUNDATION_SURCHARGE[
      baseFoundation as keyof typeof MOUNTING_PRICES.BASE_FOUNDATION_SURCHARGE
    ] ?? PRICE_ERROR_SENTINEL;

  if (isPriceError(rate)) {
    return priceError(`Базовое основание «${baseFoundation}» — цена не установлена`);
  }

  return priceOk(rate);
}

/**
 * Розничная стоимость одного дополнительного основания.
 */
function calcExtraFoundationRetail(
  foundation: ExtraFoundation,
  snapshot: MountingPriceSnapshot | null,
): PriceResult {
  const type = foundation.type as ExtraFoundationType;
  const length = toSafeNumber(foundation.length, 0);
  const foundationPrices =
    snapshot?.extraFoundationPrices ?? MOUNTING_PRICES.EXTRA_FOUNDATION_PRICE_PER_M;
  const rate = foundationPrices[type] ?? PRICE_ERROR_SENTINEL;

  if (isPriceError(rate)) {
    return priceError(`Доп. основание «${type}» — цена не установлена`);
  }

  return priceOk(rate * length);
}

/**
 * Розничная стоимость одной монтажной балки.
 * Для metal/custom ручная цена за м.п. обязательна.
 */
function calcBeamRetail(
  beam: MountingBeam,
  snapshot: MountingPriceSnapshot | null,
): PriceResult {
  const type = beam.type as BeamType;
  const length = toSafeNumber(beam.length, 0);

  if (type === 'metal' || type === 'custom') {
    const customPrice = toSafeNumber(beam.customPrice, NaN);

    if (isPriceError(customPrice)) {
      return priceError(`Балка «${type}» — цена не задана менеджером`);
    }

    return priceOk(customPrice * length);
  }

  const beamPrices = snapshot?.beamPrices ?? MOUNTING_PRICES.MOUNTING_BEAMS;
  const rate = beamPrices[type] ?? PRICE_ERROR_SENTINEL;

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
): MountingCalculationResult {
  if (!config?.enabled) {
    return emptyCalculationResult();
  }

  const snapshot = config.mountingSnapshot ?? null;
  const category = getTeamCategory(config);
  const areaM2 = normalizeArea(totalAreaM2);
  const distance = toSafeNumber(config.distance, 0);
  const durationDays = normalizeDurationDays(config.durationDays);
  const complexityFactor = normalizeComplexityFactor(config.complexityFactor);

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
    snapshot?.teamRetailRate ?? MOUNTING_PRICES.TEAM_RETAIL_RATES[category],
    'Тариф бригады (розница)',
  );
  const costRate = guard(
    snapshot?.teamCostRate ?? MOUNTING_PRICES.TEAM_COST_RATES[category],
    'Тариф бригады (себестоимость)',
  );
  const fuelCostPerKm = guard(
    snapshot?.fuelCostPerKm ?? MOUNTING_PRICES.FUEL_COST_PER_KM,
    'Ставка ГСМ (себестоимость)',
  );
  const kmTariffRetail = guard(
    snapshot?.kmTariffRetail ?? MOUNTING_PRICES.KM_TARIFF_RETAIL,
    'Тариф ГСМ (розница)',
  );
  const minRetailPrice = guard(
    snapshot?.minRetailPrice ?? MOUNTING_PRICES.MIN_RETAIL_PRICE,
    'Минимальная стоимость монтажа',
  );

  // ── РОЗНИЦА ──────────────────────────────────────────────────────────────
  const retailWindowsBase = areaM2 * retailRate;

  const baseFoundationCost = collect(
    calcBaseFoundationRetail(config.baseFoundation ?? 'concrete'),
  );

  const retailExtraFoundations = getArray(config.extraFoundations).reduce(
    (sum, foundation) => sum + collect(calcExtraFoundationRetail(foundation, snapshot)),
    0,
  );

  const retailFoundations = baseFoundationCost + retailExtraFoundations;

  const retailBeams = getArray(config.mountingBeams).reduce(
    (sum, beam) => sum + collect(calcBeamRetail(beam, snapshot)),
    0,
  );

  const retailDistance = distance * 2 * kmTariffRetail;

  let retailHeightWork = 0;
  if (config.heightWork?.active) {
    const heightWorkType = config.heightWork.type ?? DEFAULT_HEIGHT_WORK_TYPE;
    const heightWorkPrices = snapshot?.heightWorkPrices ?? MOUNTING_PRICES.HEIGHT_WORK;
    const heightWorkRate = guard(
      heightWorkPrices[heightWorkType] ?? PRICE_ERROR_SENTINEL,
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
  const retailFinal = roundRub(retailAfterMinimum * complexityFactor);

  // ── СЕБЕСТОИМОСТЬ ───────────────────────────────────────────────────────
  const costBase = areaM2 * costRate;
  const costExtra =
    (retailFoundations + retailBeams) * MOUNTING_PRICES.EXTRA_WORKS_COST_FACTOR;
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
): MountingPriceSnapshot {
  const category = teamCategory ?? DEFAULT_TEAM_CATEGORY;

  return {
    capturedAt: new Date().toISOString(),
    teamRetailRate: MOUNTING_PRICES.TEAM_RETAIL_RATES[category],
    teamCostRate: MOUNTING_PRICES.TEAM_COST_RATES[category],
    fuelCostPerKm: MOUNTING_PRICES.FUEL_COST_PER_KM,
    kmTariffRetail: MOUNTING_PRICES.KM_TARIFF_RETAIL,
    extraFoundationPrices: { ...MOUNTING_PRICES.EXTRA_FOUNDATION_PRICE_PER_M },
    beamPrices: { ...MOUNTING_PRICES.MOUNTING_BEAMS },
    heightWorkPrices: { ...MOUNTING_PRICES.HEIGHT_WORK },
    minRetailPrice: MOUNTING_PRICES.MIN_RETAIL_PRICE,
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
}

/**
 * Преобразует клиентов из БД в события глобального календаря.
 */
export function buildCalendarEvents(
  clients: RawClientCalendarData[],
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
    const calcResult = calculateMounting(mountingConfig, 0);

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
