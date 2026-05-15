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
  SharedLayout,
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
 * Builds GroupedLayouts from the selected variant.
 *
 * SINGLE_PIECE_ALL (v1):
 *   Roll batch summary — elements grouped by (material, rollWidth).
 *   totalLength = sum of strip lengths. Backward compatible, unchanged from foundation.
 *
 * GROUPED_SHARED_ROW (v2, Chapter D):
 *   Builds GroupedLayouts from actual SharedLayouts collected from elementStrategies.
 *   Each SharedLayout becomes a GroupedLayout with sharedLayouts populated.
 *   Elements NOT in a SharedLayout contribute to a standard batch summary entry.
 *
 * Both paths produce the same GroupedLayout shape for UI compatibility.
 * The sharedLayouts? field is optional — UI ignores it gracefully on v1.
 */
function buildGroupedLayouts(variant: CandidateVariant): GroupedLayout[] {
  // ── v2: grouped_shared_row ────────────────────────────────────────────────
  if (variant.strategyType === 'grouped_shared_row') {
    return buildGroupedLayoutsForSharedRow(variant);
  }

  // ── v1 / default: roll batch summary (foundation behaviour unchanged) ─────
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
        // sharedLayouts: undefined — v1, backward compatible
      });
    }

    const layout = map.get(key)!;
    layout.elementIds.push(es.element.id);
    layout.totalLength    += stripLength;
    layout.totalCutArea    = round2(layout.totalCutArea   + es.rollFit.cutArea);
    layout.totalWasteArea  = round2(layout.totalWasteArea + es.rollFit.wasteArea);
  }

  return [...map.values()].sort((a, b) =>
    a.material !== b.material
      ? a.material.localeCompare(b.material)
      : a.rollWidth - b.rollWidth,
  );
}

/**
 * Chapter D: builds GroupedLayouts for grouped_shared_row variants.
 *
 * Uses variant.sharedLayouts (the real SharedLayout objects carried from
 * buildGroupedSharedRowVariant) when available. This avoids lossy reconstruction
 * from sharedLayoutId alone (which would leave placements, layoutWidthUsed,
 * productionArea, and remnantWidthCm as placeholder zeros).
 *
 * Fallback path (variant.sharedLayouts unavailable, defensive):
 *   Reconstructs a minimal GroupedLayout from elementStrategies.rollFit data.
 *   Used only if the field is missing — should not happen in normal flow.
 *
 * GROUPED GroupedLayout:
 *   batchKey:      `${material}_${rollWidth}` (same as v1 format for UI compat)
 *   totalLength:   SharedLayout.layoutLength (one strip, NOT sum of element lengths)
 *   totalCutArea:  SharedLayout.cutArea (authoritative, NOT sum of prorated values)
 *   totalWasteArea: SharedLayout.wasteArea
 *   sharedLayouts: [SharedLayout] — the real data from buildSharedLayouts
 *
 * INDIVIDUAL GroupedLayout (elements not in any shared layout):
 *   Standard roll batch summary (same as v1 logic). sharedLayouts: undefined.
 *
 * Both types appear in the same result array, sorted by (material, rollWidth).
 */
