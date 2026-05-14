/**
 * materialOptimization/buildMaterialElements.ts
 *
 * Converts WindowItem[] into FilmElement[] for the optimizer pipeline.
 *
 * FOUNDATION VERSION:
 *   Produces ONE FilmElement per WindowItem — single_piece strategy.
 *   All edges are 'external' (no topology-aware seam assignment yet).
 *   No auto-splits. No divider/zipper topology inference.
 *
 * CHAPTER B (topology-aware splits):
 *   Will inspect additionalElements (dividers, zippers, welding),
 *   determine physical material topology, and produce multiple elements
 *   per window when a split strategy is explicitly valid.
 *
 * INVARIANTS:
 *   — Deterministic: same WindowItem → same FilmElement.
 *   — No side effects.
 *   — No DB reads/writes.
 *   — No financial mutations.
 *
 * @module src/lib/logic/materialOptimization/buildMaterialElements.ts
 */

import type { WindowItem } from '@/types';
import { SEAM_OVERLAP_CM } from './types';
import type { FilmElement, EdgeSpec, OrientationConstraint } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeExternalEdge(): EdgeSpec {
  return { type: 'external', allowance: SEAM_OVERLAP_CM };
}

function elementId(windowId: number, n: number): string {
  return `${windowId}_el${n}`;
}

/**
 * Determines orientation constraint for a film element.
 *
 * Foundation: all single_piece elements without seam edges can_rotate.
 * The optimizer (generateCandidateVariants) will try rotation only when
 * material allows it (MOSQUITO can rotate; PVC/TPU/TINTED can rotate
 * for single-piece elements since there are no seam-direction constraints).
 *
 * Chapter B: split_part elements with seam_welding edges will use fixed_normal
 * because the weld seam must run along the roll direction.
 */
function resolveOrientationConstraint(_material: string): OrientationConstraint {
  // Foundation: single_piece elements have no seam constraints → can_rotate.
  // Chapter B: override to 'fixed_normal' for elements with seam_welding edges.
  return 'can_rotate';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds FilmElement[] for a single WindowItem.
 *
 * Foundation version: returns exactly one element — the full bounding box.
 * physW = max(widthTop, widthBottom)
 * physH = max(heightLeft, heightRight)
 * All edges = external, allowance = SEAM_OVERLAP_CM (3 cm each side).
 *
 * This matches the existing calculateWindowGeometry behaviour:
 *   cutW = physW + SOLDER_ALLOWANCE (6 = 3+3)
 *   cutH = physH + SOLDER_ALLOWANCE (6 = 3+3)
 *
 * Oversized elements (cutW > maxRoll) are not split here.
 * They are flagged with isOverSize=true in generateCandidateVariants
 * and produce an ELEMENT_OVERSIZE warning in the result.
 */
export function buildMaterialElements(item: WindowItem): FilmElement[] {
  const material = item.material || 'PVC_700';

  // Bounding box (физические размеры без припуска)
  const physW = Math.max(Number(item.widthTop), Number(item.widthBottom));
  const physH = Math.max(Number(item.heightLeft), Number(item.heightRight));

  const edgeLeft   = makeExternalEdge();
  const edgeRight  = makeExternalEdge();
  const edgeTop    = makeExternalEdge();
  const edgeBottom = makeExternalEdge();

  const cutW = physW + edgeLeft.allowance + edgeRight.allowance;
  const cutH = physH + edgeTop.allowance  + edgeBottom.allowance;

  const element: FilmElement = {
    id:       elementId(item.id, 0),
    windowId: item.id,

    physW,
    physH,

    edgeLeft,
    edgeRight,
    edgeTop,
    edgeBottom,

    cutW,
    cutH,

    material,
    orientationConstraint: resolveOrientationConstraint(material),

    strategyType: 'single_piece',
    originType:   'window_body',
  };

  return [element];
}

/**
 * Builds FilmElement[] for all windows in an order.
 * Order of elements matches order of windows (deterministic).
 */
export function buildAllMaterialElements(windows: WindowItem[]): FilmElement[] {
  return windows.flatMap(w => buildMaterialElements(w));
}
