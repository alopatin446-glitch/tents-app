/**
 * materialOptimization/buildSharedLayouts.ts
 *
 * Chapter D: order-level grouped layout builder.
 *
 * PURPOSE:
 *   Determines whether FilmElements sharing the same material can be cut
 *   side-by-side from one roll strip — a "shared layout" — reducing waste
 *   compared to individual roll assignments.
 *
 * ROLE IN PIPELINE:
 *   Called by generateCandidateVariants to build v2_grouped_shared_row.
 *   NOT called for v1_single_piece_all — that variant is unchanged.
 *   Output is CANDIDATE VARIANT metadata only. No ERP allocation. No DB writes.
 *   No changes to totalExpenses, totalPrice, or any snapshot.
 *
 * ALGORITHM — First-Fit Decreasing (FFD) bin packing:
 *
 *   1. Build atomic "packing units": sole_element → [element];
 *      sibling cluster → [sib1, sib2, ...] ordered by sectionIndex.
 *   2. Sort units by total placedWidth DESC (widest first).
 *   3. For each unit, try to add to the first existing bin where it fits
 *      (bin.totalWidth + unit.width ≤ rollWidth). No bin fits → open new bin.
 *   4. Bins with ≥ 2 film elements → SharedLayout.
 *      Bins with 1 element → individual.
 *      Units too wide for the roll even alone → individual.
 *
 *   WHY FFD OVER SIMPLE GREEDY:
 *   A naive while-loop starting from "all remaining unused" fails on cases like
 *   A(200)+B(100)+C(80) on rollWidth=200 — iterations for B and C still include
 *   A in their candidate set, preventing B+C=180 from forming a valid group.
 *   FFD bin-packing places each unit independently into available bins, so
 *   B(100) and C(80) correctly land in the same bin while A stays alone.
 *
 *   Example:
 *     A(200cm), B(100cm), C(80cm) on rollWidth=200
 *     FFD: A → bin[0]{200}  (no room for anyone)
 *          B → bin[1]{100}
 *          C → bin[1]{180 ≤ 200} ✓
 *     Result: SharedLayout[B,C], individual[A]
 *
 * ORIENTATION RULES:
 *   fixed_normal → placedWidth = cutW, placedLength = cutH. No rotation.
 *   can_rotate   → prefer smaller placedWidth. Tie-break: prefer non-rotated.
 *
 * WIDTH CHECK:
 *   No SMART_TOLERANCE applied here. Shared layout widths must strictly fit:
 *   sum(placedWidths) ≤ rollWidth (raw comparison).
 *   SMART_TOLERANCE is only for individual roll fitting in fitElementToRoll.
 *
 * SIBLING INTEGRITY:
 *   Elements sharing splitGroupId are treated as ONE atomic packing unit.
 *   If the cluster's total width > rollWidth → all its elements are individual.
 *   Siblings are NEVER split across different SharedLayouts.
 *
 * INVARIANTS:
 *   — Deterministic: same elements → same SharedLayouts.
 *   — Pure function: no side effects, no DB access, no module state.
 *   — Every SharedLayout.explanation is populated (no silent grouping).
 *   — SharedLayout.layoutWidthUsed ≤ rollWidth always guaranteed.
 *   — v1_single_piece_all is never called here. Isolation is total.
 *
 * @chapter-d
 * @module src/lib/logic/materialOptimization/buildSharedLayouts.ts
 */

import { ROLL_WIDTHS } from '@/lib/logic/windowCalculations';
import type { FilmElement, SharedLayout, ElementPlacement } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Internal types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atomic packing unit: one or more FilmElements that must stay together.
 * Singleton = [sole_element]. Cluster = [sib0, sib1, ...] (sectionIndex order).
 */
type PackingUnit = FilmElement[];

