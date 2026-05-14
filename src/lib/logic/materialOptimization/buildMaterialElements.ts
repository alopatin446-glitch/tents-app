/**
 * materialOptimization/buildMaterialElements.ts
 *
 * Converts WindowItem[] into FilmElement[] using physical material topology.
 *
 * CHAPTER C — TOPOLOGY-AWARE MATERIAL ELEMENTS:
 *   Produces one or more FilmElements per WindowItem based on physical splits
 *   declared by full-span dividers, full-span zippers, and welding items.
 *
 * CORE CAUSALITY (critical — do not reverse):
 *   Physical material topology determines independent parts.
 *   Full-span divider/zipper/welding EVIDENCE intended material separation.
 *
 *   NOT:  addon → auto-split
 *   YES:  physical split declared → seam/divider edge logic
 *
 * SPLIT RULES:
 *   DividerItem   — full-span (offsetStart≈0 && offsetEnd≈0) → seam_divider split
 *                 — partial (any offset > FULLSPAN_TOLERANCE) → NOT a split, info warning
 *                 — undefined offsets → treated as 0 → full-span (historical default)
 *
 *   ZipperItem    — full-span (both offsets explicitly set AND ≈0) → seam_zipper split
 *                 — partial OR undefined offsets → NOT a split (conservative)
 *                 — allowance = bandLeft / bandRight (NOT SEAM_OVERLAP_CM)
 *
 *   WeldingItem   — always a split when present → seam_welding split
 *
 * NO AUTO-SPLITS:
 *   Oversized elements (cutW > maxRoll) are NEVER auto-split here.
 *   isOverSize is flagged in generateCandidateVariants, not here.
 *
 * MATERIAL CONSTRAINTS:
 *   MOSQUITO: dividers + welding forbidden.
 *   → fallback sole_element + TOPOLOGY_FORBIDDEN warning.
 *   → sole_element is NOT rejected by validateProductionStrategy.
 *
 * MIXED TOPOLOGY: both V and H splits → sole_element + TOPOLOGY_MIXED_NOT_SUPPORTED.
 *
 * ORIENTATION CONSTRAINT:
 *   split_part with seam_welding edges → fixed_normal (weld runs along roll).
 *   All others → can_rotate.
 *
 * @module src/lib/logic/materialOptimization/buildMaterialElements.ts
 */

