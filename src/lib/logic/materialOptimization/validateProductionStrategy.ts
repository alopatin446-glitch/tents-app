/**
 * materialOptimization/validateProductionStrategy.ts
 *
 * Hard constraints validation for candidate production variants.
 *
 * ARCHITECTURE:
 *   Production validity is NOT a scoring priority.
 *   It is a mandatory filter applied BEFORE scoring.
 *   A variant that violates any hard constraint is REJECTED — even if waste is lower.
 *
 * CONSTRAINTS ORDER:
 *   1. Hard constraints (this file) → variant.isValid = false on any violation
 *   2. Scoring (scoreOptimizationVariants) → only for valid variants
 *   3. Selection (selectBestStrategy) → picks best valid + explains rejections
 *
 * NO SILENT FALLBACKS:
 *   If a variant is rejected, the reason is always recorded in
 *   violatedConstraints[] and surfaced in OptimizerExplanation[].
 *
 * FOUNDATION CONSTRAINTS:
 *   ROLL_FITTING          — element must fit an available roll
 *   MOSQUITO_NO_WELDING   — MOSQUITO material: welding seams forbidden
 *   MATERIAL_VALIDITY     — material code must be in supported list
 *   GEOMETRY_VALIDITY     — element must have positive physical dimensions
 *
 * CHAPTER B: Add constraints for:
 *   — optimizer lock (frozen order) — reject any mutation of locked elements
 *   — price lock — reject strategy changes for price-locked windows
 *   — seam direction rules (for split_part elements)
 *   — topology constraints
 *
 * @module src/lib/logic/materialOptimization/validateProductionStrategy.ts
 */

import { ROLL_WIDTHS } from '@/lib/logic/windowCalculations';
import type { CandidateVariant, ConstraintViolation } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Supported materials
// ─────────────────────────────────────────────────────────────────────────────

const SUPPORTED_MATERIALS = new Set<string>(['PVC_700', 'TPU', 'TINTED', 'MOSQUITO']);

// ─────────────────────────────────────────────────────────────────────────────
// Hard constraint definitions
// ─────────────────────────────────────────────────────────────────────────────

interface HardConstraint {
  id:          string;
  description: string;
  check:       (variant: CandidateVariant) => ConstraintViolation[];
}

