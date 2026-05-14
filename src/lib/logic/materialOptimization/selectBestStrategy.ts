/**
 * materialOptimization/selectBestStrategy.ts
 *
 * Selects the best valid candidate variant and builds:
 *   — GroupedLayout[]    (production batches for UI display)
 *   — explanations[]     (why this variant was selected, what was rejected)
 *   — warnings[]         (always visible, no silent fallbacks)
 *   — scoringBreakdown   (for audit / explainability)
 *   — summaries[]        (metadata for OrderMaterialOptimizationResult)
 *
 * SELECTION RULE:
 *   1. Filter variants to isValid=true
 *   2. Sort by lexicographic score (compareVariants)
 *   3. First = selected. Others = rejected (reasons recorded).
 *   4. If no valid variant: selected=null, warning LEVEL error.
 *
 * NO SILENT FALLBACKS:
 *   If no valid variant exists, the result contains selected=null
 *   and a clear error warning — NOT a hidden approximation.
 *
 * GROUPED LAYOUTS:
 *   Group elements by (material, rollWidth).
 *   Shared layouts do NOT merge topologies — elements remain independent.
 *   totalLength = sum of strip lengths along roll.
 *
 * @module src/lib/logic/materialOptimization/selectBestStrategy.ts
 */

import type {
  CandidateVariant,
  CandidateVariantSummary,
  GroupedLayout,
  OptimizerExplanation,
  OptimizerWarning,
  ScoringBreakdown,
} from './types';
import { compareVariants } from './scoreOptimizationVariants';

// ─────────────────────────────────────────────────────────────────────────────
// Grouped layout builder
// ─────────────────────────────────────────────────────────────────────────────

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Groups element strategies by (material, rollWidth) into roll batch summaries.
 *
 * FOUNDATION NOTE:
 *   This is a ROLL BATCH SUMMARY — elements are grouped by shared roll type,
 *   NOT by physical shared layout on a roll.
 *
 *   Foundation groupedLayouts ≠ real shared layout optimization.
 *   Real grouped cutting (shared constrained production graph, sequence,
 *   remnant reuse between elements) is Chapter B.
 *
 *   In foundation, each element is still treated as independent.
 *   Grouping here only serves batch planning (how many meters of which roll to prepare).
 *
 * totalLength is the sum of cut dimensions along the roll per element:
 *   — isRotated=false: cutH along roll
 *   — isRotated=true:  cutW along roll
 *
 * ElementIds link back to FilmElement for audit/display.
 * WindowIds are NOT stored here — that belongs to the UI layer.
 */
