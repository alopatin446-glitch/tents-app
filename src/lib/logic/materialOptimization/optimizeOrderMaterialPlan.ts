/**
 * materialOptimization/optimizeOrderMaterialPlan.ts
 *
 * DOMAIN ENTRYPOINT — deterministic order-level material optimizer.
 *
 * PIPELINE (Chapter A — Foundation):
 *
 *   Input: OptimizerInput (windows, executionMode, constraints)
 *     │
 *     ├─ Step 1: buildAllMaterialElements
 *     │    WindowItem[] → FilmElement[]
 *     │    Foundation: one element per window (single_piece)
 *     │
 *     ├─ Step 2: generateCandidateVariants
 *     │    FilmElement[] → CandidateVariant[]
 *     │    Foundation: one variant (single_piece_all)
 *     │
 *     ├─ Step 3: validateProductionStrategy (per variant)
 *     │    Hard constraints → filter invalid variants
 *     │    ROLL_FITTING, MOSQUITO_NO_WELDING, MATERIAL_VALIDITY, GEOMETRY_VALIDITY
 *     │
 *     ├─ Step 4: scoreOptimizationVariants
 *     │    Lexicographic scoring for valid variants only
 *     │
 *     ├─ Step 5: selectBestStrategy
 *     │    Best valid variant → selected
 *     │    GroupedLayouts, explanations, warnings, scoringBreakdown
 *     │
 *     └─ Step 6: assemble OrderMaterialOptimizationResult
 *
 * INVARIANTS:
 *   — Deterministic: same input → same output in all execution modes.
 *   — Pure function: no side effects, no DB reads/writes.
 *   — No financial mutations (totalExpenses, profit, prices untouched).
 *   — No snapshot mutations (geometrySnapshot, optimizerSnapshot untouched).
 *   — No silent fallbacks: all fallback situations are in warnings[].
 *   — UI must NOT call this for frozen orders → use optimizerSnapshot instead.
 *
 * OWNERSHIP:
 *   Domain layer owns the result at runtime.
 *   Snapshot layer owns historical results (Chapter B).
 *   UI only displays the result.
 *
 * CHAPTER B integration points (marked with TODO):
 *   — Accept optimizerSnapshot → return from snapshot without re-running pipeline
 *   — Accept priceMap → enable financial integration (cost/waste costing)
 *   — Support split_strategy_A, split_strategy_B variants
 *   — Support partial freeze / optimizer lock constraints
 *
 * @module src/lib/logic/materialOptimization/optimizeOrderMaterialPlan.ts
 */

import {
  OPTIMIZER_ENGINE_VERSION,
  type OptimizerInput,
  type OrderMaterialOptimizationResult,
} from './types';
import { buildAllMaterialElements }       from './buildMaterialElements';
import { generateCandidateVariants }      from './generateCandidateVariants';
import { validateProductionStrategy }     from './validateProductionStrategy';
import { scoreOptimizationVariants }      from './scoreOptimizationVariants';
import { selectBestStrategy }             from './selectBestStrategy';

// ─────────────────────────────────────────────────────────────────────────────
// Entrypoint
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs the full order-level material optimization pipeline.
 *
 * USAGE:
 *   // Live order (called from CuttingDiagnostics or ProductionStep — Chapter B)
 *   const result = optimizeOrderMaterialPlan({
 *     windows:       order.windows,
 *     executionMode: 'live',
 *   });
 *
 *   // Diagnostic preview (non-persistent, audit-safe)
 *   const result = optimizeOrderMaterialPlan({
 *     windows:       order.windows,
 *     executionMode: 'diagnostic',
 *   });
 *
 * DO NOT call for frozen orders.
 * Frozen orders: use optimizerSnapshot (Chapter B integration).
 */
export function optimizeOrderMaterialPlan(
  input: OptimizerInput,
): OrderMaterialOptimizationResult {
  const { windows, executionMode } = input;

  // ── Step 1: Build film elements ──────────────────────────────────────────
  // Foundation: one FilmElement per WindowItem (single_piece, bounding box).
  // Chapter B: topology-aware split elements when dividers/welding require it.
  const materialElements = buildAllMaterialElements(windows);

  // ── Step 2: Generate candidate variants ─────────────────────────────────
  // Foundation: [single_piece_all].
  // remnantOptions from input are forwarded so callers can override 80×80 default.
  // Chapter B: +[split_strategy_A, split_strategy_B].
  const rawVariants = generateCandidateVariants(materialElements, input.remnantOptions);

  // ── Step 3: Validate (hard constraints) ─────────────────────────────────
  // Mutates nothing — returns new variant objects.
  const validatedVariants = rawVariants.map(validateProductionStrategy);

  // ── Step 4: Score ────────────────────────────────────────────────────────
  // Only valid variants receive a score. Invalid → score=undefined.
  const scoredVariants = scoreOptimizationVariants(validatedVariants);

  // ── Step 5: Select best ──────────────────────────────────────────────────
  // selected=null → no valid strategy found → warnings contain reason.
  const {
    selected,
    groupedLayouts,
    summaries,
    explanations,
    warnings,
    scoringBreakdown,
  } = selectBestStrategy(scoredVariants);

  // ── Step 6: Assemble result ──────────────────────────────────────────────
  //
  // source reflects where the result came from, NOT just that the pipeline ran.
  // diagnostic/preview must never be masked as a live result.
  //
  // snapshot_creation intentionally maps to 'live_optimizer': it creates a new
  // deterministic optimizer result from live input immediately before saving
  // the optimizerSnapshot. The result IS a live optimizer run at freeze time.
  const source: OrderMaterialOptimizationResult['source'] =
    (executionMode === 'diagnostic' || executionMode === 'preview')
      ? 'diagnostic_preview'
      : 'live_optimizer';

  return {
    engineVersion: OPTIMIZER_ENGINE_VERSION,
    executionMode,
    source,

    materialElements,
    groupedLayouts,

    candidateVariantsSummary: summaries,
    selectedVariant:          selected,

    totalCutArea:        selected?.totalCutArea        ?? 0,
    totalWasteArea:      selected?.totalWasteArea       ?? 0,
    totalProductionArea: selected?.totalProductionArea  ?? 0,
    potentialRemnants:   selected?.potentialRemnants    ?? [],

    explanations,
    scoringBreakdown,
    warnings,

    optimizerMetadata: {
      windowCount:    windows.length,
      elementCount:   materialElements.length,
      variantCount:   scoredVariants.length,
      processingNote: [
        'Foundation version: single_piece_all strategy only.',
        'Split strategies (техпайка, welding composition) → Chapter B.',
        'Topology-aware element generation (dividers, zippers) → Chapter B.',
        'Snapshot persistence (optimizerSnapshot) → Chapter B.',
      ].join(' '),
    },

    snapshotMetadata: {
      isFromSnapshot: false,
      // TODO Chapter B: populate when loading from optimizerSnapshot
    },
  };
}
