/**
 * UNIFIED TYPE REGISTRY
 *
 * Contains:
 * - Fastener types: FastenerType, FastenerFinish, FastenerConfig
 * - Extras types: StrapConfig, ZipperItem, DividerItem, CutoutItem, WeldingItem, AdditionalElements
 * - WindowItem (единственное объявление, все поля собраны здесь)
 * - Client, Stage for UI layer
 *
 * Разделение площадей (реэкспорт из ядра):
 *   WindowGeometry.retailArea    — Max W × Max H (чек клиента).
 *   WindowGeometry.productionArea — реальная площадь (ЗП цеха).
 *
 * @module src/types/index.ts
 */

import { type ClientStatus } from '@/lib/logic/statusDictionary';
import { type ServiceItem }  from '@/logic/orders/Order';

// Реэкспортируем WindowGeometry, чтобы импортировать её из '@/types'
// вместо прямого пути к windowCalculations.ts.
export type { WindowGeometry, OrderOptimization } from '@/lib/logic/windowCalculations';

// ─────────────────────────────────────────────────────────────────────────────
// Fastener types
// ─────────────────────────────────────────────────────────────────────────────

export type FastenerType =
  | 'eyelet_10'
  | 'strap'
  | 'staple_pa'
  | 'staple_metal'
  | 'french_lock'
  | 'none';

export type FastenerFinish = 'zinc' | 'black' | 'color' | null;

/**
 * 'default' — автоматический выбор (например, люверс 10мм для верха)
 * boolean   — принудительное включение/выключение
 */
export type FastenerSideState = 'default' | boolean;

export interface FastenerSides {
  top:    FastenerSideState;
  right:  boolean;
  bottom: boolean;
  left:   boolean;
}

export interface FastenerConfig {
  type:         FastenerType;
  sides:        FastenerSides;
  finish:       FastenerFinish;
  priceRetail:  number;
  pointsCount?: number;
  priceCost:    number;
  retailCost?:  number;
  costCost?:    number;
}

export function getInitialFastener(): FastenerConfig {
  return {
    type:   'none',
    sides:  { top: false, right: false, bottom: false, left: false },
    finish: null,
    priceRetail: 0,
    priceCost:   0,
    retailCost:  0,
    costCost:    0,
  };
}

// Backward-compat alias
export const getDefaultFastenerConfig = getInitialFastener;

// ─────────────────────────────────────────────────────────────────────────────
// Extras — Straps
// ─────────────────────────────────────────────────────────────────────────────

export type StrapType = 'grommet' | 'fastex';

export interface StrapConfig {
  count:    number;
  isManual: boolean;
  type:     StrapType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extras — Zippers
// ─────────────────────────────────────────────────────────────────────────────

export type ElementOrientation = 'horizontal' | 'vertical';

export interface ZipperItem {
  id:                string;
  orientation:       ElementOrientation;
  positionFromStart: number;
  offsetStart:       number;
  offsetEnd:         number;
  bandLeft:          number;
  bandRight:         number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extras — Dividers
// ─────────────────────────────────────────────────────────────────────────────

export interface DividerItem {
  id:          string;
  orientation: ElementOrientation;
  position:    number;
  offsetStart: number;
  offsetEnd:   number;
  width:       number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extras — Cutouts & Patches
// ─────────────────────────────────────────────────────────────────────────────

export type CutoutType = 'cut' | 'patch';

export interface CutoutItem {
  id:     string;
  type:   CutoutType;
  x:      number;
  y:      number;
  width:  number;
  height: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extras — Technical Welding
// ─────────────────────────────────────────────────────────────────────────────

export interface WeldingItem {
  id:          string;
  orientation: ElementOrientation;
  position:    number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extras — Skirt & Weight
// ─────────────────────────────────────────────────────────────────────────────

export interface AdditionalElements {
  straps:     StrapConfig;
  zippers:    ZipperItem[];
  dividers:   DividerItem[];
  cutouts:    CutoutItem[];
  welding:    WeldingItem[];
  hasSkirt:   boolean;
  skirtWidth: number;
  hasWeight:  boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// WindowItem
// ─────────────────────────────────────────────────────────────────────────────

export type WindowMaterial =
  | 'ПВХ 700 мкм (Прозрачная)'
  | 'ПВХ 700 мкм (Тонированная)'
  | 'ТПУ Полиуретан'
  | 'Москитная сетка';

export type KantColor =
  | 'Белый'
  | 'Светло-серый'
  | 'Серый'
  | 'Графит'
  | 'Черный'
  | 'Коричневый'
  | 'Бежевый'
  | 'Синий';

export type WindowNumericField =
  | 'widthTop' | 'heightRight' | 'widthBottom' | 'heightLeft'
  | 'kantTop'  | 'kantRight'   | 'kantBottom'  | 'kantLeft'
  | 'diagonalLeft' | 'diagonalRight' | 'crossbar';

export type WindowTextField    = 'name' | 'kantColor' | 'material';
export type WindowBooleanField = 'isTrapezoid';
export type WindowEditableField = WindowNumericField | WindowTextField | WindowBooleanField;

/**
 * Изделие ПВХ-шторы.
 *
 * Одно объявление — единственный источник истины.
 * Все поля собраны здесь: геометрия, кант, крепёж, доп. элементы,
 * снимок цен (price snapshot), привязанные услуги.
 */
export interface WindowItem {
  id:          number;
  name:        string;
  widthTop:    number;
  heightRight: number;
  widthBottom: number;
  heightLeft:  number;
  kantTop:     number;
  kantRight:   number;
  kantBottom:  number;
  kantLeft:    number;
  kantColor:   KantColor;
  material:    WindowMaterial;
  isTrapezoid: boolean;
  diagonalLeft:  number;
  diagonalRight: number;
  crossbar:      number;