function buildGroupedLayouts(variant: CandidateVariant): GroupedLayout[] {
  const map = new Map<string, GroupedLayout>();

  for (const es of variant.elementStrategies) {
    const key         = `${es.element.material}_${es.rollFit.rollWidth}`;
    const stripLength = es.rollFit.isRotated ? es.element.cutW : es.element.cutH;

    if (!map.has(key)) {
      map.set(key, {
        batchKey:       key,
        material:       es.element.material,
        rollWidth:      es.rollFit.rollWidth,
        elementIds:     [],
        totalLength:    0,
        totalCutArea:   0,
        totalWasteArea: 0,
      });
    }

    const layout = map.get(key)!;
    layout.elementIds.push(es.element.id);
    layout.totalLength    += stripLength;
    layout.totalCutArea    = round2(layout.totalCutArea   + es.rollFit.cutArea);
    layout.totalWasteArea  = round2(layout.totalWasteArea + es.rollFit.wasteArea);
  }

  // Sort batches by (material, rollWidth) for deterministic output
  return [...map.values()].sort((a, b) =>
    a.material !== b.material
      ? a.material.localeCompare(b.material)
      : a.rollWidth - b.rollWidth,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Explanations
// ─────────────────────────────────────────────────────────────────────────────

function buildExplanations(
  selected: CandidateVariant | null,
  allVariants: CandidateVariant[],
): OptimizerExplanation[] {
  const out: OptimizerExplanation[] = [];

  if (!selected) {
    out.push({
      type:    'info',
      message: 'Ни один вариант не прошёл проверку hard constraints. Выбранная стратегия отсутствует.',
      details: 'Проверьте размеры изделий и доступные рулоны. Возможно, требуется split-стратегия (Chapter B).',
    });
    return out;
  }

  // Selected reason
  const s = selected.score;
  out.push({
    type:      'selected_reason',
    variantId: selected.id,
    message:   `Выбран вариант: «${selected.description}»`,
    details:   s
      ? `Перерасход: ${s.totalWasteAreaM2} м²  |  Швы: ${s.seamCount}  |  Переключений рулона: ${s.rollSwitchCount}`
      : undefined,
  });

  // Rejected reasons
  for (const v of allVariants) {
    if (v.id === selected.id) continue;

    if (!v.isValid) {
      out.push({
        type:      'rejected_reason',
        variantId: v.id,
        message:   `Вариант «${v.description}» отклонён: нарушены hard constraints`,
        details:   v.violatedConstraints.map(c => c.description).join(' | '),
      });
    } else if (v.score && selected.score) {
      // Valid but not selected — explain why it ranked lower
      out.push({
        type:      'rejected_reason',
        variantId: v.id,
        message:   `Вариант «${v.description}» валидный, но проиграл по приоритету`,
        details:   `Перерасход: ${v.score.totalWasteAreaM2} м² vs ${selected.score.totalWasteAreaM2} м²`,
      });
    }
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Warnings
// ─────────────────────────────────────────────────────────────────────────────

function buildWarnings(
  selected: CandidateVariant | null,
  allVariants: CandidateVariant[],
): OptimizerWarning[] {
  const out: OptimizerWarning[] = [];

  // Oversize element warnings (always emitted, regardless of selected)
  const anyVariant = selected ?? allVariants[0];
  if (anyVariant) {
    for (const es of anyVariant.elementStrategies) {
      if (es.rollFit.isOverSize) {
        out.push({
          level:     'error',
          code:      'ELEMENT_OVERSIZE',
          message:   `Элемент ${es.element.id} (${es.element.cutW}×${es.element.cutH} см) превышает максимальный рулон для ${es.element.material}. Требуется split-стратегия (техпайка) — Chapter B.`,
          elementId: es.element.id,
          windowId:  es.element.windowId,
        });
      }
    }
  }

  if (!selected) {
    out.push({
      level:   'error',
      code:    'NO_VALID_STRATEGY',
      message: 'Foundation version: не найдена валидная стратегия. В текущей версии поддерживается только single_piece_all. Split-стратегии реализуются в Chapter B.',
    });
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring breakdown (for audit)
// ─────────────────────────────────────────────────────────────────────────────

function buildScoringBreakdown(selected: CandidateVariant): ScoringBreakdown | null {
  if (!selected.score) return null;
  const s = selected.score;

  return {
    selectedVariantId: selected.id,
    selectionCriteria: 'lexicographic_priority',
    priorities: [
      { rank: 1, name: 'Перерасход материала (м²)', selectedValue: s.totalWasteAreaM2, betterDirection: 'lower' },
      { rank: 2, name: 'Количество швов',            selectedValue: s.seamCount,         betterDirection: 'lower' },
      { rank: 3, name: 'Переключений рулона',         selectedValue: s.rollSwitchCount,   betterDirection: 'lower' },
      { rank: 4, name: 'Качество остатков (м²)',      selectedValue: s.remnantQuality,    betterDirection: 'higher' },
      { rank: 5, name: 'Сложность производства',      selectedValue: s.complexityScore,   betterDirection: 'lower' },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Variant summaries
// ─────────────────────────────────────────────────────────────────────────────

function buildSummaries(
  allVariants: CandidateVariant[],
  selectedId: string | undefined,
): CandidateVariantSummary[] {
  return allVariants.map(v => ({
    id:              v.id,
    strategyType:    v.strategyType,
    description:     v.description,
    isValid:         v.isValid,
    rejectionReason: v.isValid
      ? undefined
      : v.violatedConstraints.map(c => c.description).join(' | '),
    score:       v.score,
    isSelected:  v.id === selectedId,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Public result type
// ─────────────────────────────────────────────────────────────────────────────

export interface SelectionResult {
  selected:         CandidateVariant | null;
  groupedLayouts:   GroupedLayout[];
  summaries:        CandidateVariantSummary[];
  explanations:     OptimizerExplanation[];
  warnings:         OptimizerWarning[];
  scoringBreakdown: ScoringBreakdown | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entrypoint
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Selects the best valid variant using lexicographic scoring.
 *
 * Returns selected=null if no valid variant exists (NOT a silent fallback —
 * warnings and explanations will explicitly describe why).
 *
 * groupedLayouts are built from the selected variant only.
 * summaries cover ALL variants (valid and invalid) for audit.
 */
export function selectBestStrategy(variants: CandidateVariant[]): SelectionResult {
  const validVariants = variants.filter(v => v.isValid);

  // Sort valid variants by lexicographic score (best first)
  const sorted   = [...validVariants].sort(compareVariants);
  const selected = sorted[0] ?? null;

  return {
    selected,
    groupedLayouts:   selected ? buildGroupedLayouts(selected) : [],
    summaries:        buildSummaries(variants, selected?.id),
    explanations:     buildExplanations(selected, variants),
    warnings:         buildWarnings(selected, variants),
    scoringBreakdown: selected ? buildScoringBreakdown(selected) : null,
  };
}