const HARD_CONSTRAINTS: HardConstraint[] = [
  /**
   * GEOMETRY_VALIDITY
   * All film elements must have positive physical dimensions.
   * Prevents zero-area or negative-dimension elements from entering production.
   */
  {
    id:          'GEOMETRY_VALIDITY',
    description: 'Все элементы должны иметь положительные физические размеры',
    check: (v) => v.elementStrategies
      .filter(es => es.element.physW <= 0 || es.element.physH <= 0 ||
                    es.element.cutW  <= 0 || es.element.cutH  <= 0)
      .map(es => ({
        constraintId: 'GEOMETRY_VALIDITY',
        description:  `Элемент ${es.element.id}: недопустимые размеры (physW=${es.element.physW}, physH=${es.element.physH})`,
        severity:     'hard' as const,
      })),
  },

  /**
   * MATERIAL_VALIDITY
   * Material code must be in the supported list.
   * Prevents unknown materials from silently using a default roll.
   */
  {
    id:          'MATERIAL_VALIDITY',
    description: 'Материал элемента должен быть в списке поддерживаемых материалов',
    check: (v) => v.elementStrategies
      .filter(es => !SUPPORTED_MATERIALS.has(es.element.material))
      .map(es => ({
        constraintId: 'MATERIAL_VALIDITY',
        description:  `Элемент ${es.element.id}: неизвестный материал «${es.element.material}»`,
        severity:     'hard' as const,
      })),
  },

  /**
   * ROLL_FITTING
   * Every element must fit in at least one available roll.
   * Oversized elements are already flagged in generateCandidateVariants;
   * this constraint enforces the rejection at the variant level.
   */
  {
    id:          'ROLL_FITTING',
    description: 'Все элементы должны помещаться в доступные рулоны материала',
    check: (v) => v.elementStrategies
      .filter(es => es.rollFit.isOverSize)
      .map(es => {
        const maxRoll = Math.max(...(ROLL_WIDTHS[es.element.material] ?? ROLL_WIDTHS['PVC_700']));
        return {
          constraintId: 'ROLL_FITTING',
          description:  `Элемент ${es.element.id} (${es.element.cutW}×${es.element.cutH} см) не помещается в максимальный рулон ${maxRoll} см для материала ${es.element.material}. Требуется split-стратегия (Chapter B).`,
          severity:     'hard' as const,
        };
      }),
  },

  /**
   * MOSQUITO_NO_WELDING
   * MOSQUITO material: welding seams (техпайка) are forbidden.
   * Any element from MOSQUITO with a seam_welding edge is rejected.
   *
   * NOTE: buildMaterialElements already handles MOSQUITO + welding by returning
   * a sole_element fallback with TOPOLOGY_FORBIDDEN warning.
   * That fallback is a valid single_piece element and is NOT rejected here.
   * This constraint is a DEFENSE-IN-DEPTH guard for elements that somehow
   * bypassed buildMaterialElements' own guard (e.g. a future code path error).
   * In normal flow it should never fire.
   */
  {
    id:          'MOSQUITO_NO_WELDING',
    description: 'MOSQUITO: техпайка запрещена',
    check: (v) => v.elementStrategies
      .filter(es => {
        if (es.element.material !== 'MOSQUITO') return false;
        const edges = [
          es.element.edgeLeft, es.element.edgeRight,
          es.element.edgeTop,  es.element.edgeBottom,
        ];
        return edges.some(e => e.type === 'seam_welding');
      })
      .map(es => ({
        constraintId: 'MOSQUITO_NO_WELDING',
        description:  `Элемент ${es.element.id} (MOSQUITO) содержит шов техпайки — запрещено бизнес-правилом`,
        severity:     'hard' as const,
      })),
  },

  /**
   * TOPOLOGY_FORBIDDEN_INVARIANT
   * Chapter C safety-net: MOSQUITO elements must not be split_part with seam_divider edges.
   * buildMaterialElements already prevents this by returning sole_element fallback.
   * This constraint fires ONLY if that invariant is somehow violated downstream.
   *
   * IMPORTANT: This does NOT reject sole_element fallbacks from forbidden-topology windows.
   * A sole_element (topologyRole='sole_element') from a MOSQUITO window is always valid here.
   */
  {
    id:          'TOPOLOGY_FORBIDDEN_INVARIANT',
    description: 'MOSQUITO: разделитель как материальный split запрещён',
    check: (v) => v.elementStrategies
      .filter(es => {
        if (es.element.material !== 'MOSQUITO') return false;
        // Only fire if element is actually a split_section (not a safe sole_element fallback)
        if (es.element.topologyRole !== 'split_section') return false;
        const edges = [
          es.element.edgeLeft, es.element.edgeRight,
          es.element.edgeTop,  es.element.edgeBottom,
        ];
        return edges.some(e => e.type === 'seam_divider');
      })
      .map(es => ({
        constraintId: 'TOPOLOGY_FORBIDDEN_INVARIANT',
        description:  `Элемент ${es.element.id} (MOSQUITO) является split_section с seam_divider — нарушен invariant buildMaterialElements`,
        severity:     'hard' as const,
      })),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Deduplication helper
// ─────────────────────────────────────────────────────────────────────────────

function deduplicateViolations(violations: ConstraintViolation[]): ConstraintViolation[] {
  const seen = new Set<string>();
  return violations.filter(v => {
    const key = `${v.constraintId}|${v.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entrypoint
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Applies all hard constraints to a candidate variant.
 *
 * Returns a new variant (immutable) with:
 *   — violatedConstraints updated (deduplicated, merged with pre-existing)
 *   — isValid = true only if no hard constraint is violated
 *
 * Does NOT modify the original variant.
 * Does NOT produce scoring — that is scoreOptimizationVariants's job.
 */
export function validateProductionStrategy(variant: CandidateVariant): CandidateVariant {
  const freshViolations: ConstraintViolation[] = HARD_CONSTRAINTS
    .flatMap(c => c.check(variant));

  // Merge with any pre-existing violations from generateCandidateVariants
  const merged = deduplicateViolations([
    ...variant.violatedConstraints,
    ...freshViolations,
  ]);

  return {
    ...variant,
    isValid:             merged.every(v => v.severity !== 'hard'),
    violatedConstraints: merged,
  };
}