import type { WindowItem } from '@/types';
import { SEAM_OVERLAP_CM } from './types';
import type {
  FilmElement,
  EdgeSpec,
  OrientationConstraint,
  MaterialBuildResult,
  OptimizerWarning,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const FULLSPAN_TOLERANCE_CM = 0.01;

// ─────────────────────────────────────────────────────────────────────────────
// Internal split point model
// ─────────────────────────────────────────────────────────────────────────────

interface SplitPoint {
  position:        number;
  type:            'divider' | 'zipper' | 'welding';
  sourceId:        string;
  allowanceBefore: number;  // cm — for the section to the left/top of this split
  allowanceAfter:  number;  // cm — for the section to the right/bottom of this split
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tolerance-safe full-span check.
 *
 * Returns true ONLY when:
 *   — both offsets are finite numbers (rejects NaN, ±Infinity)
 *   — both offsets are non-negative (rejects invalid negative values)
 *   — both offsets are within tolerance (effectively zero)
 *
 * null/undefined → default 0 → passes for DividerItem (historical semantics).
 * ZipperItem callers guard with `!= null` BEFORE calling isFullSpan,
 * so null/undefined never reaches here for zippers.
 */
function isFullSpan(
  offsetStart: number | null | undefined,
  offsetEnd:   number | null | undefined,
): boolean {
  const start = Number(offsetStart ?? 0);
  const end   = Number(offsetEnd   ?? 0);
  return Number.isFinite(start)
      && Number.isFinite(end)
      && start >= 0
      && end   >= 0
      && start <= FULLSPAN_TOLERANCE_CM
      && end   <= FULLSPAN_TOLERANCE_CM;
}

function makeExternalEdge(): EdgeSpec {
  return { type: 'external', allowance: SEAM_OVERLAP_CM };
}

function makeSeamEdge(type: EdgeSpec['type'], allowance: number): EdgeSpec {
  return { type, allowance };
}

function elementId(windowId: number, n: number): string {
  return `${windowId}_el${n}`;
}

function makeSplitGroupId(windowId: number): string {
  return `${windowId}_grp`;
}

function resolveOrientationConstraint(
  edgeLeft: EdgeSpec, edgeRight: EdgeSpec,
  edgeTop:  EdgeSpec, edgeBottom: EdgeSpec,
): OrientationConstraint {
  const hasWelding =
    edgeLeft.type   === 'seam_welding' ||
    edgeRight.type  === 'seam_welding' ||
    edgeTop.type    === 'seam_welding' ||
    edgeBottom.type === 'seam_welding';
  return hasWelding ? 'fixed_normal' : 'can_rotate';
}

function dominantSplitSourceType(splits: SplitPoint[]): FilmElement['splitSourceType'] {
  if (splits.some(s => s.type === 'welding')) return 'welding';
  if (splits.some(s => s.type === 'divider')) return 'divider';
  if (splits.some(s => s.type === 'zipper'))  return 'zipper';
  return 'none';
}

// ─────────────────────────────────────────────────────────────────────────────
// Split point collection
// ─────────────────────────────────────────────────────────────────────────────

function collectVerticalSplits(
  ae: NonNullable<WindowItem['additionalElements']>,
): { splits: SplitPoint[]; partialWarnings: OptimizerWarning[] } {
  const splits:          SplitPoint[]       = [];
  const partialWarnings: OptimizerWarning[] = [];

  for (const d of ae.dividers ?? []) {
    if (d.orientation !== 'vertical') continue;
    if (isFullSpan(d.offsetStart, d.offsetEnd)) {
      splits.push({
        position:        d.position,
        type:            'divider',
        sourceId:        d.id,
        allowanceBefore: SEAM_OVERLAP_CM,
        allowanceAfter:  SEAM_OVERLAP_CM,
      });
    } else {
      partialWarnings.push({
        level:   'info',
        code:    'PARTIAL_DIVIDER_NO_SPLIT',
        message: `Вертикальный разделитель «${d.id}» частичный (offsetStart=${d.offsetStart}, offsetEnd=${d.offsetEnd}) — не создаёт материальный split.`,
      });
    }
  }

  // Zipper: undefined offsets → conservative = partial = NOT a split.
  for (const z of ae.zippers ?? []) {
    if (z.orientation !== 'vertical') continue;
    if (
      z.offsetStart != null && z.offsetEnd != null &&
      isFullSpan(z.offsetStart, z.offsetEnd)
    ) {
      splits.push({
        position:        z.positionFromStart,
        type:            'zipper',
        sourceId:        z.id,
        allowanceBefore: z.bandLeft,
        allowanceAfter:  z.bandRight,
      });
    }
  }

  for (const w of ae.welding ?? []) {
    if (w.orientation !== 'vertical') continue;
    splits.push({
      position:        w.position,
      type:            'welding',
      sourceId:        w.id,
      allowanceBefore: SEAM_OVERLAP_CM,
      allowanceAfter:  SEAM_OVERLAP_CM,
    });
  }

  splits.sort((a, b) => a.position - b.position);
  return { splits, partialWarnings };
}

function collectHorizontalSplits(
  ae: NonNullable<WindowItem['additionalElements']>,
): { splits: SplitPoint[]; partialWarnings: OptimizerWarning[] } {
  const splits:          SplitPoint[]       = [];
  const partialWarnings: OptimizerWarning[] = [];

  for (const d of ae.dividers ?? []) {
    if (d.orientation !== 'horizontal') continue;
    if (isFullSpan(d.offsetStart, d.offsetEnd)) {
      splits.push({
        position:        d.position,
        type:            'divider',
        sourceId:        d.id,
        allowanceBefore: SEAM_OVERLAP_CM,
        allowanceAfter:  SEAM_OVERLAP_CM,
      });
    } else {
      partialWarnings.push({
        level:   'info',
        code:    'PARTIAL_DIVIDER_NO_SPLIT',
        message: `Горизонтальный разделитель «${d.id}» частичный (offsetStart=${d.offsetStart}, offsetEnd=${d.offsetEnd}) — не создаёт материальный split.`,
      });
    }
  }

  for (const z of ae.zippers ?? []) {
    if (z.orientation !== 'horizontal') continue;
    if (
      z.offsetStart != null && z.offsetEnd != null &&
      isFullSpan(z.offsetStart, z.offsetEnd)
    ) {
      splits.push({
        position:        z.positionFromStart,
        type:            'zipper',
        sourceId:        z.id,
        allowanceBefore: z.bandLeft,
        allowanceAfter:  z.bandRight,
      });
    }
  }

  for (const w of ae.welding ?? []) {
    if (w.orientation !== 'horizontal') continue;
    splits.push({
      position:        w.position,
      type:            'welding',
      sourceId:        w.id,
      allowanceBefore: SEAM_OVERLAP_CM,
      allowanceAfter:  SEAM_OVERLAP_CM,
    });
  }

  splits.sort((a, b) => a.position - b.position);
  return { splits, partialWarnings };
}

// ─────────────────────────────────────────────────────────────────────────────
// Element builders
// ─────────────────────────────────────────────────────────────────────────────

function buildSoleElement(item: WindowItem): FilmElement {
  const material = item.material || 'PVC_700';
  const physW    = Math.max(Number(item.widthTop),   Number(item.widthBottom));
  const physH    = Math.max(Number(item.heightLeft), Number(item.heightRight));
  const allow    = SEAM_OVERLAP_CM;

  return {
    id:       elementId(item.id, 0),
    windowId: item.id,
    physW,
    physH,
    edgeLeft:   makeExternalEdge(),
    edgeRight:  makeExternalEdge(),
    edgeTop:    makeExternalEdge(),
    edgeBottom: makeExternalEdge(),
    cutW: physW + allow * 2,
    cutH: physH + allow * 2,
    material,
    orientationConstraint: 'can_rotate',
    strategyType:    'single_piece',
    originType:      'window_body',
    topologyRole:    'sole_element',
    splitAxis:       null,
    sectionIndex:    null,
    splitSourceType: 'none',
  };
}

function buildSectionElements(
  item:   WindowItem,
  splits: SplitPoint[],   // MUST be pre-validated (all positions finite and in range)
  axis:   'vertical' | 'horizontal',
  maxW:   number,
  maxH:   number,
): FilmElement[] {
  const material  = item.material || 'PVC_700';
  const axisDim   = axis === 'vertical' ? maxW : maxH;
  const groupId   = makeSplitGroupId(item.id);
  const srcType   = dominantSplitSourceType(splits);
  const bounds    = [0, ...splits.map(s => s.position), axisDim];
  const elements: FilmElement[] = [];   // single declaration

  for (let i = 0; i < bounds.length - 1; i++) {
    const sectionSize = bounds[i + 1] - bounds[i];
    if (sectionSize <= 0) continue;  // guard: duplicate/zero-gap positions

    // Use validSplits (= splits, already filtered by caller) for edge lookup.
    // Index i-1 maps to the split BEFORE this section; i maps to the split AFTER.
    const edgeBefore: EdgeSpec = (i === 0)
      ? makeExternalEdge()
      : makeSeamEdge(
          splits[i - 1].type === 'divider' ? 'seam_divider'
            : splits[i - 1].type === 'zipper' ? 'seam_zipper'
            : 'seam_welding',
          splits[i - 1].allowanceAfter,
        );

    const edgeAfter: EdgeSpec = (i === bounds.length - 2)
      ? makeExternalEdge()
      : makeSeamEdge(
          splits[i].type === 'divider' ? 'seam_divider'
            : splits[i].type === 'zipper' ? 'seam_zipper'
            : 'seam_welding',
          splits[i].allowanceBefore,
        );

    const edgePerpA = makeExternalEdge();
    const edgePerpB = makeExternalEdge();

    let physW: number, physH: number;
    let edgeLeft: EdgeSpec, edgeRight: EdgeSpec;
    let edgeTop:  EdgeSpec, edgeBottom: EdgeSpec;

    if (axis === 'vertical') {
      physW = sectionSize;  physH = maxH;
      edgeLeft = edgeBefore; edgeRight  = edgeAfter;
      edgeTop  = edgePerpA;  edgeBottom = edgePerpB;
    } else {
      physW = maxW;  physH = sectionSize;
      edgeLeft = edgePerpA;  edgeRight  = edgePerpB;
      edgeTop  = edgeBefore; edgeBottom = edgeAfter;
    }

    elements.push({
      id:             elementId(item.id, i),
      windowId:       item.id,
      physW,
      physH,
      edgeLeft,
      edgeRight,
      edgeTop,
      edgeBottom,
      cutW: physW + edgeLeft.allowance + edgeRight.allowance,
      cutH: physH + edgeTop.allowance  + edgeBottom.allowance,
      material,
      orientationConstraint: resolveOrientationConstraint(edgeLeft, edgeRight, edgeTop, edgeBottom),
      strategyType:    'split_part',
      splitGroupId:    groupId,
      originType:      'window_body',
      topologyRole:    'split_section',
      splitAxis:       axis,
      sectionIndex:    i,
      splitSourceType: srcType,
    });
  }

  return elements;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds FilmElements for a single WindowItem.
 *
 * Returns { elements, warnings }.
 * Warnings flow into OrderMaterialOptimizationResult.warnings via optimizeOrderMaterialPlan.
 *
 * MOSQUITO + forbidden topology → sole_element fallback (valid, not rejected by validate).
 */
export function buildMaterialElements(item: WindowItem): MaterialBuildResult {
  const warnings: OptimizerWarning[] = [];
  const material = item.material || 'PVC_700';
  const ae       = item.additionalElements;

  const maxW = Math.max(Number(item.widthTop),   Number(item.widthBottom));
  const maxH = Math.max(Number(item.heightLeft), Number(item.heightRight));

  const vertResult  = ae ? collectVerticalSplits(ae)   : { splits: [], partialWarnings: [] };
  const horizResult = ae ? collectHorizontalSplits(ae) : { splits: [], partialWarnings: [] };
  warnings.push(...vertResult.partialWarnings, ...horizResult.partialWarnings);

  const vertSplits  = vertResult.splits;
  const horizSplits = horizResult.splits;

  // ── MOSQUITO: forbidden topology guard ─────────────────────────────────────
  // buildMaterialElements handles this itself by returning sole_element.
  // validateProductionStrategy does NOT additionally reject this fallback.
  if (material === 'MOSQUITO') {
    const hasForbidden =
      vertSplits.some(s  => s.type === 'divider' || s.type === 'welding') ||
      horizSplits.some(s => s.type === 'divider' || s.type === 'welding');
    if (hasForbidden) {
      warnings.push({
        level:    'warning',
        code:     'TOPOLOGY_FORBIDDEN',
        message:  `Окно ${item.id} (MOSQUITO): разделители и техпайка запрещены — используется sole_element fallback.`,
        windowId: item.id,
      });
      return { elements: [buildSoleElement(item)], warnings };
    }
  }

  // ── Filter invalid split positions (BEFORE topology classification) ────────
  // Must happen first so that hasVert/hasHoriz reflect only usable splits.
  // Example: valid vertical + out-of-range horizontal → only vertical sections,
  // not TOPOLOGY_MIXED_NOT_SUPPORTED.
  function filterValidSplits(
    splitPoints: SplitPoint[],
    axisDim:     number,
  ): SplitPoint[] {
    const valid: SplitPoint[] = [];
    for (const s of splitPoints) {
      if (Number.isFinite(s.position) && s.position > 0 && s.position < axisDim) {
        valid.push(s);
      } else {
        warnings.push({
          level:    'warning',
          code:     'SPLIT_POSITION_OUT_OF_RANGE',
          message:  `Окно ${item.id}: split «${s.sourceId}» (${s.type}) позиция ${s.position} вне допустимого диапазона (0, ${axisDim}) — пропускается.`,
          windowId: item.id,
        });
      }
    }
    return valid;
  }

  const validVert  = filterValidSplits(vertSplits,  maxW);
  const validHoriz = filterValidSplits(horizSplits, maxH);

  // ── Topology classification (based on valid splits only) ──────────────────
  const hasVert  = validVert.length  > 0;
  const hasHoriz = validHoriz.length > 0;

  if (hasVert && hasHoriz) {
    warnings.push({
      level:    'warning',
      code:     'TOPOLOGY_MIXED_NOT_SUPPORTED',
      message:  `Окно ${item.id}: V+H splits одновременно — sole_element fallback. Chapter D.`,
      windowId: item.id,
    });
    return { elements: [buildSoleElement(item)], warnings };
  }

  if (hasVert)  return { elements: buildSectionElements(item, validVert,  'vertical',   maxW, maxH), warnings };
  if (hasHoriz) return { elements: buildSectionElements(item, validHoriz, 'horizontal', maxW, maxH), warnings };

  return { elements: [buildSoleElement(item)], warnings };
}

/**
 * Builds FilmElements for all windows in an order.
 * Aggregates elements and build-time warnings.
 */
export function buildAllMaterialElements(windows: WindowItem[]): MaterialBuildResult {
  const allElements: FilmElement[] = [];
  const allWarnings: OptimizerWarning[] = [];
  for (const w of windows) {
    const { elements, warnings } = buildMaterialElements(w);
    allElements.push(...elements);
    allWarnings.push(...warnings);
  }
  return { elements: allElements, warnings: allWarnings };
}
