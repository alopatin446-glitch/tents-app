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
 * Проверяет, является ли окно открывающимся (сворачиваемым в рулон).
 * Ремешки фиксации НЕ нужны, если окно без креплений или закреплено наглухо.
 */
export function isWindowOpenable(item: WindowItem): boolean {
  const fasteners = item.fasteners;
  if (!fasteners) return false;

  // Без креплений или глухие люверсы 10мм -> окно не имеет функции открывания
  if (fasteners.type === 'none' || fasteners.type === 'eyelet_10') {
    return false;
  }

  // Проверяем, есть ли хотя бы одна активная расстёгивающаяся сторона
  const sides = fasteners.sides;
  if (!sides) return false;

  return (
    sides.left === true ||
    sides.right === true ||
    sides.bottom === true ||
    sides.top === true
  );
}

/**
 * Вычисляет расчетное количество ремешков с учётом открываемости окна.
 */
export function deriveStrapCountForWindow(item: WindowItem): number {
  if (!isWindowOpenable(item)) {
    return 0;
  }
  return deriveStrapCount(item.widthTop);
}
/**
 * Вычисляет количество ремешков фиксации от ВНУТРЕННЕЙ ширины изделия (widthTop, см).
 * * Таблица шага (по световому проёму):
 * 0–140 см:   2 ремешка
 * 141–210 см: 3 ремешка
 * 211–280 см: 4 ремешка
 * 281–350 см: 5 ремешков
 * >350 см:    5 + ceil((widthTop − 350) / 70)
 */
export function deriveStrapCount(widthTopCm: number): number {
  if (widthTopCm <= 140) return 2;
  if (widthTopCm <= 210) return 3;
  if (widthTopCm <= 280) return 4;
  if (widthTopCm <= 350) return 5;
  return 5 + Math.ceil((widthTopCm - 350) / 70);
}

/**
 * Возвращает внутреннюю ширину верхнего края без учёта канта.
 */
export function getOuterTopCm(item: WindowItem): number {
  return item.widthTop;
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
  errors: string[];
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

  const zippers = extras.zippers ?? [];
  const dividers = extras.dividers ?? [];
  const cutouts = extras.cutouts ?? [];
  const welding = extras.welding ?? [];

  const EDGE_EPSILON_CM = 0.01;
  const innerWidth = Math.max(item.widthTop, item.widthBottom);
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

  zippers.forEach((z, idx) => {
    const label = `Молния #${idx + 1}`;
    if (!Number.isFinite(z.positionFromStart) || z.positionFromStart < 0) errors.push(`${label}: позиция от начала обязательна и должна быть ≥ 0`);
    if (!Number.isFinite(z.offsetStart) || z.offsetStart < 0) errors.push(`${label}: отступ от начала должен быть ≥ 0`);
    if (!Number.isFinite(z.offsetEnd) || z.offsetEnd < 0) errors.push(`${label}: отступ от конца должен быть ≥ 0`);
    if (!Number.isFinite(z.bandLeft) || z.bandLeft < 0) errors.push(`${label}: левая полоса должна быть ≥ 0`);
    if (!Number.isFinite(z.bandRight) || z.bandRight < 0) errors.push(`${label}: правая полоса должна быть ≥ 0`);
  });

  dividers.forEach((d, idx) => {
    const label = `Разделитель #${idx + 1}`;
    if (!Number.isFinite(d.position) || d.position < 0) errors.push(`${label}: позиция обязательна и должна быть ≥ 0`);
    if (!Number.isFinite(d.offsetStart) || d.offsetStart < 0) errors.push(`${label}: отступ от начала должен быть ≥ 0`);
    if (!Number.isFinite(d.offsetEnd) || d.offsetEnd < 0) errors.push(`${label}: отступ от конца должен быть ≥ 0`);
    if (!Number.isFinite(d.width) || d.width <= 0) errors.push(`${label}: ширина обязательна и должна быть больше 0`);
  });

  cutouts.forEach((c, idx) => {
    const label = `${c.type === 'cut' ? 'Вырез' : 'Заплатка'} #${idx + 1}`;
    if (!Number.isFinite(c.x) || c.x < 0) errors.push(`${label}: координата X обязательна и должна быть ≥ 0`);
    if (!Number.isFinite(c.y) || c.y < 0) errors.push(`${label}: координата Y обязательна и должна быть ≥ 0`);
    if (!Number.isFinite(c.width) || c.width <= 0) errors.push(`${label}: ширина обязательна и должна быть больше 0`);
    if (!Number.isFinite(c.height) || c.height <= 0) errors.push(`${label}: высота обязательна и должна быть больше 0`);

    const valid = Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.width) && Number.isFinite(c.height)
      && c.x >= 0 && c.y >= 0 && c.width > 0 && c.height > 0;
    if (!valid) return;

    const touchesLeft = Math.abs(c.x) <= EDGE_EPSILON_CM;
    const touchesTop = Math.abs(c.y) <= EDGE_EPSILON_CM;
    const touchesRight = Math.abs(c.x + c.width - innerWidth) <= EDGE_EPSILON_CM;
    const touchesBottom = Math.abs(c.y + c.height - innerHeight) <= EDGE_EPSILON_CM;
    if (!touchesLeft && !touchesTop && !touchesRight && !touchesBottom) {
      errors.push(`${label}: должен примыкать к краю изделия`);
    }
  });

  welding.forEach((w, idx) => {
    if (!Number.isFinite(w.position) || w.position < 0)
      errors.push(`Сварка #${idx + 1}: позиция обязательна и должна быть ≥ 0`);
  });

  // ── CORE-3C: MOSQUITO — запрещённые допы ─────────────────────────────────
  if (item.material === 'MOSQUITO') {
    if (extras.welding.length > 0) {
      errors.push('Москитная сетка: техпайка (сварка) недоступна для этого материала');
    }
    if (extras.dividers.length > 0) {
      errors.push('Москитная сетка: разделитель через кант недоступен для этого материала');
    }
  }

  if (item.isTrapezoid) {
    const hasAnyExtras =
      extras.zippers.length > 0 || extras.dividers.length > 0 ||
      extras.cutouts.length > 0 || extras.welding.length > 0;
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
  kind: CollisionKind;
  message: string;
  involvedIds: string[];
}

