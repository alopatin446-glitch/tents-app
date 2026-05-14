/**
 * materialOptimization/index.ts
 *
 * Public API barrel for the order-level material optimizer.
 *
 * CONSUMER CONTRACT:
 *   — `optimizeOrderMaterialPlan` — domain entrypoint, call for live/diagnostic runs.
 *   — `buildTopologySummary`      — readonly display selector; safe to call in UI
 *       with `result.materialElements` for section/seam/split-source display.
 *       Pure function, no side effects, no DB reads.
 *   — Types re-exported for prop typing and result handling.
 *
 *   Do NOT import internal helpers (buildMaterialElements, fitElementToRoll, etc.)
 *   outside this module — they are implementation details.
 *   Result is a pure calculation artifact. Callers MUST NOT mutate it.
 *
 * AUTHORITATIVE BOUNDARY:
 *   This module owns production material calculation truth for LIVE orders.
 *   Snapshot layer owns historical truth (Chapter D persistence).
 *   UI MUST NOT treat result as authoritative production plan
 *   until explicit promotion to authoritative runtime.
 */

export { optimizeOrderMaterialPlan } from './optimizeOrderMaterialPlan';
export { buildTopologySummary }      from './topologySummary';

export type {
  OptimizerInput,
  OrderMaterialOptimizationResult,
  GroupedLayout,
  CandidateVariant,
  CandidateVariantSummary,
  PotentialRemnant,
  FilmElement,
  OptimizerWarning,
  OptimizerExplanation,
  ScoringBreakdown,
  ExecutionMode,
} from './types';

export type { TopologySummary, SplitSourceType } from './topologySummary';
