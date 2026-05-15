/**
 * materialOptimization/generateCandidateVariants.ts
 *
 * Generates candidate production variants for a set of FilmElements.
 *
 * FOUNDATION VERSION:
 *   Generates ONE variant: single_piece_all.
 *   Each element is fitted to the smallest valid roll independently.
 *   Order-level grouping is built in selectBestStrategy (GroupedLayout).
 *
 * CHAPTER B (split strategies):
 *   Will generate additional variants:
 *     — split_strategy_A: split oversized elements at optimal welding point
 *     — split_strategy_B: alternative seam placement / different roll strategy
 *   Each variant is a COMPLETE production scenario, not just a layout.
 *
 * CHAPTER D (grouped shared row):
 *   Adds v2_grouped_shared_row — compatible elements share one physical roll strip.
 *   Uses FFD (First-Fit Decreasing) bin packing via buildOrderSharedLayouts.
 *   v2 is a candidate variant for scoring only; it does NOT replace v1.
 *   If grouping offers no benefit (0 SharedLayouts), only v1 is returned.
 *
 * ROLL FITTING:
 *   Uses ROLL_WIDTHS + SMART_TOLERANCE from windowCalculations.
 *   Element.cutW/cutH already include edge allowances — no double-adding.
 *   isRotated=true only when orientationConstraint='can_rotate' AND
 *   rotated placement is materially better (smaller cutArea).
 *
 * PRORATED cutArea (v2 only):
 *   Each grouped element's rollFit.cutArea = rollWidth × element.placedLength / 10000.
 *   This is an honest approximation for per-element scoring.
 *   The authoritative shared strip cost is SharedLayout.cutArea.
 *   Prorated values are NEVER written to DB / totalExpenses / totalPrice.
 *
 * INVARIANTS:
 *   — Deterministic: same elements → same variants (sorted rolls, stable logic).
 *   — No auto-splits. No magic 50/50 cuts.
 *   — No side effects. Pure function.
 *   — v1_single_piece_all is never modified by Chapter D code.
 *
 * @module src/lib/logic/materialOptimization/generateCandidateVariants.ts
 */

