/**
 * SSOT — Extras logic
 *
 * Covers:
 *   - Strap count derivation from outer top horizontal
 *   - Extras validation (blocking rules)
 *   - Collision / out-of-bounds detection (warning rules)
 *   - Legacy window normalization (additionalElements hydration)
 *   - Proportional normalization on resize
 *   - Price calculation: extras → ServiceItem[]
 *
 * @module src/lib/logic/extrasCalculations.ts
 */

import type {
  WindowItem,
  AdditionalElements,
  ZipperItem,
  DividerItem,
  CutoutItem,
  WeldingItem,
} from '@/types';
import { createDefaultAdditionalElements } from '@/types';
import { type ServiceItem, makeServiceItem } from '@/logic/orders/Order';
import { ADDON_PRICE_CONFIG, type AddonSlug } from '@/constants/pricing';
import { type PriceMap } from '@/lib/logic/pricingLogic';
import { logger } from '@/lib/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Strap count derivation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derives required strap count from the outer top horizontal dimension (cm).
 *
 * Table (per spec):
 *   0–115:   2
 *   116–140: 3
 *   141–205: 4
 *   206–275: 5
 *   276–345: 6
 *   >345:    6 + ceil((outerTop − 345) / 70)
 */
export function deriveStrapCount(outerTopCm: number): number {
  if (outerTopCm <= 115) return 2;
  if (outerTopCm <= 140) return 3;
  if (outerTopCm <= 205) return 4;
  if (outerTopCm <= 275) return 5;
  if (outerTopCm <= 345) return 6;
  return 6 + Math.ceil((outerTopCm - 345) / 70);
}

/**
 * Returns the outer top horizontal dimension for a window in cm.
 * Outer top = widthTop + kantLeft + kantRight.
 */
export function getOuterTopCm(item: WindowItem): number {
  return item.widthTop + item.kantLeft + item.kantRight;
}

/**
 * Returns the outer bottom horizontal dimension for a window in cm.
 */