  fasteners?: FastenerConfig;

  /**
   * Дополнительные элементы. Всегда присутствуют после нормализации.
   * Optional для совместимости с legacy-записями в БД.
   */
  additionalElements?: AdditionalElements;

  /**
   * Услуги, привязанные к конкретному окну (вырезы, молнии и т.д.).
   *
   * Заполняется из OrderLedger через extractWindowServices() перед сохранением.
   * Позволяет видеть в спецификации окна точный состав и стоимость его допов.
   *
   * Optional: отсутствует в legacy-записях и при отсутствии допов.
   */
  services?: ServiceItem[];

  // ── Снимок цен (price snapshot) ──────────────────────────────────────────
  // Заполняется автоматически при сохранении изделия.
  // Защищает закрытые сделки от изменения прайса.

  /** Розничная цена крепежа за 1 ед. (₽) */
  fastenerPriceRetail?: number;
  /** Себестоимость крепежа за 1 ед. (₽) */
  fastenerPriceCost?: number;
  /** Slug из DEFAULT_PRICE_ROWS */
  fastenerSlug?: string;
  /** Итоговая стоимость крепежа по заказу (розница, ₽) */
  totalFastenersRetail?: number;
  /** Итоговая себестоимость крепежа (₽) */
  totalFastenersCost?: number;
  /** Метка времени фиксации цен (ISO 8601) */
  pricesCapturedAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory helpers
// ─────────────────────────────────────────────────────────────────────────────

export function createDefaultAdditionalElements(): AdditionalElements {
  return {
    straps:     { count: 2, isManual: false, type: 'grommet' },
    zippers:    [],
    dividers:   [],
    cutouts:    [],
    welding:    [],
    hasSkirt:   false,
    skirtWidth: 0,
    hasWeight:  false,
  };
}

export function createDefaultWindowItem(id: number, index: number): WindowItem {
  return {
    id,
    name:          `Окно ${index}`,
    widthTop:      200,
    heightRight:   200,
    widthBottom:   200,
    heightLeft:    200,
    kantTop:       5,
    kantRight:     5,
    kantBottom:    5,
    kantLeft:      5,
    kantColor:     'Коричневый',
    material:      'ПВХ 700 мкм (Прозрачная)',
    isTrapezoid:   false,
    diagonalLeft:  0,
    diagonalRight: 0,
    crossbar:      0,
    fasteners:         getInitialFastener(),
    additionalElements: createDefaultAdditionalElements(),
  };
}

export function isWindowItem(value: unknown): value is WindowItem {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  const numericFields: WindowNumericField[] = [
    'widthTop', 'heightRight', 'widthBottom', 'heightLeft',
    'kantTop',  'kantRight',   'kantBottom',  'kantLeft',
    'diagonalLeft', 'diagonalRight', 'crossbar',
  ];
  const allNumericValid = numericFields.every(
    (field) => typeof obj[field] === 'number' && Number.isFinite(obj[field] as number),
  );
  return (
    typeof obj['id']          === 'number'  &&
    typeof obj['name']        === 'string'  &&
    typeof obj['isTrapezoid'] === 'boolean' &&
    typeof obj['kantColor']   === 'string'  &&
    typeof obj['material']    === 'string'  &&
    allNumericValid
  );
}

export function parseWindowItems(raw: unknown): WindowItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.reduce<WindowItem[]>((acc, item) => {
    if (!isWindowItem(item)) {
      console.warn('[parseWindowItems] Skipping invalid record:', item);
      return acc;
    }
    acc.push({
      ...item,
      fasteners:          item.fasteners          ?? getInitialFastener(),
      additionalElements: item.additionalElements  ?? undefined,
      services:           item.services            ?? undefined,
    });
    return acc;
  }, []);
}

// ─────────────────────────────────────────────────────────────────────────────
// Client, Stage
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Use WindowItem */
export interface Product {
  id: string; name: string; quantity: number; price: number;
}

export interface Client {
  id: string; fio: string; phone: string; address: string | null;
  source?: string | null; totalPrice: number; advance?: number;
  balance?: number; paymentType?: string | null; status: ClientStatus;
  createdAt: string | Date; measurementDate?: string | Date | null;
  installDate?: string | Date | null; items?: WindowItem[] | null;
  managerComment?: string | null; engineerComment?: string | null;
}

export interface Stage { id: ClientStatus; title: string; }