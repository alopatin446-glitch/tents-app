/**
 * Сервис расчёта заказа — «Гроссбух».
 *
 * Собирает ServiceItem[] из всех модулей (допы, монтаж, доставка)
 * и возвращает итоговый OrderLedger.
 *
 * Принцип разделения:
 *   calculateExtrasAsServiceItems  — logika в extrasCalculations.ts
 *   mountingResultToServiceItems   — адаптер результата calculateMounting()
 *   buildDeliveryServiceItem       — доставка
 *   calculateOrder                 — только оркестрация: собрать → сложить → вернуть
 *
 * Источник цен: единственный PriceMap — тот же объект, что в calculateWindowFinance.
 * Никакого дублирования прайс-данных.
 *
 * @module src/services/calculationService.ts
 */

import { type WindowItem }  from '@/types';
import { type MountingConfig, type MountingCalculationResult } from '@/types/mounting';
import { type PriceMap } from '@/lib/logic/pricingLogic';
import {
  type ServiceItem,
  type OrderLedger,
  makeServiceItem,
  buildOrderLedger,
} from '@/logic/orders/Order';
import { calculateExtrasAsServiceItems } from '@/lib/logic/extrasCalculations';

// ─────────────────────────────────────────────────────────────────────────────
// Входные параметры расчёта заказа
// ─────────────────────────────────────────────────────────────────────────────

export interface CalculateOrderParams {
  /** Изделия заказа */
  windows: WindowItem[];

  /**
   * Живой прайс — тот же PriceMap, что передаётся в calculateWindowFinance.
   * Допы, монтажные ставки и доставка берутся отсюда.
   */
  priceMap: PriceMap;

  /**
   * Конфиг монтажа.
   * null / undefined → монтаж не подключён, строки не добавляются.
   */
  mountingConfig?: MountingConfig | null;

  /**
   * Готовый результат calculateMounting().
   * calculateOrder не пересчитывает монтаж — принимает уже готовый результат.
   * Используется только при mountingConfig.enabled === true.
   */
  mountingResult?: MountingCalculationResult | null;

  /**
   * Расстояние до объекта в одну сторону (км).
   * 0 / undefined → строка доставки не добавляется.
   */
  deliveryDistanceKm?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ключи PriceMap для доставки
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ключи стоимости доставки в PriceMap.
 * Заполнить в pricing.ts / БД.
 *
 * Конвенция: такая же, как у монтажных ключей (FUEL_COST_PER_KM / KM_TARIFF_RETAIL).
 * Здесь используем те же значения из MOUNTING_PRICES через priceMap,
 * если они там есть, — либо читаем из отдельных ключей 'delivery_retail' / 'delivery_cost'.
 */
const DELIVERY_RETAIL_KEY = 'delivery_retail'; // ₽/км (туда+обратно)
const DELIVERY_COST_KEY   = 'delivery_cost';   // ₽/км (туда+обратно)

// ─────────────────────────────────────────────────────────────────────────────
// Адаптер: MountingCalculationResult → ServiceItem[]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Разворачивает детализацию MountingCalculationResult в строки гроссбуха.
 *
 * Нулевые строки (retail = 0 И cost = 0) пропускаются.
 * При isMinimumApplied / isManualOverride детализация схлопывается в одну строку.
 */
function mountingResultToServiceItems(result: MountingCalculationResult): ServiceItem[] {
  const items: ServiceItem[] = [];

  const push = (id: string, name: string, retailPrice: number, costPrice: number): void => {
    if (retailPrice === 0 && costPrice === 0) return;
    items.push(makeServiceItem({ id, name, type: 'mounting', quantity: 1, unit: '₽', retailPrice, costPrice }));
  };

  // Ручная цена — одна строка, детализация не нужна
  if (result.isManualOverride) {
    push('mounting-manual', 'Монтаж (ручная цена)', result.retailFinal, result.costTotal);
    return items;
  }

  // Минималка — одна строка
  if (result.isMinimumApplied) {
    push('mounting-minimum', 'Монтаж (минимальная стоимость)', result.retailFinal, result.costTotal);
    return items;
  }

  // Детализация
  push('mounting-base',        'Монтаж (база)',             result.retailWindowsBase, result.costBase);
  push('mounting-foundations', 'Монтаж: доп. основания',   result.retailFoundations, result.costExtra);
  push('mounting-beams',       'Монтаж: балки',             result.retailBeams,       0);
  push('mounting-distance',    'ГСМ',                       result.retailDistance,    result.costDistance);
  push('mounting-height',      'Высотные работы',           result.retailHeightWork,  0);

  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// Адаптер: доставка → ServiceItem
// ─────────────────────────────────────────────────────────────────────────────

function buildDeliveryServiceItem(distanceKm: number, priceMap: PriceMap): ServiceItem {
  const totalKm    = distanceKm * 2; // туда + обратно
  const retailPerKm = priceMap[DELIVERY_RETAIL_KEY] ?? 9999;
  const costPerKm   = priceMap[DELIVERY_COST_KEY]   ?? 9999;

  return makeServiceItem({
    id:          'delivery',
    name:        'Доставка',
    type:        'delivery',
    quantity:    totalKm,
    unit:        'км',
    retailPrice: retailPerKm,
    costPrice:   costPerKm,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Главная функция: calculateOrder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Собирает полный гроссбух заказа из всех модулей.
 *
 * Порядок сборки:
 *   1. Допы (extras)  — по каждому окну через calculateExtrasAsServiceItems
 *   2. Монтаж         — если mountingConfig.enabled && mountingResult передан
 *   3. Доставка       — если deliveryDistanceKm > 0
 *
 * Источник всех цен: priceMap — единый объект, без дублирования.
 *
 * @returns OrderLedger с плоским ServiceItem[] и агрегатными итогами
 */
export function calculateOrder(params: CalculateOrderParams): OrderLedger {
  const { windows, priceMap, mountingConfig, mountingResult, deliveryDistanceKm } = params;

  const allItems: ServiceItem[] = [];

  // 1. Допы ──────────────────────────────────────────────────────────────────
  windows.forEach((win, idx) => {
    allItems.push(...calculateExtrasAsServiceItems(win, priceMap, idx));
  });

  // 2. Монтаж ────────────────────────────────────────────────────────────────
  if (mountingConfig?.enabled && mountingResult) {
    allItems.push(...mountingResultToServiceItems(mountingResult));
  }

  // 3. Доставка ──────────────────────────────────────────────────────────────
  if (deliveryDistanceKm && deliveryDistanceKm > 0) {
    allItems.push(buildDeliveryServiceItem(deliveryDistanceKm, priceMap));
  }

  return buildOrderLedger(allItems);
}

// ─────────────────────────────────────────────────────────────────────────────
// Утилита: привязка ServiceItem[] к конкретному окну
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Выбирает из OrderLedger.items строки, принадлежащие одному окну.
 *
 * Критерий совпадения: id содержит маркер `-w${windowId}-`.
 * Используется для заполнения WindowItem.services перед сохранением в БД.
 *
 * @example
 *   const ledger = calculateOrder(params);
 *   const updatedWindows = windows.map((win) => ({
 *     ...win,
 *     services: extractWindowServices(ledger.items, win.id),
 *   }));
 */
export function extractWindowServices(
  ledgerItems: ServiceItem[],
  windowId:    number,
): ServiceItem[] {
  return ledgerItems.filter((item) => item.id.includes(`-w${windowId}-`));
}