/** Resolved orientation for one element within a shared layout. */
interface ResolvedElement {
  element:      FilmElement;
  placedWidth:  number;   // cm — dimension placed ACROSS the roll
  placedLength: number;   // cm — dimension placed ALONG the roll
  isRotated:    boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Resolves optimal orientation for one element in a shared layout.
 *
 * fixed_normal  → no rotation. placedWidth = cutW, placedLength = cutH.
 * can_rotate    → prefer SMALLER placedWidth (leaves more room for siblings).
 *                 if cutH < cutW: rotate (cutH across roll, cutW along roll).
 *                 if cutW ≤ cutH: normal (cutW across roll, cutH along roll).
 *                 Tie (cutW = cutH): prefer non-rotated (stable / predictable).
 */
function resolveOrientation(el: FilmElement): ResolvedElement {
  if (el.orientationConstraint === 'fixed_normal') {
    return { element: el, placedWidth: el.cutW, placedLength: el.cutH, isRotated: false };
  }
  if (el.cutH < el.cutW) {
    return { element: el, placedWidth: el.cutH, placedLength: el.cutW, isRotated: true };
  }
  return { element: el, placedWidth: el.cutW, placedLength: el.cutH, isRotated: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Packing unit construction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Splits FilmElements into atomic packing units for FFD bin packing.
 *
 * Rules:
 *   — split_part elements with the same splitGroupId → one cluster unit,
 *     sorted by sectionIndex (physical strip order preserved).
 *   — All other elements → single-element units.
 *
 * Output order (deterministic):
 *   1. Cluster units, sorted by cluster anchor id (first element's id).
 *   2. Singleton units, sorted by element id.
 */
function buildPackingUnits(elements: FilmElement[]): PackingUnit[] {
  const clusterMap = new Map<string, FilmElement[]>();
  const singletons: PackingUnit[] = [];

  for (const el of elements) {
    if (el.strategyType === 'split_part' && el.splitGroupId) {
      if (!clusterMap.has(el.splitGroupId)) clusterMap.set(el.splitGroupId, []);
      clusterMap.get(el.splitGroupId)!.push(el);
    } else {
      singletons.push([el]);
    }
  }

  // Sort siblings by sectionIndex within each cluster
  const clusters: PackingUnit[] = [];
  for (const cluster of clusterMap.values()) {
    cluster.sort((a, b) => (a.sectionIndex ?? 0) - (b.sectionIndex ?? 0));
    clusters.push(cluster);
  }

  // Deterministic sort of clusters and singletons
  clusters.sort((a, b) => a[0].id.localeCompare(b[0].id));
  singletons.sort((a, b) => a[0].id.localeCompare(b[0].id));

  return [...clusters, ...singletons];
}

/**
 * Total resolved placedWidth of a packing unit.
 * For sibling clusters: sum of each sibling's resolved placedWidth.
 */
function unitPlacedWidth(unit: PackingUnit): number {
  return unit.reduce((sum, el) => sum + resolveOrientation(el).placedWidth, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// SharedLayout construction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a SharedLayout from a bin of elements already verified to fit.
 *
 * Precondition: sum(resolved placedWidths) ≤ rollWidth (enforced by FFD caller).
 * Elements appear in the array in the order they will be placed left-to-right.
 *
 * cutArea / wasteArea / productionArea:
 *   CANDIDATE VARIANT METADATA ONLY. Not written to DB. Not used in totalExpenses.
 *
 * explanation:
 *   Always populated. Enumerates every element, widths, roll, and waste.
 *   No silent grouping — every SharedLayout is fully auditable.
 */
function buildSharedLayout(
  elements:  FilmElement[],
  rollWidth: number,
  id:        string,
): SharedLayout {
  const resolved = elements.map(resolveOrientation);

  // Build placements with sequential xOffset (left-to-right across roll)
  const placements: ElementPlacement[] = [];
  let xOffset = 0;
  for (const r of resolved) {
    placements.push({
      elementId:    r.element.id,
      windowId:     r.element.windowId,
      xOffset:      r2(xOffset),
      placedWidth:  r2(r.placedWidth),
      placedLength: r2(r.placedLength),
      isRotated:    r.isRotated,
    });
    xOffset += r.placedWidth;
  }

  const layoutWidthUsed = r2(resolved.reduce((s, r) => s + r.placedWidth, 0));
  const layoutLength    = r2(Math.max(...resolved.map(r => r.placedLength)));
  const cutArea         = r2(rollWidth * layoutLength / 10_000);
  const productionArea  = r2(elements.reduce((s, el) => s + el.physW * el.physH / 10_000, 0));
  const wasteArea       = r2(Math.max(0, cutArea - productionArea));
  const remnantWidthCm  = r2(rollWidth - layoutWidthUsed);

  // Explanation — always populated, fully explicit
  const widthParts = resolved
    .map(r => `${r.element.id}(${r2(r.placedWidth)}см${r.isRotated ? '↻' : ''})`)
    .join(' + ');

  const explanation = [
    `Элементы: ${widthParts} = ${layoutWidthUsed}см ≤ ${rollWidth}см рулон.`,
    `Полоса вдоль рулона: ${layoutLength}см.`,
    `Раскрой: ${cutArea}м². Перерасход: ${wasteArea}м².`,
    remnantWidthCm > 0
      ? `Остаток по ширине: ${remnantWidthCm}см.`
      : `Рулон по ширине использован полностью.`,
  ].join(' ');

  return {
    id,
    material: elements[0].material,
    rollWidth,
    placements,
    layoutWidthUsed,
    layoutLength,
    cutArea,
    productionArea,
    wasteArea,
    remnantWidthCm,
    elementCount: elements.length,
    explanation,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FFD bin packing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Packs packing units into SharedLayouts using First-Fit Decreasing (FFD).
 *
 * Sort → for each unit: first-fit into existing bins → new bin if no fit.
 * Bins with ≥ 2 elements → SharedLayout.
 * Bins with 1 element or units too wide for rollWidth → individualElements.
 *
 * counterStart: ID counter for deterministic SharedLayout IDs.
 * IDs format: `shared_${material}_${rollWidth}_${n}`.
 */
function ffdPackUnits(
  units:        PackingUnit[],
  rollWidth:    number,
  material:     string,
  counterStart: number,
): { layouts: SharedLayout[]; individualElements: FilmElement[] } {

  // Sort units DESC by placedWidth (widest first = FFD heuristic)
  // Tie-break by first element id (deterministic)
  const sorted = units
    .map(unit => ({ unit, width: unitPlacedWidth(unit) }))
    .sort((a, b) => b.width - a.width || a.unit[0].id.localeCompare(b.unit[0].id));

  const bins: { elements: FilmElement[]; totalWidth: number }[] = [];
  const ungroupable: FilmElement[] = [];

  for (const { unit, width } of sorted) {
    // Unit's combined width exceeds rollWidth → can't place even alone
    if (width > rollWidth) {
      ungroupable.push(...unit);
      continue;
    }

    // First-fit: find the first bin that has room
    let placed = false;
    for (const bin of bins) {
      if (bin.totalWidth + width <= rollWidth) {
        bin.elements.push(...unit);
        bin.totalWidth += width;
        placed = true;
        break;
      }
    }

    // No existing bin fits → open a new single-unit bin
    if (!placed) {
      bins.push({ elements: [...unit], totalWidth: width });
    }
  }

  // Convert bins to SharedLayouts or individuals
  const layouts: SharedLayout[] = [];
  const individualElements: FilmElement[] = [...ungroupable];
  let counter = counterStart;

  for (const bin of bins) {
    if (bin.elements.length >= 2) {
      // Multi-element bin → SharedLayout
      const id = `shared_${material}_${rollWidth}_${counter++}`;
      layouts.push(buildSharedLayout(bin.elements, rollWidth, id));
    } else {
      // Single-element bin → no grouping benefit
      individualElements.push(...bin.elements);
    }
  }

  return { layouts, individualElements };
}

// ─────────────────────────────────────────────────────────────────────────────
// Roll width selection (fast path — no object construction)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Counts how many elements would be grouped on a given rollWidth.
 * Uses FFD logic without constructing SharedLayout objects — fast path.
 * Used to find the best rollWidth before the final packing run.
 */
function countGroupedElements(units: PackingUnit[], rollWidth: number): number {
  const sorted = units
    .map(unit => ({ unit, width: unitPlacedWidth(unit) }))
    .sort((a, b) => b.width - a.width || a.unit[0].id.localeCompare(b.unit[0].id));

  const bins: { elementCount: number; totalWidth: number }[] = [];

  for (const { unit, width } of sorted) {
    if (width > rollWidth) continue;  // ungroupable on this roll
    let placed = false;
    for (const bin of bins) {
      if (bin.totalWidth + width <= rollWidth) {
        bin.elementCount += unit.length;
        bin.totalWidth   += width;
        placed = true;
        break;
      }
    }
    if (!placed) {
      bins.push({ elementCount: unit.length, totalWidth: width });
    }
  }

  return bins
    .filter(b => b.elementCount >= 2)
    .reduce((s, b) => s + b.elementCount, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface SharedLayoutResult {
  sharedLayouts: SharedLayout[];
  /**
   * Elements not placed in any SharedLayout.
   * The caller should assign these to individual roll fitting.
   */
  individualElements: FilmElement[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — groupCompatibleElements (exported for audit / testing)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Groups FilmElements by material.
 * Exported for external inspection. buildOrderSharedLayouts uses this internally.
 */
export function groupCompatibleElements(
  elements: FilmElement[],
): Map<string, FilmElement[]> {
  const byMaterial = new Map<string, FilmElement[]>();
  for (const el of elements) {
    if (!byMaterial.has(el.material)) byMaterial.set(el.material, []);
    byMaterial.get(el.material)!.push(el);
  }
  return byMaterial;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — buildOrderSharedLayouts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds all SharedLayouts for an order's FilmElements.
 *
 * For each material group:
 *   1. Build packing units (sibling clusters + singletons, ordered deterministically).
 *   2. Try each rollWidth ascending. Use countGroupedElements (fast, no objects)
 *      to find the rollWidth that groups the most elements.
 *      Tie: prefer SMALLEST rollWidth (ascending order → first tie wins automatically).
 *   3. Run ffdPackUnits once with the winning rollWidth to build SharedLayouts.
 *   4. Elements not placed in any SharedLayout → individualElements.
 *
 * CALLER RESPONSIBILITY:
 *   Filter oversize elements before passing here (see buildGroupedSharedRowVariant).
 *   buildOrderSharedLayouts does not check individual roll fitting.
 *
 * PURE FUNCTION. No side effects. No DB access. No state.
 *
 * @chapter-d
 */
export function buildOrderSharedLayouts(
  elements: FilmElement[],
): SharedLayoutResult {
  if (elements.length < 2) {
    return { sharedLayouts: [], individualElements: [...elements] };
  }

  const byMaterial   = groupCompatibleElements(elements);
  const allLayouts:     SharedLayout[] = [];
  const allIndividuals: FilmElement[]  = [];
  let layoutCounter = 0;  // global counter ensures deterministic IDs across groups

  for (const [material, group] of byMaterial) {
    if (group.length < 2) {
      allIndividuals.push(...group);
      continue;
    }

    const rolls = [...(ROLL_WIDTHS[material] ?? ROLL_WIDTHS['PVC_700'])].sort((a, b) => a - b);
    const units  = buildPackingUnits(group);

    // --- Pass 1: find the rollWidth that groups the most elements ---
    // countGroupedElements is O(n²) but fast (n ≤ ~20 in typical orders).
    // Ascending iteration: tie-break always resolves to smallest rollWidth.
    let bestRollWidth:    number | null = null;
    let bestGroupedCount = 0;

    for (const rollWidth of rolls) {
      const count = countGroupedElements(units, rollWidth);
      if (count > bestGroupedCount) {
        bestGroupedCount = count;
        bestRollWidth    = rollWidth;
      }
      if (bestGroupedCount === group.length) break;  // perfect grouping — no need to continue
    }

    // No rollWidth groups ≥2 elements → all individual for this material
    if (bestRollWidth === null || bestGroupedCount < 2) {
      allIndividuals.push(...group);
      continue;
    }

    // --- Pass 2: build SharedLayouts with correct IDs ---
    const { layouts, individualElements } = ffdPackUnits(
      units,
      bestRollWidth,
      material,
      layoutCounter,
    );

    allLayouts.push(...layouts);
    allIndividuals.push(...individualElements);
    layoutCounter += layouts.length;  // advance counter for next material group
  }

  return { sharedLayouts: allLayouts, individualElements: allIndividuals };
}