interface Rect { x: number; y: number; width: number; height: number; }
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
    : { id: z.id, label: 'zipper', orientation: 'vertical', position: z.positionFromStart, start: z.offsetStart, end: maxH - z.offsetEnd };
}
function dividerToSegment(d: DividerItem, maxH: number, maxW: number): Segment {
  return d.orientation === 'horizontal'
    ? { id: d.id, label: 'divider', orientation: 'horizontal', position: d.position, start: d.offsetStart, end: maxW - d.offsetEnd }
    : { id: d.id, label: 'divider', orientation: 'vertical', position: d.position, start: d.offsetStart, end: maxH - d.offsetEnd };
}
function weldingToSegment(w: WeldingItem, maxH: number, maxW: number): Segment {
  return w.orientation === 'horizontal'
    ? { id: w.id, label: 'welding', orientation: 'horizontal', position: w.position, start: 0, end: maxW }
    : { id: w.id, label: 'welding', orientation: 'vertical', position: w.position, start: 0, end: maxH };
}

export function detectExtrasCollisions(item: WindowItem): CollisionWarning[] {
  const extras = item.additionalElements;
  if (!extras) return [];

  const warnings: CollisionWarning[] = [];

  const zippers = extras.zippers ?? [];
  const dividers = extras.dividers ?? [];
  const cutouts = extras.cutouts ?? [];
  const welding = extras.welding ?? [];

  const maxW = item.widthTop;
  const maxH = item.heightLeft;

  zippers.forEach((z) => {
    const dim = z.orientation === 'horizontal' ? maxH : maxW;
    if (z.positionFromStart < 0 || z.positionFromStart > dim)
      warnings.push({ kind: 'out_of_bounds', message: `Молния "${z.id}" выходит за границы изделия`, involvedIds: [z.id] });
  });
  dividers.forEach((d) => {
    const dim = d.orientation === 'horizontal' ? maxH : maxW;
    if (d.position < 0 || d.position > dim)
      warnings.push({ kind: 'out_of_bounds', message: `Разделитель "${d.id}" выходит за границы изделия`, involvedIds: [d.id] });
  });
  welding.forEach((w) => {
    const dim = w.orientation === 'horizontal' ? maxH : maxW;
    if (w.position < 0 || w.position > dim)
      warnings.push({ kind: 'out_of_bounds', message: `Техпайка "${w.id}" выходит за границы изделия`, involvedIds: [w.id] });
  });
  cutouts.forEach((c) => {
    if (c.x < 0 || c.y < 0 || c.x + c.width > maxW || c.y + c.height > maxH)
      warnings.push({ kind: 'out_of_bounds', message: `${c.type === 'cut' ? 'Вырез' : 'Заплатка'} "${c.id}" выходит за границы изделия`, involvedIds: [c.id] });
  });

  const allSegments: Segment[] = [
    ...zippers.map((z) => zipperToSegment(z, maxH, maxW)),
    ...dividers.map((d) => dividerToSegment(d, maxH, maxW)),
    ...welding.map((w) => weldingToSegment(w, maxH, maxW)),
  ];
  for (let i = 0; i < allSegments.length; i++) {
    for (let j = i + 1; j < allSegments.length; j++) {
      const a = allSegments[i]; const b = allSegments[j];
      if (segmentsOverlap(a, b)) {
        warnings.push({ kind: Math.abs(a.position - b.position) < 2 ? 'duplicate' : 'line_line', message: `Элементы "${a.label}" и "${b.label}" перекрываются или расположены слишком близко`, involvedIds: [a.id, b.id] });
      }
    }
  }
  const cutoutRects = cutouts.map((c) => ({ id: c.id, rect: { x: c.x, y: c.y, width: c.width, height: c.height } }));
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

// ─────────────────────────────────────────────────────────────────────────────
// Legacy window normalization
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Legacy window normalization
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeWindowExtras(item: WindowItem): WindowItem {
  const derivedCount = deriveStrapCountForWindow(item);

  if (item.additionalElements) {
    if (!item.additionalElements.straps.isManual) {
      if (item.additionalElements.straps.count !== derivedCount) {
        return {
          ...item,
          additionalElements: {
            ...item.additionalElements,
            straps: {
              ...item.additionalElements.straps,
              count: derivedCount
            }
          }
        };
      }
    }
    return item;
  }

  const additionalElements: AdditionalElements = {
    ...createDefaultAdditionalElements(),
    straps: { count: derivedCount, isManual: false, type: 'grommet' },
  };
  logger.info('[extrasCalculations] Normalized additionalElements', { windowId: item.id, derivedStrapCount: derivedCount });
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

  const scaleX = current.widthTop > 0 ? current.widthTop / Math.max(prev.widthTop, 1) : 1;
  const scaleY = current.heightLeft > 0 ? current.heightLeft / Math.max(prev.heightLeft, 1) : 1;

  const scaleZipper = (z: ZipperItem): ZipperItem => ({
    ...z,
    positionFromStart: z.orientation === 'horizontal' ? z.positionFromStart * scaleY : z.positionFromStart * scaleX,
    offsetStart: z.orientation === 'horizontal' ? z.offsetStart * scaleX : z.offsetStart * scaleY,
    offsetEnd: z.orientation === 'horizontal' ? z.offsetEnd * scaleX : z.offsetEnd * scaleY,
  });
  const scaleDivider = (d: DividerItem): DividerItem => ({
    ...d,
    position: d.orientation === 'horizontal' ? d.position * scaleY : d.position * scaleX,
    offsetStart: d.orientation === 'horizontal' ? d.offsetStart * scaleX : d.offsetStart * scaleY,
    offsetEnd: d.orientation === 'horizontal' ? d.offsetEnd * scaleX : d.offsetEnd * scaleY,
  });
  const scaleWelding = (w: WeldingItem): WeldingItem => ({
    ...w,
    position: w.orientation === 'horizontal' ? w.position * scaleY : w.position * scaleX,
  });
  const scaleCutout = (c: CutoutItem): CutoutItem => {
    const cx = c.x + c.width / 2; const cy = c.y + c.height / 2;
    const newW = c.width * scaleX; const newH = c.height * scaleY;
    return { ...c, x: cx * scaleX - newW / 2, y: cy * scaleY - newH / 2, width: newW, height: newH };
  };

  const derivedCount = deriveStrapCountForWindow(current);
  const straps = extras.straps.isManual ? extras.straps : { ...extras.straps, count: derivedCount };

  return { ...extras, straps, zippers: extras.zippers.map(scaleZipper), dividers: extras.dividers.map(scaleDivider), welding: extras.welding.map(scaleWelding), cutouts: extras.cutouts.map(scaleCutout) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Price calculation: extras → ServiceItem[]
// ─────────────────────────────────────────────────────────────────────────────

function resolveAddonPrice(
  priceMap: PriceMap,
  slug: AddonSlug,
): { retail: number; cost: number } {
  const meta = ADDON_PRICE_CONFIG[slug];
  return {
    retail: priceMap[meta.retailKey] ?? 9999,
    cost: priceMap[meta.costKey] ?? 9999,
  };
}

export function calculateExtrasAsServiceItems(
  window: WindowItem,
  priceMap: PriceMap,
  windowIdx?: number,
): ServiceItem[] {
  const extras = window.additionalElements;
  if (!extras) return [];

  const items: ServiceItem[] = [];
  const lbl = window.name || `Окно ${(windowIdx ?? window.id) + 1}`;

  // ── Safe guards — защита от undefined в legacy-записях ──────────────────
  const zippers = extras.zippers ?? [];
  const dividers = extras.dividers ?? [];
  const cutouts = extras.cutouts ?? [];
  const welding = extras.welding ?? [];

  // 🔥 Берем живой расчёт с учётом типа крепления
  const strapsCount = extras.straps?.isManual
    ? (extras.straps?.count ?? 0)
    : deriveStrapCountForWindow(window);
  const strapsType = extras.straps?.type ?? 'grommet';

  // ── Молнии ────────────────────────────────────────────────────────────────
  const outerWidthCm = Math.max(window.widthTop, window.widthBottom) + window.kantLeft + window.kantRight;
  const outerHeightCm = Math.max(window.heightLeft, window.heightRight) + window.kantTop + window.kantBottom;
  const zipperCostPerMeter = priceMap['addo_zipper_cost_per_meter'] ?? 250;

  zippers.forEach((z) => {
    const { retail } = resolveAddonPrice(priceMap, 'zipper');
    const m = ADDON_PRICE_CONFIG.zipper;
    const outerLenM = (z.orientation === 'vertical' ? outerHeightCm : outerWidthCm) / 100;
    const zipperMaterialCost = Math.round(outerLenM * zipperCostPerMeter);
    items.push(makeServiceItem({
      id: `zipper-w${window.id}-${z.id}`,
      name: `${m.nameRetail} (${lbl}, ${z.orientation === 'horizontal' ? 'горизонт.' : 'вертик.'})`,
      type: 'addon',
      quantity: 1,
      unit: m.unit,
      retailPrice: retail,
      costPrice: zipperMaterialCost,
    }));
  });

  // ── Разделители ───────────────────────────────────────────────────────────
  dividers.forEach((d) => {
    const { retail, cost } = resolveAddonPrice(priceMap, 'divider');
    const m = ADDON_PRICE_CONFIG.divider;
    items.push(makeServiceItem({
      id: `divider-w${window.id}-${d.id}`,
      name: `${m.nameRetail} (${lbl})`,
      type: 'addon',
      quantity: 1,
      unit: m.unit,
      retailPrice: retail,
      costPrice: cost,
    }));
  });

  // ── Вырезы / Заплатки ─────────────────────────────────────────────────────
  cutouts.forEach((c) => {
    const slug: AddonSlug = c.type === 'cut' ? 'cut' : 'patch';
    const { retail, cost } = resolveAddonPrice(priceMap, slug);
    const m = ADDON_PRICE_CONFIG[slug];
    items.push(makeServiceItem({
      id: `${slug}-w${window.id}-${c.id}`,
      name: `${m.nameRetail} (${lbl})`,
      type: 'addon',
      quantity: 1,
      unit: m.unit,
      retailPrice: retail,
      costPrice: cost,
    }));
  });

  // ── Юбка ──────────────────────────────────────────────────────────────────
  if (extras.hasSkirt && extras.skirtWidth > 0) {
    const { retail, cost } = resolveAddonPrice(priceMap, 'skirt');
    const m = ADDON_PRICE_CONFIG.skirt;
    const lengthM = Math.round(getOuterBottomCm(window) / 100 * 100) / 100;
    items.push(makeServiceItem({
      id: `skirt-w${window.id}`,
      name: `${m.nameRetail} (${lbl})`,
      type: 'addon',
      quantity: lengthM,
      unit: m.unit,
      retailPrice: retail,
      costPrice: cost,
    }));
  }

  // ── Утяжелитель ───────────────────────────────────────────────────────────
  if (extras.hasWeight) {
    const { retail, cost } = resolveAddonPrice(priceMap, 'weight');
    const m = ADDON_PRICE_CONFIG.weight;
    const lengthM = Math.round(getOuterBottomCm(window) / 100 * 100) / 100;
    items.push(makeServiceItem({
      id: `weight-w${window.id}`,
      name: `${m.nameRetail} (${lbl})`,
      type: 'addon',
      quantity: lengthM,
      unit: m.unit,
      retailPrice: retail,
      costPrice: cost,
    }));
  }

  // ── Стяжки ────────────────────────────────────────────────────────────────
  if (strapsCount > 0) {
    const slug: AddonSlug = strapsType === 'fastex' ? 'strap_fastex' : 'strap_grommet';
    const { retail, cost } = resolveAddonPrice(priceMap, slug);
    const m = ADDON_PRICE_CONFIG[slug];
    items.push(makeServiceItem({
      id: `${slug}-w${window.id}`,
      name: `${m.nameRetail} (${lbl})`,
      type: 'addon',
      quantity: strapsCount,
      unit: m.unit,
      retailPrice: retail,
      costPrice: cost,
    }));
  }

  // ── Технологическая пайка ─────────────────────────────────────────────────
  welding.forEach((w) => {
    const { retail, cost } = resolveAddonPrice(priceMap, 'welding');
    const m = ADDON_PRICE_CONFIG.welding;
    items.push(makeServiceItem({
      id: `welding-w${window.id}-${w.id}`,
      name: `${m.nameRetail} (${lbl})`,
      type: 'addon',
      quantity: 1,
      unit: m.unit,
      retailPrice: retail,
      costPrice: cost,
    }));
  });

  return items;
}