import {
  ROLL_WIDTHS,
  SMART_TOLERANCE,
} from '@/lib/logic/windowCalculations';
import { buildTopologySummary }    from './topologySummary';
import { buildOrderSharedLayouts } from './buildSharedLayouts';
import type {
  FilmElement,
  ElementRollFit,
  ElementProductionStrategy,
  CandidateVariant,
  ConstraintViolation,
  PotentialRemnant,
  SharedLayout,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Roll fitting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fits one FilmElement to the best available roll.
 *
 * Element.cutW/cutH already include all edge allowances.
 * We compare directly: (cutDim - SMART_TOLERANCE) <= roll.
 *
 * Rotation is attempted only when orientationConstraint='can_rotate'.
 * When both orientations fit, prefer the one with smaller cutArea
 * (less material wasted from roll width).
 *
 * If no roll fits in any orientation: isOverSize=true, uses maxRoll.
 */
function fitElementToRoll(el: FilmElement): ElementRollFit {
  const rolls: number[] = [...(ROLL_WIDTHS[el.material] ?? ROLL_WIDTHS['PVC_700'])]
    .sort((a: number, b: number) => a - b);
  const maxRoll = rolls[rolls.length - 1];

  // Normal: cutW across roll, cutH along roll
  const normalRoll: number | undefined = rolls.find(
    (r: number) => (el.cutW - SMART_TOLERANCE) <= r,
  );
  // Rotated: cutH across roll, cutW along roll (only when rotation is allowed)
  const rotatedRoll: number | undefined =
    el.orientationConstraint === 'can_rotate'
      ? rolls.find((r: number) => (el.cutH - SMART_TOLERANCE) <= r)
      : undefined;

  // Cut areas (rollWidth × stripLength along roll)
  const normalArea:  number = normalRoll  ? normalRoll  * el.cutH : Infinity;
  const rotatedArea: number = rotatedRoll ? rotatedRoll * el.cutW : Infinity;

  let rollWidth:  number;
  let isRotated:  boolean;
  let isOverSize: boolean;

  if (normalRoll !== undefined && normalArea <= rotatedArea) {
    rollWidth  = normalRoll;
    isRotated  = false;
    isOverSize = false;
  } else if (rotatedRoll !== undefined) {
    rollWidth  = rotatedRoll;
    isRotated  = true;
    isOverSize = false;
  } else {
    rollWidth  = maxRoll;
    isRotated  = false;
    isOverSize = true;
  }

  const stripLength:    number = isRotated ? el.cutW : el.cutH;
  const cutArea:        number = round2(rollWidth * stripLength / 10_000);
  const productionArea: number = round2(el.physW * el.physH / 10_000);
  const wasteArea:      number = Math.max(0, round2(cutArea - productionArea));

  return {
    elementId: el.id,
    rollWidth,
    isRotated,
    isOverSize,
    cutArea,
    productionArea,
    wasteArea,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Remnant thresholds
// ─────────────────────────────────────────────────────────────────────────────

/** Default remnant thresholds: 80×80 cm (both sides must pass). */
const DEFAULT_MIN_REMNANT_WIDTH_CM  = 80;
const DEFAULT_MIN_REMNANT_LENGTH_CM = 80;

/** Shape matches OptimizerInput.remnantOptions. */
interface RemnantThresholds {
  minUsableWidthCm?:  number;
  minUsableLengthCm?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Potential remnant detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks whether the unused roll width after cutting an element
 * meets the minimum usable remnant threshold.
 *
 * remnantWidthCm  — unused width ACROSS the roll (rollWidth − usedCutWidth).
 * remnantLengthCm — length ALONG the roll (= stripLength of the cut element).
 *
 * Both dimensions must pass their threshold for the remnant to be recorded.
 *
 * NOTE: Optimization metadata only. NOT a warehouse asset.
 *       Does NOT affect totalExpenses or financial snapshots.
 */
function detectRemnant(
  el:          FilmElement,
  fit:         ElementRollFit,
  thresholds?: RemnantThresholds,
): PotentialRemnant | null {
  if (fit.isOverSize) return null;

  const minWidth:  number = thresholds?.minUsableWidthCm  ?? DEFAULT_MIN_REMNANT_WIDTH_CM;
  const minLength: number = thresholds?.minUsableLengthCm ?? DEFAULT_MIN_REMNANT_LENGTH_CM;

  const usedWidth:       number = fit.isRotated ? el.cutH : el.cutW;
  const remnantWidthCm:  number = fit.rollWidth - usedWidth;
  const remnantLengthCm: number = fit.isRotated ? el.cutW : el.cutH;

  if (remnantWidthCm  < minWidth)  return null;
  if (remnantLengthCm < minLength) return null;

  return {
    material:        el.material,
    rollWidth:       fit.rollWidth,
    remnantWidthCm:  Math.round(remnantWidthCm),
    remnantLengthCm: Math.round(remnantLengthCm),
    area:            round2(remnantWidthCm * remnantLengthCm / 10_000),
    note:            'optimization_metadata_only',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Constraint violations (pre-validation — quick checks per element)
// ─────────────────────────────────────────────────────────────────────────────

function detectElementConstraintViolations(
  el:  FilmElement,
  fit: ElementRollFit,
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  if (fit.isOverSize) {
    violations.push({
      constraintId: 'ROLL_FITTING',
      description:  `Элемент ${el.id} (${el.cutW}×${el.cutH} см) превышает максимальный рулон для ${el.material}. Требуется split-стратегия (Chapter D).`,
      severity:     'hard',
    });
  }

  return violations;
}

// ─────────────────────────────────────────────────────────────────────────────
// Single element → ElementProductionStrategy
// ─────────────────────────────────────────────────────────────────────────────

function buildElementStrategy(el: FilmElement): ElementProductionStrategy {
  const rollFit:             ElementRollFit      = fitElementToRoll(el);
  const violatedConstraints: ConstraintViolation[] = detectElementConstraintViolations(el, rollFit);
  const isValid:             boolean             = violatedConstraints.every(
    (v: ConstraintViolation) => v.severity !== 'hard',
  );

  return { element: el, rollFit, isValid, violatedConstraints };
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregate helpers
// ─────────────────────────────────────────────────────────────────────────────

function countRollSwitches(strategies: ElementProductionStrategy[]): number {
  // Number of unique (material, rollWidth) pairs − 1 = roll setup switches needed
  const groups = new Set<string>(
    strategies.map((es: ElementProductionStrategy) =>
      `${es.element.material}_${es.rollFit.rollWidth}`,
    ),
  );
  return Math.max(0, groups.size - 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// V1: single_piece_all variant (original, unchanged)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Variant 1 (topology-aware): all elements, each on its own individually-fitted roll.
 *
 * The variant name 'single_piece_all' is an internal ID — it does NOT mean
 * "no seams". Split sections are included and seams are counted from topology.
 * Human explanations always come from buildTopologySummary, never from this ID.
 *
 * Oversized elements are marked invalid (ROLL_FITTING violation).
 * This function is NOT modified by Chapter D.
 */
function buildSinglePieceAllVariant(
  elements:    FilmElement[],
  thresholds?: RemnantThresholds,
): CandidateVariant {
  const strategies: ElementProductionStrategy[] = elements.map(
    (el: FilmElement) => buildElementStrategy(el),
  );

  const allViolated: ConstraintViolation[] = strategies.flatMap(
    (es: ElementProductionStrategy) => es.violatedConstraints,
  );

  // Chapter D bug fix: isValid = no hard violations.
  // Previous code: `every(...) && allViolated.length === 0` was semantically
  // `length === 0`, which incorrectly rejected variants with soft violations.
  // validateProductionStrategy overwrites isValid anyway, but this pre-check
  // now correctly matches its formula to avoid hidden traps.
  const isValid: boolean = allViolated.every(
    (v: ConstraintViolation) => v.severity !== 'hard',
  );

  const totalCutArea: number = round2(
    strategies.reduce(
      (acc: number, es: ElementProductionStrategy) => acc + es.rollFit.cutArea,
      0,
    ),
  );
  const totalWasteArea: number = round2(
    strategies.reduce(
      (acc: number, es: ElementProductionStrategy) => acc + es.rollFit.wasteArea,
      0,
    ),
  );
  const totalProductionArea: number = round2(
    strategies.reduce(
      (acc: number, es: ElementProductionStrategy) => acc + es.rollFit.productionArea,
      0,
    ),
  );

  const uniqueRollWidths: number[] = [
    ...new Set<number>(
      strategies.map((es: ElementProductionStrategy) => es.rollFit.rollWidth),
    ),
  ].sort((a: number, b: number) => a - b);

  const rollSwitchCount: number = countRollSwitches(strategies);

  // Topology-aware seam count: N split_part elements per splitGroup → N-1 seams.
  // Split sections from dividers/zippers/welding are counted correctly.
  // sole_element windows contribute 0 seams. No double-counting.
  const { seamCount, explanation: topologyExplanation } = buildTopologySummary(elements);

  const potentialRemnants: PotentialRemnant[] = strategies
    .map((es: ElementProductionStrategy) =>
      detectRemnant(es.element, es.rollFit, thresholds),
    )
    .filter((r: PotentialRemnant | null): r is PotentialRemnant => r !== null);

  return {
    id:           'v1_single_piece_all',
    strategyType: 'single_piece_all',
    // Description is topology-aware — built from actual section/seam counts.
    // NOT derived from strategyType string to avoid misleading "no seams" text
    // when split sections are present.
    description: topologyExplanation,

    elementStrategies:   strategies,
    totalCutArea,
    totalWasteArea,
    totalProductionArea,
    seamCount,
    rollSwitchCount,
    uniqueRollWidths,
    potentialRemnants,

    isValid,
    violatedConstraints: allViolated,
    // score is assigned by scoreOptimizationVariants
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// V2: grouped_shared_row variant (Chapter D)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds v2_grouped_shared_row: a candidate variant where compatible elements
 * share one physical roll strip (SharedLayout) instead of each getting their own.
 *
 * GROUPING ALGORITHM:
 *   Delegates to buildOrderSharedLayouts (buildSharedLayouts.ts) which uses
 *   First-Fit Decreasing (FFD) bin packing to group elements by material.
 *   FFD correctly handles cases like A(200)+B(100)+C(80) on rollWidth=200:
 *   B+C=180 are grouped while A stays individual.
 *
 * ELEMENT STRATEGIES:
 *   Grouped elements → modified rollFit with sharedLayoutId set.
 *   Individual elements (not grouped / oversize) → normal fitElementToRoll.
 *
 * PRORATED cutArea (grouped elements only):
 *   rollFit.cutArea = rollWidth × element.placedLength / 10000
 *   This is an honest per-element approximation for scoring purposes.
 *   The authoritative cost of the entire shared strip is SharedLayout.cutArea.
 *   Prorated values are NEVER written to DB / totalExpenses / totalPrice.
 *
 * TOTAL cutArea:
 *   = sum(SharedLayout.cutArea for each shared strip)
 *   + sum(individual element rollFit.cutArea)
 *   Uses SharedLayout.cutArea (not prorated sum) to avoid double-counting.
 *
 * OVERSIZE GUARD:
 *   Elements with no fitting roll are excluded from grouping; they are passed
 *   to buildElementStrategy individually and marked isOverSize.
 *
 * SHAREDLAYOUTS FIELD:
 *   The returned CandidateVariant includes variant.sharedLayouts = sharedLayouts.
 *   This carries the real SharedLayout objects to selectBestStrategy so that
 *   GroupedLayouts can be built with accurate data (placements, widths, areas)
 *   rather than reconstructed from sharedLayoutId alone.
 *
 * Returns null when:
 *   — fewer than 2 elements, OR
 *   — buildOrderSharedLayouts produces 0 SharedLayouts (grouping offers no benefit).
 *   In that case generateCandidateVariants returns only [v1].
 */
function buildGroupedSharedRowVariant(
  elements:    FilmElement[],
  thresholds?: RemnantThresholds,
): CandidateVariant | null {
  if (elements.length < 2) return null;

  // ── Oversize filter ───────────────────────────────────────────────────────
  // Oversize elements (no fitting roll) cannot benefit from grouping.
  // They are passed to buildElementStrategy individually later.
  const fitsARoll = (el: FilmElement): boolean => {
    const rolls: number[] = [
      ...(ROLL_WIDTHS[el.material] ?? ROLL_WIDTHS['PVC_700']),
    ].sort((a: number, b: number) => a - b);
    const maxRoll: number = rolls[rolls.length - 1];
    return (
      (el.cutW - SMART_TOLERANCE) <= maxRoll ||
      (el.orientationConstraint === 'can_rotate' &&
        (el.cutH - SMART_TOLERANCE) <= maxRoll)
    );
  };

  const groupableElements: FilmElement[] = elements.filter(
    (el: FilmElement) => fitsARoll(el),
  );
  const oversizeElements: FilmElement[] = elements.filter(
    (el: FilmElement) => !fitsARoll(el),
  );

  // ── Grouped layout construction (FFD) ─────────────────────────────────────
  const { sharedLayouts, individualElements } =
    buildOrderSharedLayouts(groupableElements);

  // No grouping found — skip v2 entirely to avoid a duplicate of v1
  if (sharedLayouts.length === 0) return null;

  // ── Lookup: elementId → SharedLayout ─────────────────────────────────────
  const elementToLayout = new Map<string, SharedLayout>();
  for (const sl of sharedLayouts) {
    for (const p of sl.placements) {
      elementToLayout.set(p.elementId, sl);
    }
  }

  // ── Build elementStrategies for ALL elements ──────────────────────────────
  const strategies: ElementProductionStrategy[] = [];

  for (const el of elements) {
    const layout: SharedLayout | undefined = elementToLayout.get(el.id);

    if (layout !== undefined) {
      // ── Grouped element: prorated rollFit ──────────────────────────────
      const placement = layout.placements.find(
        (p) => p.elementId === el.id,
      );
      if (placement === undefined) {
        // Defensive: should never happen — fall back to individual
        strategies.push(buildElementStrategy(el));
        continue;
      }

      // Prorated cutArea = rollWidth × this element's placedLength / 10000.
      // Rationale: each element "uses" the full roll width for a length equal
      // to its own placedLength, even though physically the strip is shared.
      // This is conservative (sum of prorated areas ≥ SharedLayout.cutArea)
      // and honest — it never understates waste.
      const proratedCutArea:   number = round2(layout.rollWidth * placement.placedLength / 10_000);
      const productionArea:    number = round2(el.physW * el.physH / 10_000);
      const proratedWasteArea: number = round2(Math.max(0, proratedCutArea - productionArea));

      const rollFit: ElementRollFit = {
        elementId:      el.id,
        rollWidth:      layout.rollWidth,
        isRotated:      placement.isRotated,
        isOverSize:     false,
        cutArea:        proratedCutArea,
        productionArea,
        wasteArea:      proratedWasteArea,
        // sharedLayoutId links this element to its SharedLayout for UI / audit
        sharedLayoutId: layout.id,
      };

      strategies.push({
        element:             el,
        rollFit,
        isValid:             true,
        violatedConstraints: [],
      });
    } else {
      // ── Individual element: normal roll fitting ─────────────────────────
      // Covers: elements not selected for grouping + oversize elements.
      strategies.push(buildElementStrategy(el));
    }
  }

  // ── Aggregates ────────────────────────────────────────────────────────────
  //
  // totalCutArea = sum(SharedLayout.cutArea) + sum(individual rollFit.cutArea)
  //
  // We use SharedLayout.cutArea (not prorated sums) for grouped strips.
  // Reason: prorated sum can exceed SharedLayout.cutArea when elements have
  // different lengths; the SharedLayout.cutArea is the true physical cost.
  //
  // individual elements: their rollFit.cutArea is individually authoritative.
  const groupedLayoutArea: number = sharedLayouts.reduce(
    (acc: number, sl: SharedLayout) => acc + sl.cutArea,
    0,
  );
  const individualArea: number = strategies
    .filter(
      (es: ElementProductionStrategy) =>
        es.rollFit.sharedLayoutId === undefined || es.rollFit.sharedLayoutId === null,
    )
    .reduce(
      (acc: number, es: ElementProductionStrategy) => acc + es.rollFit.cutArea,
      0,
    );

  const totalCutArea:        number = round2(groupedLayoutArea + individualArea);
  const totalProductionArea: number = round2(
    strategies.reduce(
      (acc: number, es: ElementProductionStrategy) => acc + es.rollFit.productionArea,
      0,
    ),
  );
  const totalWasteArea: number = round2(Math.max(0, totalCutArea - totalProductionArea));

  const allViolated: ConstraintViolation[] = strategies.flatMap(
    (es: ElementProductionStrategy) => es.violatedConstraints,
  );

  // Chapter D bug fix: isValid = no hard violations.
  // Previous code: `every(...) && allViolated.length === 0` was semantically
  // `length === 0`, which incorrectly rejected variants with soft violations.
  // validateProductionStrategy overwrites isValid anyway, but this pre-check
  // now correctly matches its formula to avoid hidden traps.
  const isValid: boolean = allViolated.every(
    (v: ConstraintViolation) => v.severity !== 'hard',
  );

  // ── Topology ──────────────────────────────────────────────────────────────
  // Seam count is topology-based — unchanged by grouping decisions.
  // Grouping is a CUTTING strategy, not a topology change.
  // The same seams (dividers, welding, zippers) exist regardless of how we cut.
  const { seamCount, explanation: topologyExplanation } = buildTopologySummary(elements);

  // ── Roll switches ─────────────────────────────────────────────────────────
  // Count unique (material, rollWidth) pairs across ALL strategies.
  const uniqueRollKeySet = new Set<string>(
    strategies.map(
      (es: ElementProductionStrategy) =>
        `${es.element.material}_${es.rollFit.rollWidth}`,
    ),
  );
  const rollSwitchCount: number = Math.max(0, uniqueRollKeySet.size - 1);
  const uniqueRollWidths: number[] = [
    ...new Set<number>(
      strategies.map(
        (es: ElementProductionStrategy) => es.rollFit.rollWidth,
      ),
    ),
  ].sort((a: number, b: number) => a - b);

  // ── Remnants ──────────────────────────────────────────────────────────────
  // SharedLayouts: unused roll width (remnantWidthCm) across × layoutLength along.
  // Individual elements: standard detectRemnant (unused rollWidth after single cut).
  // All remnants are METADATA ONLY — not written to DB, not financial credits.
  const potentialRemnants: PotentialRemnant[] = [];
  const minWidth:  number = thresholds?.minUsableWidthCm  ?? 80;
  const minLength: number = thresholds?.minUsableLengthCm ?? 80;

  for (const sl of sharedLayouts) {
    // SharedLayout remnant: the unused strip width × the strip length
    if (sl.remnantWidthCm >= minWidth && sl.layoutLength >= minLength) {
      potentialRemnants.push({
        material:        sl.material,
        rollWidth:       sl.rollWidth,
        remnantWidthCm:  Math.round(sl.remnantWidthCm),
        remnantLengthCm: Math.round(sl.layoutLength),
        area:            round2(sl.remnantWidthCm * sl.layoutLength / 10_000),
        note:            'optimization_metadata_only',
      });
    }
  }

  // Individual element remnants (not in any SharedLayout)
  for (const es of strategies) {
    if (!es.rollFit.sharedLayoutId) {
      const remnant: PotentialRemnant | null = detectRemnant(
        es.element,
        es.rollFit,
        thresholds,
      );
      if (remnant !== null) potentialRemnants.push(remnant);
    }
  }

  // ── Description ───────────────────────────────────────────────────────────
  // groupedCount = elements that ended up in SharedLayouts
  // = total - not-grouped-from-groupable - oversize
  const groupedCount: number =
    elements.length - individualElements.length - oversizeElements.length;

  const v2Description: string = [
    topologyExplanation,
    `Сгруппировано ${groupedCount} из ${elements.length} элементов в ${sharedLayouts.length} общих полос.`,
  ].join(' ');

  // ── Return ─────────────────────────────────────────────────────────────────
  return {
    id:           'v2_grouped_shared_row',
    strategyType: 'grouped_shared_row',
    description:  v2Description,

    elementStrategies:   strategies,
    totalCutArea,
    totalWasteArea,
    totalProductionArea,
    seamCount,
    rollSwitchCount,
    uniqueRollWidths,
    potentialRemnants,

    isValid,
    violatedConstraints: allViolated,
    // score assigned by scoreOptimizationVariants

    // Chapter D: carry the real SharedLayout objects through to selectBestStrategy.
    // This allows buildGroupedLayoutsForSharedRow to use accurate data
    // (placements, layoutWidthUsed, productionArea, remnantWidthCm)
    // rather than reconstructing stubs from sharedLayoutId alone.
    sharedLayouts,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entrypoint
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates all candidate production variants for the given film elements.
 *
 * Chapter D: returns [v1] or [v1, v2]:
 *   v1 = single_piece_all — every element gets its own individually-fitted roll.
 *        Original foundation behaviour. Never modified by Chapter D.
 *   v2 = grouped_shared_row — compatible elements share one roll strip.
 *        Added when buildOrderSharedLayouts finds ≥1 SharedLayout.
 *        If grouping offers no benefit → v2 is null → only v1 is returned.
 *
 * Both variants are passed to validateProductionStrategy → scoreOptimizationVariants
 * → selectBestStrategy. The lexicographic scorer picks the better one.
 *
 * If v2 reduces totalWasteArea → it wins (Priority 1).
 * If waste is equal → v1 wins (fewer elements / simpler production).
 *
 * Do NOT return early on validity — all variants must reach validateProductionStrategy.
 */
export function generateCandidateVariants(
  elements:    FilmElement[],
  thresholds?: RemnantThresholds,
): CandidateVariant[] {
  if (elements.length === 0) return [];

  // V1: original individual roll assignment — always generated, never skipped
  const v1: CandidateVariant = buildSinglePieceAllVariant(elements, thresholds);

  // V2: grouped shared row — only when grouping is beneficial (≥1 SharedLayout)
  // Returns null if fewer than 2 elements or grouping produces no SharedLayouts.
  const v2: CandidateVariant | null =
    elements.length >= 2
      ? buildGroupedSharedRowVariant(elements, thresholds)
      : null;

  return v2 !== null ? [v1, v2] : [v1];
}