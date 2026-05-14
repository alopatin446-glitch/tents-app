/**
 * materialOptimization/topologySummary.ts
 *
 * Pure deterministic helper: analyses FilmElement[] topology and returns
 * a human-readable summary for explanations, scoring, and UI display.
 *
 * RULES:
 *   — No auto-splits. No side effects. No DB reads. Pure function.
 *   — Seam counting: N split_part elements sharing a splitGroupId → N-1 seams.
 *     Adjacent sections share one seam — no double-counting.
 *   — split_source collected from element.splitSourceType (never 'none' for seam edges).
 *   — Explanation text built from topology metadata, NOT from strategyType string.
 *
 * @module src/lib/logic/materialOptimization/topologySummary.ts
 */

import type { FilmElement } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Result type
// ─────────────────────────────────────────────────────────────────────────────

export type SplitSourceType = 'divider' | 'zipper' | 'welding';

export interface TopologySummary {
  /** Total number of film elements (sections) across the order. */
  sectionCount:   number;
  /**
   * Number of unique production seams.
   * N sections sharing one splitGroupId → N-1 seams.
   * No double-counting: adjacent sections share one seam, not two.
   */
  seamCount:      number;
  /** Unique split source types present (sorted for determinism). */
  splitSources:   ReadonlyArray<SplitSourceType>;
  /** true if any element is a split_section. */
  hasAnySplits:   boolean;
  /** Human-readable topology description for explanations and UI. */
  explanation:    string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Counts production seams without double-counting.
 *
 * Strategy: group split_part elements by splitGroupId.
 * A group of N sections has N-1 seams (linear chain between adjacent sections).
 * sole_element groups contribute 0 seams.
 */
function countSeams(elements: FilmElement[]): number {
  const groups = new Map<string, number>();
  for (const el of elements) {
    if (el.strategyType === 'split_part' && el.splitGroupId) {
      groups.set(el.splitGroupId, (groups.get(el.splitGroupId) ?? 0) + 1);
    }
  }
  let seams = 0;
  for (const n of groups.values()) seams += Math.max(0, n - 1);
  return seams;
}

/**
 * Collects unique split source types, sorted for deterministic output.
 */
function collectSplitSources(elements: FilmElement[]): SplitSourceType[] {
  const sources = new Set<SplitSourceType>();
  for (const el of elements) {
    if (el.splitSourceType !== 'none') {
      sources.add(el.splitSourceType as SplitSourceType);
    }
  }
  return [...sources].sort();
}

/**
 * Source label for human-readable explanation.
 */
function sourceLabel(sources: ReadonlyArray<SplitSourceType>): string {
  const labels: Record<SplitSourceType, string> = {
    divider: 'разделитель',
    welding: 'техпайка',
    zipper:  'молния',
  };
  return sources.map(s => labels[s]).join(', ');
}

/**
 * Builds a human-readable topology explanation.
 * Uses section count, seam count, and split sources — NOT strategyType string.
 */
function buildExplanationText(
  sectionCount: number,
  seamCount:    number,
  splitSources: ReadonlyArray<SplitSourceType>,
): string {
  // Single sole_element: no seams.
  if (sectionCount === 1 && seamCount === 0) {
    return '1 цельное полотно, швов нет.';
  }

  // Multiple sections, zero seams — shouldn't happen in normal flow; defensive.
  if (seamCount === 0) {
    return `${sectionCount} секций материала, швов нет.`;
  }

  const seamsLabel = seamCount === 1 ? '1 шов' : `${seamCount} швов`;

  if (sectionCount === 2 && seamCount === 1) {
    if (splitSources.length === 1) {
      if (splitSources[0] === 'divider') return `2 секции материала, соединены разделителем (${seamsLabel}).`;
      if (splitSources[0] === 'welding') return `2 секции материала, соединены техпайкой (${seamsLabel}).`;
      if (splitSources[0] === 'zipper')  return `2 секции материала, разделены молнией (${seamsLabel}).`;
    }
    return `2 секции материала (${seamsLabel}, источник: ${sourceLabel(splitSources)}).`;
  }

  // General: N sections, M seams.
  return `${sectionCount} секций материала, ${seamsLabel} (источник: ${sourceLabel(splitSources)}).`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a TopologySummary for an array of FilmElements.
 *
 * Deterministic, pure, no side effects.
 * Safe to call with an empty array (returns zero counts).
 */
export function buildTopologySummary(elements: FilmElement[]): TopologySummary {
  const sectionCount  = elements.length;
  const seamCount     = countSeams(elements);
  const splitSources  = collectSplitSources(elements);
  const hasAnySplits  = splitSources.length > 0;
  const explanation   = buildExplanationText(sectionCount, seamCount, splitSources);

  return { sectionCount, seamCount, splitSources, hasAnySplits, explanation };
}
