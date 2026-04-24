/**
 * SSOT — Extras logic
 *
 * Covers:
 *   - Strap count derivation from outer top horizontal
 *   - Extras validation (blocking rules)
 *   - Collision / out-of-bounds detection (warning rules)
 *   - Legacy window normalization (additionalElements hydration)
 *   - Proportional normalization on resize
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

  // ── Skirt ──────────────────────────────────────────────────────────────────
  if (extras.hasSkirt && extras.skirtWidth <= 0) {
    errors.push('Skirt is enabled but skirtWidth is missing or zero');
  }

  // ── Weight ────────────────────────────────────────────────────────────────
  if (extras.hasWeight) {
    const outerBottomM = getOuterBottomCm(item) / 100;
    if (outerBottomM > 6) {
      errors.push(
        `Weight bar: outer bottom ${outerBottomM.toFixed(2)} m exceeds the 6 m limit`,
      );
    }
  }

  // ── Zippers ───────────────────────────────────────────────────────────────
  extras.zippers.forEach((z, idx) => {
    const label = `Zipper #${idx + 1}`;
    if (!Number.isFinite(z.positionFromStart) || z.positionFromStart < 0)
      errors.push(`${label}: positionFromStart is required and must be >= 0`);
    if (!Number.isFinite(z.offsetStart) || z.offsetStart < 0)
      errors.push(`${label}: offsetStart must be >= 0`);
    if (!Number.isFinite(z.offsetEnd) || z.offsetEnd < 0)
      errors.push(`${label}: offsetEnd must be >= 0`);
    if (!Number.isFinite(z.bandLeft) || z.bandLeft < 0)
      errors.push(`${label}: bandLeft must be >= 0`);
    if (!Number.isFinite(z.bandRight) || z.bandRight < 0)
      errors.push(`${label}: bandRight must be >= 0`);
  });

  // ── Dividers ──────────────────────────────────────────────────────────────
  extras.dividers.forEach((d, idx) => {
    const label = `Divider #${idx + 1}`;
    if (!Number.isFinite(d.position) || d.position < 0)
      errors.push(`${label}: position is required and must be >= 0`);
    if (!Number.isFinite(d.offsetStart) || d.offsetStart < 0)
      errors.push(`${label}: offsetStart must be >= 0`);
    if (!Number.isFinite(d.offsetEnd) || d.offsetEnd < 0)
      errors.push(`${label}: offsetEnd must be >= 0`);
    if (!Number.isFinite(d.width) || d.width <= 0)
      errors.push(`${label}: width is required and must be > 0`);
  });

  // ── Cutouts & Patches ─────────────────────────────────────────────────────
  extras.cutouts.forEach((c, idx) => {
    const label = `${c.type === 'cut' ? 'Cutout' : 'Patch'} #${idx + 1}`;
    if (!Number.isFinite(c.x) || c.x < 0)
      errors.push(`${label}: x is required and must be >= 0`);
    if (!Number.isFinite(c.y) || c.y < 0)
      errors.push(`${label}: y is required and must be >= 0`);
    if (!Number.isFinite(c.width) || c.width <= 0)
      errors.push(`${label}: width is required and must be > 0`);
    if (!Number.isFinite(c.height) || c.height <= 0)
      errors.push(`${label}: height is required and must be > 0`);
  });

  // ── Welding ───────────────────────────────────────────────────────────────
  extras.welding.forEach((w, idx) => {
    const label = `Welding #${idx + 1}`;
    if (!Number.isFinite(w.position) || w.position < 0)
      errors.push(`${label}: position is required and must be >= 0`);
  });

  // ── Trapezoid required fields ─────────────────────────────────────────────
  if (item.isTrapezoid) {
    const hasAnyExtras =
      extras.zippers.length > 0 ||
      extras.dividers.length > 0 ||
      extras.cutouts.length > 0 ||
      extras.welding.length > 0;
    if (hasAnyExtras) {
      // diagonalLeft / diagonalRight are needed for exact trapezoid rendering
      if (!item.diagonalLeft && !item.diagonalRight) {
        errors.push(
          'Trapezoid: diagonalLeft or diagonalRight is required for extras rendering',
        );
      }
    }
  }

  if (errors.length > 0) {
    logger.warn('[extrasCalculations] Validation blocked', {
      windowId: item.id,
      errors,
    });
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
  /** IDs of the elements involved */
  involvedIds: string[];
}