export function getOuterBottomCm(item: WindowItem): number {
  return item.widthBottom + item.kantLeft + item.kantRight;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation (blocking rules)
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtrasValidationResult {
  isValid: boolean;
  errors:  string[];
}

/**
 * Validates all active extras for a window.
 * Returns `isValid: false` + list of blocking errors if any field is missing/invalid.
 * A failed validation BLOCKS the final calculation.
 */
export function validateExtras(item: WindowItem): ExtrasValidationResult {
  const extras = item.additionalElements;
  if (!extras) return { isValid: true, errors: [] };

  const errors: string[] = [];

  const EDGE_EPSILON_CM = 0.01;
  const innerWidth  = Math.max(item.widthTop,  item.widthBottom);
  const innerHeight = Math.max(item.heightLeft, item.heightRight);

  if (extras.hasSkirt && extras.skirtWidth <= 0) {
    errors.push('Юбка включена, но ширина юбки не указана или равна нулю');
  }

  if (extras.hasWeight) {
    const outerBottomM = getOuterBottomCm(item) / 100;
    if (outerBottomM > 6) {
      errors.push(`Утяжелитель: нижняя внешняя ширина ${outerBottomM.toFixed(2)} м превышает лимит 6 м`);
    }
  }

  extras.zippers.forEach((z, idx) => {
    const label = `Молния #${idx + 1}`;
    if (!Number.isFinite(z.positionFromStart) || z.positionFromStart < 0) errors.push(`${label}: позиция от начала обязательна и должна быть ≥ 0`);
    if (!Number.isFinite(z.offsetStart)       || z.offsetStart < 0)       errors.push(`${label}: отступ от начала должен быть ≥ 0`);
    if (!Number.isFinite(z.offsetEnd)         || z.offsetEnd   < 0)       errors.push(`${label}: отступ от конца должен быть ≥ 0`);
    if (!Number.isFinite(z.bandLeft)          || z.bandLeft    < 0)       errors.push(`${label}: левая полоса должна быть ≥ 0`);
    if (!Number.isFinite(z.bandRight)         || z.bandRight   < 0)       errors.push(`${label}: правая полоса должна быть ≥ 0`);
  });

  extras.dividers.forEach((d, idx) => {
    const label = `Разделитель #${idx + 1}`;
    if (!Number.isFinite(d.position)    || d.position    <  0) errors.push(`${label}: позиция обязательна и должна быть ≥ 0`);
    if (!Number.isFinite(d.offsetStart) || d.offsetStart <  0) errors.push(`${label}: отступ от начала должен быть ≥ 0`);
    if (!Number.isFinite(d.offsetEnd)   || d.offsetEnd   <  0) errors.push(`${label}: отступ от конца должен быть ≥ 0`);
    if (!Number.isFinite(d.width)       || d.width       <= 0) errors.push(`${label}: ширина обязательна и должна быть больше 0`);
  });

  extras.cutouts.forEach((c, idx) => {
    const label = `${c.type === 'cut' ? 'Вырез' : 'Заплатка'} #${idx + 1}`;
    if (!Number.isFinite(c.x)      || c.x      <  0) errors.push(`${label}: координата X обязательна и должна быть ≥ 0`);
    if (!Number.isFinite(c.y)      || c.y      <  0) errors.push(`${label}: координата Y обязательна и должна быть ≥ 0`);
    if (!Number.isFinite(c.width)  || c.width  <= 0) errors.push(`${label}: ширина обязательна и должна быть больше 0`);
    if (!Number.isFinite(c.height) || c.height <= 0) errors.push(`${label}: высота обязательна и должна быть больше 0`);

    const valid = Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.width) && Number.isFinite(c.height)
      && c.x >= 0 && c.y >= 0 && c.width > 0 && c.height > 0;
    if (!valid) return;

    const touchesLeft   = Math.abs(c.x)                        <= EDGE_EPSILON_CM;
    const touchesTop    = Math.abs(c.y)                        <= EDGE_EPSILON_CM;
    const touchesRight  = Math.abs(c.x + c.width  - innerWidth)  <= EDGE_EPSILON_CM;
    const touchesBottom = Math.abs(c.y + c.height - innerHeight) <= EDGE_EPSILON_CM;
    if (!touchesLeft && !touchesTop && !touchesRight && !touchesBottom) {
      errors.push(`${label}: должен примыкать к краю изделия`);
    }
  });

  extras.welding.forEach((w, idx) => {
    if (!Number.isFinite(w.position) || w.position < 0)
      errors.push(`Сварка #${idx + 1}: позиция обязательна и должна быть ≥ 0`);
  });

  if (item.isTrapezoid) {
    const hasAnyExtras =
      extras.zippers.length  > 0 || extras.dividers.length > 0 ||
      extras.cutouts.length  > 0 || extras.welding.length  > 0;
    if (hasAnyExtras && !item.diagonalLeft && !item.diagonalRight) {
      errors.push('Трапеция: для отображения допов нужно указать левую или правую диагональ');
    }
  }

  if (errors.length > 0) {
    logger.warn('[extrasCalculations] Validation blocked', { windowId: item.id, errors });
  }

  return { isValid: errors.length === 0, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Collision / out-of-bounds detection (warning rules)
// ─────────────────────────────────────────────────────────────────────────────

export type CollisionKind =
  | 'rect_rect'
  | 'line_line'
  | 'line_rect'
  | 'duplicate'
  | 'out_of_bounds';

export interface CollisionWarning {
  kind:        CollisionKind;
  message:     string;
  involvedIds: string[];
}

interface Rect    { x: number; y: number; width: number; height: number; }
interface Segment { position: number; start: number; end: number; orientation: 'horizontal' | 'vertical'; id: string; label: string; }

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
function segmentsOverlap(a: Segment, b: Segment): boolean {
  if (a.orientation !== b.orientation) return false;
  if (Math.abs(a.position - b.position) > 2) return false;
  return a.start < b.end && b.start < a.end;
}
function segmentCrossesRect(seg: Segment, rect: Rect): boolean {
  if (seg.orientation === 'horizontal') {
    if (seg.position < rect.y || seg.position > rect.y + rect.height) return false;
    return seg.start < rect.x + rect.width && seg.end > rect.x;
  }
  if (seg.position < rect.x || seg.position > rect.x + rect.width) return false;
  return seg.start < rect.y + rect.height && seg.end > rect.y;
}
function zipperToSegment(z: ZipperItem, maxH: number, maxW: number): Segment {
  return z.orientation === 'horizontal'
    ? { id: z.id, label: 'zipper', orientation: 'horizontal', position: z.positionFromStart, start: z.offsetStart, end: maxW - z.offsetEnd }
    : { id: z.id, label: 'zipper', orientation: 'vertical',   position: z.positionFromStart, start: z.offsetStart, end: maxH - z.offsetEnd };
}
function dividerToSegment(d: DividerItem, maxH: number, maxW: number): Segment {
  return d.orientation === 'horizontal'
    ? { id: d.id, label: 'divider', orientation: 'horizontal', position: d.position, start: d.offsetStart, end: maxW - d.offsetEnd }
    : { id: d.id, label: 'divider', orientation: 'vertical',   position: d.position, start: d.offsetStart, end: maxH - d.offsetEnd };
}
function weldingToSegment(w: WeldingItem, maxH: number, maxW: number): Segment {
  return w.orientation === 'horizontal'
    ? { id: w.id, label: 'welding', orientation: 'horizontal', position: w.position, start: 0, end: maxW }
    : { id: w.id, label: 'welding', orientation: 'vertical',   position: w.position, start: 0, end: maxH };
}

export function detectExtrasCollisions(item: WindowItem): CollisionWarning[] {
  const extras = item.additionalElements;
  if (!extras) return [];

  const warnings: CollisionWarning[] = [];
  const maxW = item.widthTop;
  const maxH = item.heightLeft;

  extras.zippers.forEach((z) => {
    const dim = z.orientation === 'horizontal' ? maxH : maxW;
    if (z.positionFromStart < 0 || z.positionFromStart > dim)
      warnings.push({ kind: 'out_of_bounds', message: `Молния "${z.id}" выходит за границы изделия`, involvedIds: [z.id] });
  });
  extras.dividers.forEach((d) => {
    const dim = d.orientation === 'horizontal' ? maxH : maxW;
    if (d.position < 0 || d.position > dim)
      warnings.push({ kind: 'out_of_bounds', message: `Разделитель "${d.id}" выходит за границы изделия`, involvedIds: [d.id] });
  });
  extras.welding.forEach((w) => {
    const dim = w.orientation === 'horizontal' ? maxH : maxW;
    if (w.position < 0 || w.position > dim)
      warnings.push({ kind: 'out_of_bounds', message: `Техпайка "${w.id}" выходит за границы изделия`, involvedIds: [w.id] });
  });
  extras.cutouts.forEach((c) => {
    if (c.x < 0 || c.y < 0 || c.x + c.width > maxW || c.y + c.height > maxH)
      warnings.push({ kind: 'out_of_bounds', message: `${c.type === 'cut' ? 'Вырез' : 'Заплатка'} "${c.id}" выходит за границы изделия`, involvedIds: [c.id] });
  });

  const allSegments: Segment[] = [
    ...extras.zippers.map((z) => zipperToSegment(z, maxH, maxW)),
    ...extras.dividers.map((d) => dividerToSegment(d, maxH, maxW)),
    ...extras.welding.map((w) => weldingToSegment(w, maxH, maxW)),
  ];
  for (let i = 0; i < allSegments.length; i++) {
    for (let j = i + 1; j < allSegments.length; j++) {
      const a = allSegments[i]; const b = allSegments[j];
      if (segmentsOverlap(a, b)) {
        warnings.push({ kind: Math.abs(a.position - b.position) < 2 ? 'duplicate' : 'line_line', message: `Элементы "${a.label}" и "${b.label}" перекрываются или расположены слишком близко`, involvedIds: [a.id, b.id] });
      }
    }
  }
  const cutoutRects = extras.cutouts.map((c) => ({ id: c.id, rect: { x: c.x, y: c.y, width: c.width, height: c.height } }));
  allSegments.forEach((seg) => {
    cutoutRects.forEach(({ rect, id }) => {
      if (segmentCrossesRect(seg, rect))
        warnings.push({ kind: 'line_rect', message: `Элемент "${seg.label}" пересекает область выреза или заплатки`, involvedIds: [seg.id, id] });
    });
  });
  for (let i = 0; i < cutoutRects.length; i++) {
    for (let j = i + 1; j < cutoutRects.length; j++) {
      if (rectsOverlap(cutoutRects[i].rect, cutoutRects[j].rect))
        warnings.push({ kind: 'rect_rect', message: 'Два выреза или заплатки пересекаются', involvedIds: [cutoutRects[i].id, cutoutRects[j].id] });
    }
  }
  return warnings;
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy window normalization
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeWindowExtras(item: WindowItem): WindowItem {
  if (item.additionalElements) return item;
  const outerTop     = getOuterTopCm(item);
  const derivedCount = deriveStrapCount(outerTop);
  const additionalElements: AdditionalElements = {
    ...createDefaultAdditionalElements(),
    straps: { count: derivedCount, isManual: false, type: 'grommet' },
  };
  logger.info('[extrasCalculations] Normalized additionalElements for legacy window', { windowId: item.id, derivedStrapCount: derivedCount });
  return { ...item, additionalElements };
}

export function normalizeAllWindowExtras(windows: WindowItem[]): WindowItem[] {
  return windows.map(normalizeWindowExtras);
}

// ─────────────────────────────────────────────────────────────────────────────
// Proportional normalization on resize
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeExtrasOnResize(current: WindowItem, prev: WindowItem): AdditionalElements {
  const extras = current.additionalElements ?? createDefaultAdditionalElements();
  if (!prev.additionalElements) return extras;

  const scaleX = current.widthTop   > 0 ? current.widthTop   / Math.max(prev.widthTop,   1) : 1;
  const scaleY = current.heightLeft > 0 ? current.heightLeft / Math.max(prev.heightLeft, 1) : 1;

  const scaleZipper  = (z: ZipperItem): ZipperItem  => ({ ...z,
    positionFromStart: z.orientation === 'horizontal' ? z.positionFromStart * scaleY : z.positionFromStart * scaleX,
    offsetStart:       z.orientation === 'horizontal' ? z.offsetStart * scaleX       : z.offsetStart * scaleY,
    offsetEnd:         z.orientation === 'horizontal' ? z.offsetEnd   * scaleX       : z.offsetEnd   * scaleY,
  });
  const scaleDivider = (d: DividerItem): DividerItem => ({ ...d,
    position:    d.orientation === 'horizontal' ? d.position    * scaleY : d.position    * scaleX,
    offsetStart: d.orientation === 'horizontal' ? d.offsetStart * scaleX : d.offsetStart * scaleY,
    offsetEnd:   d.orientation === 'horizontal' ? d.offsetEnd   * scaleX : d.offsetEnd   * scaleY,
  });
  const scaleWelding = (w: WeldingItem): WeldingItem => ({ ...w,
    position: w.orientation === 'horizontal' ? w.position * scaleY : w.position * scaleX,
  });
  const scaleCutout  = (c: CutoutItem): CutoutItem => {
    const cx  = c.x + c.width  / 2; const cy  = c.y + c.height / 2;
    const newW = c.width  * scaleX;  const newH = c.height * scaleY;
    return { ...c, x: cx * scaleX - newW / 2, y: cy * scaleY - newH / 2, width: newW, height: newH };
  };

  const outerTop     = getOuterTopCm(current);
  const derivedCount = deriveStrapCount(outerTop);
  const straps = extras.straps.isManual ? extras.straps : { ...extras.straps, count: derivedCount };

  return { ...extras, straps, zippers: extras.zippers.map(scaleZipper), dividers: extras.dividers.map(scaleDivider), welding: extras.welding.map(scaleWelding), cutouts: extras.cutouts.map(scaleCutout) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Price calculation: extras → ServiceItem[]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Читает пару retail/cost для slug из PriceMap.
 *
 * Ключи берутся из ADDON_PRICE_CONFIG — единственного источника имён ключей.
 * Если ключ отсутствует в priceMap → 9999, что активирует hasPriceError в OrderLedger.
 */
function resolveAddonPrice(
  priceMap: PriceMap,
  slug:     AddonSlug,
): { retail: number; cost: number } {
  const meta = ADDON_PRICE_CONFIG[slug];
  return {
    retail: priceMap[meta.retailKey] ?? 9999,
    cost:   priceMap[meta.costKey]   ?? 9999,
  };
}

/**
 * Конвертирует все допы одного окна в массив ServiceItem[].
 *
 * Использует тот же PriceMap, что и calculateWindowFinance — никакого
 * дублирования источника цен.
 *
 * id строки детерминирован (`${slug}-w${window.id}-${element.id}`),
 * что позволяет extractWindowServices() точно фильтровать гроссбух по окну.
 *
 * @param window    — изделие с additionalElements
 * @param priceMap  — живой прайс (Record<string, number>)
 * @param windowIdx — индекс для лейблов (опционально)
 */
export function calculateExtrasAsServiceItems(
  window:     WindowItem,
  priceMap:   PriceMap,
  windowIdx?: number,
): ServiceItem[] {
  const extras = window.additionalElements;
  if (!extras) return [];

  const items: ServiceItem[] = [];
  const lbl = window.name || `Окно ${(windowIdx ?? window.id) + 1}`;

  // ── Молнии ────────────────────────────────────────────────────────────────
  extras.zippers.forEach((z) => {
    const { retail, cost } = resolveAddonPrice(priceMap, 'zipper');
    const m = ADDON_PRICE_CONFIG.zipper;
    items.push(makeServiceItem({
      id:          `zipper-w${window.id}-${z.id}`,
      name:        `${m.nameRetail} (${lbl}, ${z.orientation === 'horizontal' ? 'горизонт.' : 'вертик.'})`,
      type:        'addon',
      quantity:    1,
      unit:        m.unit,
      retailPrice: retail,
      costPrice:   cost,
    }));
  });

  // ── Разделители ───────────────────────────────────────────────────────────
  extras.dividers.forEach((d) => {
    const { retail, cost } = resolveAddonPrice(priceMap, 'divider');
    const m = ADDON_PRICE_CONFIG.divider;
    items.push(makeServiceItem({
      id:          `divider-w${window.id}-${d.id}`,
      name:        `${m.nameRetail} (${lbl})`,
      type:        'addon',
      quantity:    1,
      unit:        m.unit,
      retailPrice: retail,
      costPrice:   cost,
    }));
  });

  // ── Вырезы / Заплатки ─────────────────────────────────────────────────────
  extras.cutouts.forEach((c) => {
    const slug: AddonSlug = c.type === 'cut' ? 'cut' : 'patch';
    const { retail, cost } = resolveAddonPrice(priceMap, slug);
    const m = ADDON_PRICE_CONFIG[slug];
    items.push(makeServiceItem({
      id:          `${slug}-w${window.id}-${c.id}`,
      name:        `${m.nameRetail} (${lbl})`,
      type:        'addon',
      quantity:    1,
      unit:        m.unit,
      retailPrice: retail,
      costPrice:   cost,
    }));
  });

  // ── Юбка ──────────────────────────────────────────────────────────────────
  if (extras.hasSkirt && extras.skirtWidth > 0) {
    const { retail, cost } = resolveAddonPrice(priceMap, 'skirt');
    const m = ADDON_PRICE_CONFIG.skirt;
    const lengthM = Math.round(getOuterBottomCm(window) / 100 * 100) / 100;
    items.push(makeServiceItem({
      id:          `skirt-w${window.id}`,
      name:        `${m.nameRetail} (${lbl})`,
      type:        'addon',
      quantity:    lengthM,
      unit:        m.unit,
      retailPrice: retail,
      costPrice:   cost,
    }));
  }

  // ── Утяжелитель ───────────────────────────────────────────────────────────
  if (extras.hasWeight) {
    const { retail, cost } = resolveAddonPrice(priceMap, 'weight');
    const m = ADDON_PRICE_CONFIG.weight;
    const lengthM = Math.round(getOuterBottomCm(window) / 100 * 100) / 100;
    items.push(makeServiceItem({
      id:          `weight-w${window.id}`,
      name:        `${m.nameRetail} (${lbl})`,
      type:        'addon',
      quantity:    lengthM,
      unit:        m.unit,
      retailPrice: retail,
      costPrice:   cost,
    }));
  }

  // ── Стяжки ────────────────────────────────────────────────────────────────
  if (extras.straps.count > 0) {
    const slug: AddonSlug = extras.straps.type === 'fastex' ? 'strap_fastex' : 'strap_grommet';
    const { retail, cost } = resolveAddonPrice(priceMap, slug);
    const m = ADDON_PRICE_CONFIG[slug];
    items.push(makeServiceItem({
      id:          `${slug}-w${window.id}`,
      name:        `${m.nameRetail} (${lbl})`,
      type:        'addon',
      quantity:    extras.straps.count,
      unit:        m.unit,
      retailPrice: retail,
      costPrice:   cost,
    }));
  }

  // ── Технологическая пайка ─────────────────────────────────────────────────
  extras.welding.forEach((w) => {
    const { retail, cost } = resolveAddonPrice(priceMap, 'welding');
    const m = ADDON_PRICE_CONFIG.welding;
    items.push(makeServiceItem({
      id:          `welding-w${window.id}-${w.id}`,
      name:        `${m.nameRetail} (${lbl})`,
      type:        'addon',
      quantity:    1,
      unit:        m.unit,
      retailPrice: retail,
      costPrice:   cost,
    }));
  });

  return items;
}