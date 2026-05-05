/**
 * Типы данных для гроссбуха заказа.
 *
 * ServiceItem — универсальная строка любой услуги/работы в заказе.
 * Используется во всех модулях: допы, монтаж, доставка, кастом.
 *
 * @module src/types/order.ts
 */

// ─────────────────────────────────────────────────────────────────────────────
// ServiceItem
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Тип услуги:
 *   addon    — дополнительный элемент изделия (молния, разделитель, вырез…)
 *   mounting — монтаж и сопутствующее (основания, балки, ГСМ…)
 *   delivery — доставка
 *   custom   — ручная строка от менеджера
 */
export type ServiceItemType = 'addon' | 'mounting' | 'delivery' | 'custom';

export interface ServiceItem {
  /** Уникальный ID строки (uuid v4 или детерминированный slug+windowId) */
  id: string;

  /** Отображаемое название услуги */
  name: string;

  /** Тип услуги — определяет раздел в гроссбухе */
  type: ServiceItemType;

  /** Количество единиц */
  quantity: number;

  /** Единица измерения: 'шт', 'м.п.', 'м²', 'км', 'день' … */
  unit: string;

  /** Розничная цена за единицу (₽) */
  retailPrice: number;

  /** Себестоимость за единицу (₽) */
  costPrice: number;

  /** Итоговая розница: quantity × retailPrice (₽) */
  totalRetail: number;

  /** Итоговая себестоимость: quantity × costPrice (₽) */
  totalCost: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// OrderLedger — гроссбух заказа
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Итоговый гроссбух заказа.
 * Формируется в calculateOrder() из всех модулей.
 */
export interface OrderLedger {
  /** Все строки услуг, сгруппированные по типу */
  items: ServiceItem[];

  /** Итого розница (₽) */
  totalRetail: number;

  /** Итого себестоимость (₽) */
  totalCost: number;

  /** Прибыль = totalRetail − totalCost (₽) */
  profit: number;

  /** Маржа, % — null если totalRetail = 0 */
  marginPercent: number | null;

  /** true = есть хотя бы одна строка с priceError (цена 9999) */
  hasPriceError: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Создаёт ServiceItem с автоматически вычисленными total-полями. */
export function makeServiceItem(
  params: Omit<ServiceItem, 'totalRetail' | 'totalCost'>,
): ServiceItem {
  return {
    ...params,
    totalRetail: params.quantity * params.retailPrice,
    totalCost:   params.quantity * params.costPrice,
  };
}

/** Собирает OrderLedger из плоского массива ServiceItem[]. */
export function buildOrderLedger(items: ServiceItem[]): OrderLedger {
  const totalRetail = items.reduce((s, i) => s + i.totalRetail, 0);
  const totalCost   = items.reduce((s, i) => s + i.totalCost,   0);
  const profit      = totalRetail - totalCost;

  return {
    items,
    totalRetail,
    totalCost,
    profit,
    marginPercent: totalRetail > 0
      ? Math.round((profit / totalRetail) * 100 * 100) / 100
      : null,
    hasPriceError: items.some((i) => i.retailPrice === 9999 || i.costPrice === 9999),
  };
}