function buildGroupedLayoutsForSharedRow(variant: CandidateVariant): GroupedLayout[] {
  const individualMap = new Map<string, GroupedLayout>();

  // ── Path A: use real SharedLayouts from variant (preferred) ──────────────
  if (variant.sharedLayouts && variant.sharedLayouts.length > 0) {
    const sharedGroupedLayouts: GroupedLayout[] = [];

    // Build a set of elementIds in any SharedLayout (to identify individual elements)
    const groupedElementIds = new Set<string>();
    for (const sl of variant.sharedLayouts) {
      for (const p of sl.placements) groupedElementIds.add(p.elementId);
    }

    // Each SharedLayout → one GroupedLayout
    for (const sl of variant.sharedLayouts) {
      sharedGroupedLayouts.push({
        batchKey:       `${sl.material}_${sl.rollWidth}`,
        material:       sl.material,
        rollWidth:      sl.rollWidth,
        elementIds:     sl.placements.map(p => p.elementId),
        totalLength:    sl.layoutLength,      // one shared strip, not sum
        totalCutArea:   sl.cutArea,           // authoritative SharedLayout area
        totalWasteArea: sl.wasteArea,
        sharedLayouts:  [sl],                 // real data with placements, widths, explanation
      });
    }

    // Individual elements (not in any SharedLayout) → standard batch summary
    for (const es of variant.elementStrategies) {
      if (groupedElementIds.has(es.element.id)) continue;
      const { rollFit, element } = es;
      const key         = `${element.material}_${rollFit.rollWidth}`;
      const stripLength = rollFit.isRotated ? element.cutW : element.cutH;
      if (!individualMap.has(key)) {
        individualMap.set(key, {
          batchKey:       key,
          material:       element.material,
          rollWidth:      rollFit.rollWidth,
          elementIds:     [],
          totalLength:    0,
          totalCutArea:   0,
          totalWasteArea: 0,
        });
      }
      const gl = individualMap.get(key)!;
      gl.elementIds.push(element.id);
      gl.totalLength    += stripLength;
      gl.totalCutArea    = round2(gl.totalCutArea   + rollFit.cutArea);
      gl.totalWasteArea  = round2(gl.totalWasteArea + rollFit.wasteArea);
    }

    return [
      ...sharedGroupedLayouts,
      ...[...individualMap.values()],
    ].sort((a, b) =>
      a.material !== b.material
        ? a.material.localeCompare(b.material)
        : a.rollWidth - b.rollWidth,
    );
  }

  // ── Path B: fallback reconstruction from elementStrategies (defensive) ───
  // Reached only if variant.sharedLayouts is missing.
  // Reconstructs minimal GroupedLayouts from rollFit.sharedLayoutId grouping.
  const sharedMap = new Map<string, {
    elementIds:    string[];
    rollWidth:     number;
    material:      string;
    placedLengths: number[];
    wasteArea:     number;
  }>();

  for (const es of variant.elementStrategies) {
    const { rollFit, element } = es;
    if (rollFit.sharedLayoutId) {
      const key = rollFit.sharedLayoutId;
      if (!sharedMap.has(key)) {
        sharedMap.set(key, {
          elementIds: [], rollWidth: rollFit.rollWidth,
          material: element.material, placedLengths: [], wasteArea: 0,
        });
      }
      const e = sharedMap.get(key)!;
      e.elementIds.push(element.id);
      e.placedLengths.push(rollFit.isRotated ? element.cutW : element.cutH);
      e.wasteArea = round2(e.wasteArea + rollFit.wasteArea);
    } else {
      const key         = `${element.material}_${rollFit.rollWidth}`;
      const stripLength = rollFit.isRotated ? element.cutW : element.cutH;
      if (!individualMap.has(key)) {
        individualMap.set(key, {
          batchKey: key, material: element.material,
          rollWidth: rollFit.rollWidth, elementIds: [],
          totalLength: 0, totalCutArea: 0, totalWasteArea: 0,
        });
      }
      const gl = individualMap.get(key)!;
      gl.elementIds.push(element.id);
      gl.totalLength    += stripLength;
      gl.totalCutArea    = round2(gl.totalCutArea   + rollFit.cutArea);
      gl.totalWasteArea  = round2(gl.totalWasteArea + rollFit.wasteArea);
    }
  }

  const fallbackShared: GroupedLayout[] = [];
  for (const [, entry] of sharedMap) {
    const layoutLength = Math.max(...entry.placedLengths);
    const cutArea      = round2(entry.rollWidth * layoutLength / 10_000);
    fallbackShared.push({
      batchKey:       `${entry.material}_${entry.rollWidth}`,
      material:       entry.material,
      rollWidth:      entry.rollWidth,
      elementIds:     entry.elementIds,
      totalLength:    round2(layoutLength),
      totalCutArea:   cutArea,
      totalWasteArea: entry.wasteArea,
      // sharedLayouts: undefined — can't reconstruct full data without original objects
    });
  }

  return [
    ...fallbackShared,
    ...[...individualMap.values()],
  ].sort((a, b) =>
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
      details: 'Проверьте размеры изделий и доступные рулоны. Возможно, требуется split-стратегия (Chapter D).',
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
          message:   `Элемент ${es.element.id} (${es.element.cutW}×${es.element.cutH} см) превышает максимальный рулон для ${es.element.material}. Требуется split-стратегия (техпайка) — Chapter D.`,
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
      message: 'Не найдена валидная стратегия раскроя. Проверьте размеры изделий и доступные рулоны. Split-стратегии с техпайкой — Chapter D.',
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