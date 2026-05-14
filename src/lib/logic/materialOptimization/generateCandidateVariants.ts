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
 * ROLL FITTING:
 *   Uses ROLL_WIDTHS + SMART_TOLERANCE from windowCalculations.
 *   Element.cutW/cutH already include edge allowances — no double-adding.
 *   isRotated=true only when orientationConstraint='can_rotate' AND
 *   rotated placement is materially better (smaller cutArea).
 *
 * INVARIANTS:
 *   — Deterministic: same elements → same variants (sorted rolls, stable logic).
 *   — No auto-splits. No magic 50/50 cuts.
 *   — No side effects. Pure function.
 *
 * @module src/lib/logic/materialOptimization/generateCandidateVariants.ts
 */

import {
  ROLL_WIDTHS,
  SMART_TOLERANCE,
} from '@/lib/logic/windowCalculations';
import type {
  FilmElement,
  ElementRollFit,
  ElementProductionStrategy,
  CandidateVariant,
  ConstraintViolation,
  PotentialRemnant,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Roll fitting
// ─────────────────────────────────────────────────────────────────────────────

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

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
  const rolls = [...(ROLL_WIDTHS[el.material] ?? ROLL_WIDTHS['PVC_700'])]
    .sort((a, b) => a - b);
  const maxRoll = rolls[rolls.length - 1];

  // Normal: cutW across roll, cutH along roll
  const normalRoll = rolls.find(r => (el.cutW - SMART_TOLERANCE) <= r);
  // Rotated: cutH across roll, cutW along roll
  const rotatedRoll =
    el.orientationConstraint === 'can_rotate'
      ? rolls.find(r => (el.cutH - SMART_TOLERANCE) <= r)
      : undefined;

  // Areas (rollWidth × stripLength along roll)
  const normalArea  = normalRoll  ? normalRoll  * el.cutH : Infinity;
  const rotatedArea = rotatedRoll ? rotatedRoll * el.cutW : Infinity;

  let rollWidth:  number;
  let isRotated:  boolean;
  let isOverSize: boolean;

  if (normalRoll !== undefined && normalArea <= (rotatedArea ?? Infinity)) {
    rollWidth  = normalRoll;
    isRotated  = false;
    isOverSize = false;
  } else if (rotatedRoll !== undefined) {
    rollWidth  = rotatedRoll;
    isRotated  = true;
    isOverSize = false;
  } else {
    // No roll fits — oversize
    rollWidth  = maxRoll;
    isRotated  = false;
    isOverSize = true;
  }

  const stripLength    = isRotated ? el.cutW : el.cutH;
  const cutArea        = round2(rollWidth * stripLength / 10_000);
  const productionArea = round2(el.physW * el.physH / 10_000);
  const wasteArea      = Math.max(0, round2(cutArea - productionArea));

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
// Potential remnant detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default remnant thresholds when no override is provided.
 * Foundation default: 80×80 cm (both sides must pass).
 * Override via OptimizerInput.remnantOptions.
 */
const DEFAULT_MIN_REMNANT_WIDTH_CM  = 80;
const DEFAULT_MIN_REMNANT_LENGTH_CM = 80;

/** Shape matches OptimizerInput.remnantOptions — kept inline to avoid extra export. */
interface RemnantThresholds {
  minUsableWidthCm?:  number;
  minUsableLengthCm?: number;
}

/**
 * Checks whether the unused roll width after cutting an element
 * meets the minimum usable remnant threshold.
 *
 * remnantWidthCm  — unused width ACROSS the roll (rollWidth − usedCutWidth).
 * remnantLengthCm — length ALONG the roll (= stripLength of the cut element).
 *
 * Both dimensions must pass their threshold for the remnant to be recorded.
 * Thresholds come from caller via remnantOptions; defaults are 80×80 cm.
 *
 * NOTE: This is optimization metadata only. NOT a warehouse asset.
 *       Does NOT affect totalExpenses or financial snapshots.
 */
function detectRemnant(
  el:             FilmElement,
  fit:            ElementRollFit,
  thresholds?:    RemnantThresholds,
): PotentialRemnant | null {
  if (fit.isOverSize) return null;

  const minWidth  = thresholds?.minUsableWidthCm  ?? DEFAULT_MIN_REMNANT_WIDTH_CM;
  const minLength = thresholds?.minUsableLengthCm ?? DEFAULT_MIN_REMNANT_LENGTH_CM;

  // Width across the roll remaining after the cut
  const usedWidth      = fit.isRotated ? el.cutH : el.cutW;
  const remnantWidthCm = fit.rollWidth - usedWidth;

  // Length along the roll = strip length for this element
  const remnantLengthCm = fit.isRotated ? el.cutW : el.cutH;

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
  el: FilmElement,
  fit: ElementRollFit,
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  if (fit.isOverSize) {
    violations.push({
      constraintId: 'ROLL_FITTING',
      description:  `Элемент ${el.id} (${el.cutW}×${el.cutH} см) превышает максимальный рулон для ${el.material}. Требуется split-стратегия (Chapter B).`,
      severity:     'hard',
    });
  }

  return violations;
}

// ─────────────────────────────────────────────────────────────────────────────
// Single element → ElementProductionStrategy
// ─────────────────────────────────────────────────────────────────────────────

function buildElementStrategy(el: FilmElement): ElementProductionStrategy {
  const rollFit             = fitElementToRoll(el);
  const violatedConstraints = detectElementConstraintViolations(el, rollFit);
  const isValid             = violatedConstraints.every(v => v.severity !== 'hard');

  return { element: el, rollFit, isValid, violatedConstraints };
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregate helpers
// ─────────────────────────────────────────────────────────────────────────────

function countRollSwitches(strategies: ElementProductionStrategy[]): number {
  // Number of unique (material, rollWidth) pairs − 1 = switches needed
  const groups = new Set(
    strategies.map(es => `${es.element.material}_${es.rollFit.rollWidth}`)
  );
  return Math.max(0, groups.size - 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Variant builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Variant 1 (Foundation): single_piece_all
 *
 * Every element is manufactured as a single continuous piece of material.
 * No seams. No welding. No splits.
 * Oversized elements are marked invalid (ROLL_FITTING violation).
 */
function buildSinglePieceAllVariant(
  elements:   FilmElement[],
  thresholds?: RemnantThresholds,
): CandidateVariant {
  const strategies  = elements.map(buildElementStrategy);
  const allViolated = strategies.flatMap(es => es.violatedConstraints);
  const isValid     = allViolated.every(v => v.severity !== 'hard')
                      && allViolated.length === 0;

  const totalCutArea        = round2(strategies.reduce((s, es) => s + es.rollFit.cutArea,        0));
  const totalWasteArea      = round2(strategies.reduce((s, es) => s + es.rollFit.wasteArea,      0));
  const totalProductionArea = round2(strategies.reduce((s, es) => s + es.rollFit.productionArea, 0));

  const uniqueRollWidths = [...new Set(strategies.map(es => es.rollFit.rollWidth))].sort((a, b) => a - b);
  const rollSwitchCount  = countRollSwitches(strategies);
  const seamCount        = 0;  // no seams in single_piece strategy

  const potentialRemnants = strategies
    .map(es => detectRemnant(es.element, es.rollFit, thresholds))
    .filter((r): r is PotentialRemnant => r !== null);

  return {
    id:           'v1_single_piece_all',
    strategyType: 'single_piece_all',
    description:  'Все элементы — цельные полотна, без швов. Каждый элемент раскраивается из рулона отдельно.',

    elementStrategies:    strategies,
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
// Public entrypoint
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates all candidate production variants for the given film elements.
 *
 * Foundation: returns [single_piece_all].
 *
 * Chapter B will add:
 *   — split_strategy_A (welding at optimal seam point)
 *   — split_strategy_B (alternative seam / different grouping)
 *
 * Each variant is validated for hard constraints in validateProductionStrategy.
 * Scoring is applied in scoreOptimizationVariants.
 * Best is selected in selectBestStrategy.
 */
export function generateCandidateVariants(
  elements:    FilmElement[],
  thresholds?: RemnantThresholds,
): CandidateVariant[] {
  if (elements.length === 0) return [];

  const v1 = buildSinglePieceAllVariant(elements, thresholds);

  // Chapter B: add v2, v3 here before returning.
  // Do NOT return early on validity — all variants must reach validateProductionStrategy.

  return [v1];
}
