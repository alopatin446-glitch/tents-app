/**
 * materialOptimization/scoreOptimizationVariants.ts
 *
 * Lexicographic scoring of valid candidate variants.
 *
 * ARCHITECTURE:
 *   Scoring is applied AFTER hard constraints validation.
 *   Only valid variants (isValid=true) receive a score.
 *   Invalid variants keep score=undefined.
 *
 * SCORING MODEL (first version):
 *   Priorities are applied lexicographically — the first differentiator wins.
 *   This model is EXPLAINABLE: every selection has a human-readable reason.
 *
 *   1. Minimum total waste area (m²) — lower is better
 *   2. Fewer seams / welding         — lower is better
 *   3. Fewer roll switches           — lower is better
 *   4. Better potential remnants     — higher quality is better
 *   5. Lower production complexity   — lower is better
 *
 * WHY NOT A SINGLE SCORE NUMBER:
 *   A single opaque number (e.g. score = 83.72) is not explainable.
 *   Lexicographic ordering makes the reason for each selection auditable.
 *
 * INVARIANTS:
 *   — Deterministic: same variants → same scores → same ordering.
 *   — Pure function: no side effects.
 *   — minimum waste does NOT always win (seam count / complexity can override).
 *
 * @module src/lib/logic/materialOptimization/scoreOptimizationVariants.ts
 */

import type { CandidateVariant, VariantScore } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Scoring helpers
// ─────────────────────────────────────────────────────────────────────────────

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Remnant quality: sum of remnant areas, capped per piece to avoid over-weighting
 * a single huge offcut. Higher is better (more useful material saved).
 */
function calcRemnantQuality(variant: CandidateVariant): number {
  const CAP_PER_REMNANT_M2 = 5;
  return round2(
    variant.potentialRemnants.reduce(
      (s, r) => s + Math.min(r.area, CAP_PER_REMNANT_M2),
      0,
    ),
  );
}

/**
 * Production complexity: weighted sum of element count and seam count.
 * Seams are penalised more heavily because they require additional labour.
 */
function calcComplexityScore(variant: CandidateVariant): number {
  return variant.elementStrategies.length + variant.seamCount * 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-variant scoring
// ─────────────────────────────────────────────────────────────────────────────

export function scoreVariant(variant: CandidateVariant): VariantScore {
  return {
    totalWasteAreaM2: round2(variant.totalWasteArea),
    seamCount:        variant.seamCount,
    rollSwitchCount:  variant.rollSwitchCount,
    remnantQuality:   calcRemnantQuality(variant),
    complexityScore:  calcComplexityScore(variant),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch scoring
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assigns scores to all valid variants.
 * Invalid variants (isValid=false) are left without a score.
 * Returns a new array — does NOT mutate input.
 */
export function scoreOptimizationVariants(variants: CandidateVariant[]): CandidateVariant[] {
  return variants.map(v =>
    v.isValid
      ? { ...v, score: scoreVariant(v) }
      : v,  // invalid → no score
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparison (for sorting)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lexicographic comparison of two scored candidate variants.
 * Returns negative if a is better, positive if b is better, 0 if equal.
 *
 * Variants without score (invalid) always rank AFTER valid ones.
 */
export function compareVariants(a: CandidateVariant, b: CandidateVariant): number {
  // Invalid variants rank last
  if (!a.score && !b.score) return 0;
  if (!a.score) return 1;
  if (!b.score) return -1;

  const sa = a.score;
  const sb = b.score;

  // Priority 1: total waste area (lower wins)
  if (sa.totalWasteAreaM2 !== sb.totalWasteAreaM2) {
    return sa.totalWasteAreaM2 - sb.totalWasteAreaM2;
  }
  // Priority 2: seam count (lower wins)
  if (sa.seamCount !== sb.seamCount) {
    return sa.seamCount - sb.seamCount;
  }
  // Priority 3: roll switch count (lower wins)
  if (sa.rollSwitchCount !== sb.rollSwitchCount) {
    return sa.rollSwitchCount - sb.rollSwitchCount;
  }
  // Priority 4: remnant quality (higher wins → reversed)
  if (sa.remnantQuality !== sb.remnantQuality) {
    return sb.remnantQuality - sa.remnantQuality;
  }
  // Priority 5: complexity (lower wins)
  return sa.complexityScore - sb.complexityScore;
}