/** AABB rectangle in window space (cm). */
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Axis-aligned segment in window space (cm). */
interface Segment {
  /** start X for vertical, Y position for horizontal */
  position: number;
  /** start offset (left/top) */
  start: number;
  /** end offset (right/bottom) */
  end: number;
  orientation: 'horizontal' | 'vertical';
  id: string;
  label: string;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function segmentsOverlap(a: Segment, b: Segment): boolean {
  if (a.orientation !== b.orientation) return false;
  // Same orientation: check if they are on the same axis and overlap in extent
  const POS_THRESHOLD = 2; // cm — near-duplicate threshold
  if (Math.abs(a.position - b.position) > POS_THRESHOLD) return false;
  // Check range overlap
  return a.start < b.end && b.start < a.end;
}

function segmentCrossesRect(seg: Segment, rect: Rect): boolean {
  if (seg.orientation === 'horizontal') {
    // Segment: y = seg.position, x in [seg.start, seg.end]
    const segY = seg.position;
    if (segY < rect.y || segY > rect.y + rect.height) return false;
    return seg.start < rect.x + rect.width && seg.end > rect.x;
  } else {
    // Segment: x = seg.position, y in [seg.start, seg.end]
    const segX = seg.position;
    if (segX < rect.x || segX > rect.x + rect.width) return false;
    return seg.start < rect.y + rect.height && seg.end > rect.y;
  }
}

function zipperToSegment(z: ZipperItem, maxH: number, maxW: number): Segment {
  if (z.orientation === 'horizontal') {
    return {
      id: z.id,
      label: 'zipper',
      orientation: 'horizontal',
      position: z.positionFromStart,
      start: z.offsetStart,
      end: maxW - z.offsetEnd,
    };
  }
  return {
    id: z.id,
    label: 'zipper',
    orientation: 'vertical',
    position: z.positionFromStart,
    start: z.offsetStart,
    end: maxH - z.offsetEnd,
  };
}

function dividerToSegment(d: DividerItem, maxH: number, maxW: number): Segment {
  if (d.orientation === 'horizontal') {
    return {
      id: d.id,
      label: 'divider',
      orientation: 'horizontal',
      position: d.position,
      start: d.offsetStart,
      end: maxW - d.offsetEnd,
    };
  }
  return {
    id: d.id,
    label: 'divider',
    orientation: 'vertical',
    position: d.position,
    start: d.offsetStart,
    end: maxH - d.offsetEnd,
  };
}

function weldingToSegment(w: WeldingItem, maxH: number, maxW: number): Segment {
  if (w.orientation === 'horizontal') {
    return { id: w.id, label: 'welding', orientation: 'horizontal', position: w.position, start: 0, end: maxW };
  }
  return { id: w.id, label: 'welding', orientation: 'vertical', position: w.position, start: 0, end: maxH };
}

/**
 * Detects collisions and out-of-bounds conditions for all extras.
 * Returns warnings (non-blocking); the extras are still rendered.
 */
export function detectExtrasCollisions(item: WindowItem): CollisionWarning[] {
  const extras = item.additionalElements;
  if (!extras) return [];

  const warnings: CollisionWarning[] = [];
  const maxW = item.widthTop;
  const maxH = item.heightLeft;

  // ── Out-of-bounds ─────────────────────────────────────────────────────────
  extras.zippers.forEach((z) => {
    const dim = z.orientation === 'horizontal' ? maxH : maxW;
    if (z.positionFromStart < 0 || z.positionFromStart > dim) {
      warnings.push({ kind: 'out_of_bounds', message: `Zipper "${z.id}" is out of bounds`, involvedIds: [z.id] });
    }
  });
  extras.dividers.forEach((d) => {
    const dim = d.orientation === 'horizontal' ? maxH : maxW;
    if (d.position < 0 || d.position > dim) {
      warnings.push({ kind: 'out_of_bounds', message: `Divider "${d.id}" is out of bounds`, involvedIds: [d.id] });
    }
  });
  extras.welding.forEach((w) => {
    const dim = w.orientation === 'horizontal' ? maxH : maxW;
    if (w.position < 0 || w.position > dim) {
      warnings.push({ kind: 'out_of_bounds', message: `Welding "${w.id}" is out of bounds`, involvedIds: [w.id] });
    }
  });
  extras.cutouts.forEach((c) => {
    if (c.x < 0 || c.y < 0 || c.x + c.width > maxW || c.y + c.height > maxH) {
      warnings.push({ kind: 'out_of_bounds', message: `${c.type === 'cut' ? 'Cutout' : 'Patch'} "${c.id}" is out of bounds`, involvedIds: [c.id] });
    }
  });

  // ── Build segment lists ───────────────────────────────────────────────────
  const allSegments: Segment[] = [
    ...extras.zippers.map((z) => zipperToSegment(z, maxH, maxW)),
    ...extras.dividers.map((d) => dividerToSegment(d, maxH, maxW)),
    ...extras.welding.map((w) => weldingToSegment(w, maxH, maxW)),
  ];

  // ── Line-line overlaps ────────────────────────────────────────────────────
  for (let i = 0; i < allSegments.length; i++) {
    for (let j = i + 1; j < allSegments.length; j++) {
      const a = allSegments[i];
      const b = allSegments[j];
      if (segmentsOverlap(a, b)) {
        const kind: CollisionKind =
          Math.abs(
            (a.orientation === 'horizontal' ? (allSegments[i] as Segment).position : (allSegments[i] as Segment).position) -
            (b.orientation === 'horizontal' ? (allSegments[j] as Segment).position : (allSegments[j] as Segment).position),
          ) < 2
            ? 'duplicate'
            : 'line_line';
        warnings.push({
          kind,
          message: `${a.label} and ${b.label} overlap or are too close`,
          involvedIds: [a.id, b.id],
        });
      }
    }
  }

  // ── Line-rect (segment crosses cutout) ───────────────────────────────────
  const cutoutRects: Array<{ rect: Rect; id: string }> = extras.cutouts.map((c) => ({
    id: c.id,
    rect: { x: c.x, y: c.y, width: c.width, height: c.height },
  }));
  allSegments.forEach((seg) => {
    cutoutRects.forEach(({ rect, id }) => {
      if (segmentCrossesRect(seg, rect)) {
        warnings.push({
          kind: 'line_rect',
          message: `${seg.label} intersects a cutout/patch area`,
          involvedIds: [seg.id, id],
        });
      }
    });
  });

  // ── Rect-rect (cutout overlaps cutout) ───────────────────────────────────
  for (let i = 0; i < cutoutRects.length; i++) {
    for (let j = i + 1; j < cutoutRects.length; j++) {
      if (rectsOverlap(cutoutRects[i].rect, cutoutRects[j].rect)) {
        warnings.push({
          kind: 'rect_rect',
          message: 'Two cutout/patch areas overlap',
          involvedIds: [cutoutRects[i].id, cutoutRects[j].id],
        });
      }
    }
  }

  return warnings;
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy window normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ensures `additionalElements` is always fully initialized on a WindowItem.
 * Safe to call on both legacy and new items — idempotent for new items.
 */
export function normalizeWindowExtras(item: WindowItem): WindowItem {
  if (item.additionalElements) return item;

  const outerTop = getOuterTopCm(item);
  const derivedCount = deriveStrapCount(outerTop);

  const additionalElements: AdditionalElements = {
    ...createDefaultAdditionalElements(),
    straps: { count: derivedCount, isManual: false, type: 'grommet' },
  };

  logger.info('[extrasCalculations] Normalized additionalElements for legacy window', {
    windowId: item.id,
    derivedStrapCount: derivedCount,
  });

  return { ...item, additionalElements };
}

/**
 * Normalizes all windows in a list, ensuring additionalElements is present.
 */
export function normalizeAllWindowExtras(windows: WindowItem[]): WindowItem[] {
  return windows.map(normalizeWindowExtras);
}

// ─────────────────────────────────────────────────────────────────────────────
// Proportional normalization on resize
// ─────────────────────────────────────────────────────────────────────────────

/**
 * When a window is resized, normalizes linear extras proportionally.
 * Center-logic elements (cutouts with x/y) have their center preserved
 * as a fraction of the window dimensions.
 *
 * Called after ItemsStep saves new dimensions.
 */
export function normalizeExtrasOnResize(
  current: WindowItem,
  prev: WindowItem,
): AdditionalElements {
  const extras = current.additionalElements ?? createDefaultAdditionalElements();
  if (!prev.additionalElements) return extras;

  const scaleX = current.widthTop > 0 ? current.widthTop / Math.max(prev.widthTop, 1) : 1;
  const scaleY = current.heightLeft > 0 ? current.heightLeft / Math.max(prev.heightLeft, 1) : 1;

  const scaleZipper = (z: ZipperItem): ZipperItem => ({
    ...z,
    positionFromStart: z.orientation === 'horizontal'
      ? z.positionFromStart * scaleY
      : z.positionFromStart * scaleX,
    offsetStart: z.orientation === 'horizontal'
      ? z.offsetStart * scaleX
      : z.offsetStart * scaleY,
    offsetEnd: z.orientation === 'horizontal'
      ? z.offsetEnd * scaleX
      : z.offsetEnd * scaleY,
  });

  const scaleDivider = (d: DividerItem): DividerItem => ({
    ...d,
    position: d.orientation === 'horizontal'
      ? d.position * scaleY
      : d.position * scaleX,
    offsetStart: d.orientation === 'horizontal'
      ? d.offsetStart * scaleX
      : d.offsetStart * scaleY,
    offsetEnd: d.orientation === 'horizontal'
      ? d.offsetEnd * scaleX
      : d.offsetEnd * scaleY,
  });

  const scaleWelding = (w: WeldingItem): WeldingItem => ({
    ...w,
    position: w.orientation === 'horizontal'
      ? w.position * scaleY
      : w.position * scaleX,
  });

  const scaleCutout = (c: CutoutItem): CutoutItem => {
    // Preserve center fraction
    const cx = c.x + c.width / 2;
    const cy = c.y + c.height / 2;
    const newCx = cx * scaleX;
    const newCy = cy * scaleY;
    const newW = c.width * scaleX;
    const newH = c.height * scaleY;
    return { ...c, x: newCx - newW / 2, y: newCy - newH / 2, width: newW, height: newH };
  };

  // Re-derive strap count if not manual
  const outerTop = getOuterTopCm(current);
  const derivedCount = deriveStrapCount(outerTop);
  const straps = extras.straps.isManual
    ? extras.straps
    : { ...extras.straps, count: derivedCount };

  return {
    ...extras,
    straps,
    zippers: extras.zippers.map(scaleZipper),
    dividers: extras.dividers.map(scaleDivider),
    welding: extras.welding.map(scaleWelding),
    cutouts: extras.cutouts.map(scaleCutout),
  };
}