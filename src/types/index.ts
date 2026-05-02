/**
 * UNIFIED TYPE REGISTRY
 *
 * Contains:
 * - Fastener types: FastenerType, FastenerFinish, FastenerConfig
 * - Extras types: StrapConfig, ZipperItem, DividerItem, CutoutItem, WeldingItem, AdditionalElements
 * - WindowItem extended with additionalElements
 * - Client, Stage for UI layer
 *
 * @module src/types/index.ts
 */

import { type ClientStatus } from '@/lib/logic/statusDictionary';

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

export type FastenerSideState = 'default' | boolean;

export interface FastenerSides {
  top: FastenerSideState;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

// В файле типов (примерно так должен выглядеть FastenerConfig)
export interface FastenerConfig {
  type: string;
  sides: {
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
  };
  finish: FastenerFinish; // ДОБАВЛЕНО: возвращаем легальный статус полю finish
  priceRetail: number;
  priceCost: number;
  retailCost?: number;
  costCost?: number;
}

export function getInitialFastener(): FastenerConfig {
  return {
    type: 'none',
    sides: { top: false, right: false, bottom: false, left: false },
    finish: null, // Теперь это поле законно
    priceRetail: 0,
    priceCost: 0,
    retailCost: 0,
    costCost: 0,
  };
}

// Backward-compat alias
export const getDefaultFastenerConfig = getInitialFastener;

// ─────────────────────────────────────────────────────────────────────────────
// Extras — Straps
// ─────────────────────────────────────────────────────────────────────────────

export type StrapType = 'grommet' | 'fastex';

/**
 * Strap configuration for a window.
 * `count` is derived automatically from the outer top dimension unless
 * `isManual` is true, in which case the manager's override is used.
 */
export interface StrapConfig {
  /** Resolved strap count (derived or manually overridden). */
  count: number;
  /** When true, `count` is a manual manager override; otherwise derived. */
  isManual: boolean;
  type: StrapType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extras — Zippers
// ─────────────────────────────────────────────────────────────────────────────

export type ElementOrientation = 'horizontal' | 'vertical';

/**
 * Zipper element (UI/Canvas only — does NOT affect cut-plan).
 *
 * Coordinate reference: origin = TOP-LEFT of light opening.
 * - horizontal: positionFromStart = Y from top; offsetStart = trim from left; offsetEnd = trim from right
 * - vertical:   positionFromStart = X from left; offsetStart = trim from top; offsetEnd = trim from bottom
 *
 * Edge rule: if positionFromStart === 0 or === max dimension,
 * the visual border extends by managerBorder + 2 cm.
 */
export interface ZipperItem {
  id: string;
  orientation: ElementOrientation;
  /** Distance from the start edge (top for horizontal, left for vertical) in cm. */
  positionFromStart: number;
  /** Trim from the first perpendicular edge in cm (left for H, top for V). */
  offsetStart: number;
  /** Trim from the second perpendicular edge in cm (right for H, bottom for V). */
  offsetEnd: number;
  /** Width of the zipper tape on the "start" side of the seam in cm. */
  bandLeft: number;
  /** Width of the zipper tape on the "end" side of the seam in cm. */
  bandRight: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extras — Dividers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Divider element (UI/Canvas marker only).
 * Same coordinate conventions as ZipperItem.
 */
export interface DividerItem {
  id: string;
  orientation: ElementOrientation;
  /** Distance from the start edge in cm. */
  position: number;
  offsetStart: number;
  offsetEnd: number;
  /** Visual width of the divider band in cm. */
  width: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extras — Cutouts & Patches
// ─────────────────────────────────────────────────────────────────────────────

export type CutoutType = 'cut' | 'patch';

/**
 * Cutout or patch element.
 * `x`, `y` = top-left corner of the rectangle in window space (cm).
 * All four fields are strictly required — missing fields BLOCK calculation.
 */
export interface CutoutItem {
  id: string;
  type: CutoutType;
  /** X of top-left corner from left edge of light opening, cm. */
  x: number;
  /** Y of top-left corner from top edge of light opening, cm. */
  y: number;
  width: number;
  height: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extras — Technical Welding
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Technical welding marker (UI/Canvas domain only).
 * Does NOT split sections, does NOT alter zipper/divider geometry,
 * does NOT trigger cut-plan or production recalculation.
 */
export interface WeldingItem {
  id: string;
  orientation: ElementOrientation;
  /** Distance from the start edge in cm. */
  position: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extras — Skirt & Weight flags
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Container for all additional (extras) elements of a window.
 * Always fully initialized — never undefined.
 */
export interface AdditionalElements {
  straps: StrapConfig;
  zippers: ZipperItem[];
  dividers: DividerItem[];
  cutouts: CutoutItem[];
  welding: WeldingItem[];
  /** Whether a skirt is present. If true, `skirtWidth` is required. */
  hasSkirt: boolean;
  /** Skirt height in cm. Required when hasSkirt = true. */
  skirtWidth: number;
  /** Whether a weight bar is present along the outer bottom. */
  hasWeight: boolean;
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
  | 'kantTop' | 'kantRight' | 'kantBottom' | 'kantLeft'
  | 'diagonalLeft' | 'diagonalRight' | 'crossbar';

export type WindowTextField = 'name' | 'kantColor' | 'material';
export type WindowBooleanField = 'isTrapezoid';
export type WindowEditableField = WindowNumericField | WindowTextField | WindowBooleanField;

export interface WindowItem {
  id: number;
  name: string;
  widthTop: number;
  heightRight: number;
  widthBottom: number;
  heightLeft: number;
  kantTop: number;
  kantRight: number;
  kantBottom: number;
  kantLeft: number;
  kantColor: KantColor;
  material: WindowMaterial;
  isTrapezoid: boolean;
  diagonalLeft: number;
  diagonalRight: number;
  crossbar: number;
  fasteners?: FastenerConfig;
  /**
   * Additional elements. Always present after normalization.
   * Optional only to allow legacy DB records to exist before normalization.
   */
  additionalElements?: AdditionalElements;
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory helpers
// ─────────────────────────────────────────────────────────────────────────────

export function createDefaultAdditionalElements(): AdditionalElements {
  return {
    straps: { count: 2, isManual: false, type: 'grommet' },
    zippers: [],
    dividers: [],
    cutouts: [],
    welding: [],
    hasSkirt: false,
    skirtWidth: 0,
    hasWeight: false,
  };
}

export function createDefaultWindowItem(id: number, index: number): WindowItem {
  return {
    id,
    name: `Окно ${index}`,
    widthTop: 200,
    heightRight: 200,
    widthBottom: 200,
    heightLeft: 200,
    kantTop: 5,
    kantRight: 5,
    kantBottom: 5,
    kantLeft: 5,
    kantColor: 'Коричневый',
    material: 'ПВХ 700 мкм (Прозрачная)',
    isTrapezoid: false,
    diagonalLeft: 0,
    diagonalRight: 0,
    crossbar: 0,
    fasteners: getInitialFastener(),
    additionalElements: createDefaultAdditionalElements(),
  };
}

export function isWindowItem(value: unknown): value is WindowItem {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  const numericFields: WindowNumericField[] = [
    'widthTop', 'heightRight', 'widthBottom', 'heightLeft',
    'kantTop', 'kantRight', 'kantBottom', 'kantLeft',
    'diagonalLeft', 'diagonalRight', 'crossbar',
  ];
  const allNumericValid = numericFields.every(
    (field) => typeof obj[field] === 'number' && Number.isFinite(obj[field] as number),
  );
  return (
    typeof obj['id'] === 'number' &&
    typeof obj['name'] === 'string' &&
    typeof obj['isTrapezoid'] === 'boolean' &&
    typeof obj['kantColor'] === 'string' &&
    typeof obj['material'] === 'string' &&
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
      fasteners: item.fasteners ?? getInitialFastener(),
      // additionalElements normalized separately by normalizeWindowExtras
      additionalElements: item.additionalElements ?? undefined,
    });
    return acc;
  }, []);
}

// ─────────────────────────────────────────────────────────────────────────────
// Client, Stage
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Use WindowItem */
export interface Product { id: string; name: string; quantity: number; price: number; }

export interface Client {
  id: string; fio: string; phone: string; address: string | null;
  source?: string | null; totalPrice: number; advance?: number;
  balance?: number; paymentType?: string | null; status: ClientStatus;
  createdAt: string | Date; measurementDate?: string | Date | null;
  installDate?: string | Date | null; items?: WindowItem[] | null;
  managerComment?: string | null; engineerComment?: string | null;
}

export interface Stage { id: ClientStatus; title: string; }

// Внутри интерфейса WindowItem в src/types/index.ts

export interface WindowItem {
  id: number;
  name: string;
  // ... (существующие поля: размеры, канты и т.д.)

  fasteners?: FastenerConfig;
  additionalElements?: AdditionalElements;

  /** 
   * ── PRICE SNAPSHOT (HARD COPY) ──
   * Фиксация цен на момент расчета/сохранения изделия.
   * Эти поля заполняются автоматически при вызове calculateWindowGeometry.
   */

  /** Розничная цена выбранного крепежа за 1 единицу (₽) */
  fastenerPriceRetail?: number;
  /** Себестоимость выбранного крепежа за 1 единицу (₽) */
  fastenerPriceCost?: number;
  /** Slug из DEFAULT_PRICE_ROWS для идентификации в справочнике */
  fastenerSlug?: string;

  /** Общая стоимость крепежа для этого окна (Розница) */
  totalFastenersRetail?: number;
  /** Общая себестоимость крепежа для этого окна (Себес) */
  totalFastenersCost?: number;

  /** Метка времени фиксации цен */
  pricesCapturedAt?: string;
}
