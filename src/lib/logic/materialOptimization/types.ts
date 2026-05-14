/**
 * materialOptimization/types.ts
 *
 * Foundation types for order-level material optimizer.
 *
 * ARCHITECTURE INVARIANTS:
 *   — Geometry ≠ Topology. Bounding box ≠ real material structure.
 *   — FilmElement is the minimal physical cut unit. NOT a WindowItem, NOT a UI section.
 *   — No auto-splits. Splits happen only through explicit production strategies.
 *   — Optimizer lives in domain layer. UI only displays result.
 *   — Deterministic: same input → same output, same selectedVariant.
 *   — Snapshot layer owns historical truth. Domain layer owns live production truth.
 *
 * Chapter A: Foundation engine (types + pipeline + scoring + explanation).
 * Chapter B: ERP integration (UI display, snapshot persistence, server validation).
 *
 * @module src/lib/logic/materialOptimization/types.ts
 */

// ─────────────────────────────────────────────────────────────────────────────
// Engine constants
// ─────────────────────────────────────────────────────────────────────────────

export const OPTIMIZER_ENGINE_VERSION = '1.0.0-foundation';

/**
 * Overlap allowance per seam side (cm).
 * This is a material technology parameter, NOT a universal hardcoded geometry rule.
 * Current default = 3 cm. Future: may differ by seam type or material.
 *
 * @tech-debt If seam overlap becomes configurable, move to OptimizerConstraints.
 */
export const SEAM_OVERLAP_CM = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Execution mode
// ─────────────────────────────────────────────────────────────────────────────

/**
 * live           — active orders, live geometry. UI calls this mode.
 * snapshot_creation — at order freeze moment. Saves result as optimizerSnapshot.
 * diagnostic     — sandbox only, non-persistent, audit-safe.
 * validation     — constraint-check only, no scoring.
 * preview        — display-only for frozen orders without optimizerSnapshot.
 */
export type ExecutionMode =
  | 'live'
  | 'snapshot_creation'
  | 'diagnostic'
  | 'validation'
  | 'preview';

// ─────────────────────────────────────────────────────────────────────────────
// Edge model
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Physical meaning of each edge of a FilmElement.
 *
 * external     — outer perimeter edge. Receives standard kant/припой.
 * seam_welding — edge formed by welding two film parts (техпайка).
 * seam_divider — edge adjacent to a DividerItem (разделитель).
 * seam_zipper  — edge adjacent to a ZipperItem band (молния).
 *
 * NOTE: seam edge types are Chapter B, when topology-aware split strategies are introduced.
 * Foundation version uses 'external' only.
 */
export type EdgeType =
  | 'external'
  | 'seam_welding'
  | 'seam_divider'
  | 'seam_zipper';

export interface EdgeSpec {
  type:      EdgeType;
  allowance: number;  // cm — added to the physical dimension on this side
}

// ─────────────────────────────────────────────────────────────────────────────
// Orientation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * fixed_normal  — element MUST be placed with cutW across the roll.
 *                 Required for PVC/TPU/TINTED with seam_welding edges
 *                 (seam direction must be along the roll).
 * can_rotate    — optimizer may rotate element 90° to minimise waste.
 */
export type OrientationConstraint = 'fixed_normal' | 'can_rotate';

// ─────────────────────────────────────────────────────────────────────────────
// FilmElement — the core production unit
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A FilmElement is the minimal physical piece of material that must be
 * cut from a roll as a single continuous sheet.
 *
 * IMPORTANT:
 *   — NOT equivalent to a WindowItem (one window may produce multiple elements).
 *   — NOT equivalent to a UI divider/zipper section.
 *   — NOT created by UI extras automatically.
 *   — Determined by physical material topology.
 *
 * Foundation version: one FilmElement per WindowItem (single_piece, sole_element).
 * Chapter C: topology-aware splits produce multiple FilmElements per window
 *   when full-span dividers / full-span zippers / welding items declare splits.
 */
export interface FilmElement {
  /** Unique within the optimization run. Format: `${windowId}_el${n}` */
  id: string;
  windowId: number;

  // ── Physical useful dimensions (without edge allowances, cm) ─────────────
  physW: number;
  physH: number;

  // ── Edges ────────────────────────────────────────────────────────────────
  edgeLeft:   EdgeSpec;
  edgeRight:  EdgeSpec;
  edgeTop:    EdgeSpec;
  edgeBottom: EdgeSpec;

  // ── Cut dimensions (with all edge allowances, cm) ─────────────────────────
  /** cutW = physW + edgeLeft.allowance + edgeRight.allowance */
  cutW: number;
  /** cutH = physH + edgeTop.allowance + edgeBottom.allowance */
  cutH: number;

  // ── Material ─────────────────────────────────────────────────────────────
  material: string;  // WindowMaterial code

  // ── Orientation ───────────────────────────────────────────────────────────
  orientationConstraint: OrientationConstraint;

  // ── Strategy ─────────────────────────────────────────────────────────────
  /** single_piece = no seams. split_part = one section of a topology split. */
  strategyType: 'single_piece' | 'split_part';
  /** Links split_part elements that together form one logical window. */
  splitGroupId?: string;

  // ── Origin ────────────────────────────────────────────────────────────────
  originType: 'window_body' | 'welding_composition';

  // ── Topology metadata (Chapter C) ─────────────────────────────────────────

  /**
   * Why this element exists in the film topology.
   * 'sole_element'  — window has no physical splits; this is the only element.
   * 'split_section' — this is one section of a multi-section window.
   */
  topologyRole: 'sole_element' | 'split_section';

  /**
   * For split_section: which axis was split.
   * null for sole_element.
   */
  splitAxis: 'vertical' | 'horizontal' | null;

  /**
   * For split_section: zero-based index of this section along the split axis.
   * Deterministic: left-to-right for vertical splits, top-to-bottom for horizontal.
   * null for sole_element.
   */
  sectionIndex: number | null;

  /**
   * What caused this split.
   * 'none'    — no split (sole_element)
   * 'divider' — DividerItem (full-span: offsetStart≈0 && offsetEnd≈0)
   * 'zipper'  — ZipperItem (full-span, with explicit non-undefined offsets)
   * 'welding' — WeldingItem (always a split when present)
   */
  splitSourceType: 'none' | 'divider' | 'zipper' | 'welding';
}

// ─────────────────────────────────────────────────────────────────────────────
// Material build result
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return type of buildMaterialElements / buildAllMaterialElements.
 *
 * Separates the calculation artifact (elements) from build-time topology warnings.
 * Topology warnings are generated at element-build time (closest to the source)
 * and flow into OrderMaterialOptimizationResult.warnings via optimizeOrderMaterialPlan.
 *
 * Examples of build-time warnings:
 *   — TOPOLOGY_FORBIDDEN: MOSQUITO with dividers/welding → fallback sole_element
 *   — TOPOLOGY_MIXED: both V and H splits → fallback sole_element (Chapter D)
 *   — PARTIAL_DIVIDER_NO_SPLIT: partial divider detected, not used as split
 */
export interface MaterialBuildResult {
  elements: FilmElement[];
  warnings: OptimizerWarning[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Roll fitting
// ─────────────────────────────────────────────────────────────────────────────

export interface ElementRollFit {
  elementId: string;
  rollWidth:  number;   // cm — the roll used
  isRotated:  boolean;  // true = cutH placed across roll
  isOverSize: boolean;  // true = no roll can fit this element

  cutArea:         number;  // m² — rollWidth × stripLength / 10000
  productionArea:  number;  // m² — physW × physH / 10000
  wasteArea:       number;  // m² — max(0, cutArea − productionArea)
}

// ─────────────────────────────────────────────────────────────────────────────
// Constraints
// ─────────────────────────────────────────────────────────────────────────────

export interface ConstraintViolation {
  constraintId: string;
  description:  string;
  severity:     'hard' | 'soft';
}

// ─────────────────────────────────────────────────────────────────────────────
// Element production strategy
// ─────────────────────────────────────────────────────────────────────────────

export interface ElementProductionStrategy {
  element:             FilmElement;
  rollFit:             ElementRollFit;
  isValid:             boolean;
  violatedConstraints: ConstraintViolation[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Potential remnants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A potential remnant is OPTIMIZATION METADATA only.
 * It is NOT a warehouse asset. It does NOT reduce totalExpenses.
 * It does NOT create automatic warehouse credit.
 *
 * Chapter B (warehouse ledger): if implemented, remnant accounting
 * will be an explicit separate integration layer.
 */
export interface PotentialRemnant {
  material:        string;
  rollWidth:       number;  // cm — the roll this remnant comes from
  /**
   * Unused width of the roll ACROSS the roll direction.
   * = rollWidth − usedCutWidth (or cutHeight when isRotated).
   */
  remnantWidthCm:  number;  // cm
  /**
   * Length of the remnant ALONG the roll direction.
   * = stripLength used to cut the element from that roll.
   */
  remnantLengthCm: number;  // cm
  area:            number;  // m² = remnantWidthCm × remnantLengthCm / 10000
  readonly note: 'optimization_metadata_only';
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lexicographic scoring priorities.
 * Priority order: 1 → 2 → 3 → 4 → 5.
 * First differentiator between two variants wins.
 *
 * NOT a hidden magic number. Every selection must be explainable.
 */
export interface VariantScore {
  totalWasteAreaM2: number;  // Priority 1: lower is better
  seamCount:        number;  // Priority 2: lower is better
  rollSwitchCount:  number;  // Priority 3: lower is better
  remnantQuality:   number;  // Priority 4: higher is better
  complexityScore:  number;  // Priority 5: lower is better
}

// ─────────────────────────────────────────────────────────────────────────────
// Candidate variant
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A complete production/material scenario for the entire order.
 * NOT a per-window layout. NOT a UI helper.
 *
 * Multiple candidate variants are generated, validated, scored, compared.
 * The best valid variant is selected as selectedVariant.
 *
 * Foundation: generates one variant — single_piece_all.
 * Chapter B: adds split_strategy_A, split_strategy_B variants.
 */
export interface CandidateVariant {
  id:           string;
  strategyType: 'single_piece_all' | 'split_strategy_A' | 'split_strategy_B';
  description:  string;

  elementStrategies: ElementProductionStrategy[];

  // ── Aggregates ────────────────────────────────────────────────────────────
  totalCutArea:         number;  // m²
  totalWasteArea:       number;  // m²
  totalProductionArea:  number;  // m²
  seamCount:            number;
  rollSwitchCount:      number;
  uniqueRollWidths:     number[];
  potentialRemnants:    PotentialRemnant[];

  // ── Validity (hard constraints) ───────────────────────────────────────────
  isValid:             boolean;
  violatedConstraints: ConstraintViolation[];

  // ── Scoring (only for valid variants) ────────────────────────────────────
  score?: VariantScore;
}

// ─────────────────────────────────────────────────────────────────────────────
// Grouped layout
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A batch of film elements sharing the same roll run.
 * Used for production batch planning and UI display.
 *
 * NOTE: Shared layout does NOT merge element topologies.
 * Elements remain independent production entities.
 */
export interface GroupedLayout {
  batchKey:       string;    // `${material}_${rollWidth}`
  material:       string;
  rollWidth:      number;    // cm
  elementIds:     string[];  // FilmElement ids in this batch
  totalLength:    number;    // cm — sum of strip lengths along roll
  totalCutArea:   number;    // m²
  totalWasteArea: number;    // m²
}

// ─────────────────────────────────────────────────────────────────────────────
// Explanation / warnings
// ─────────────────────────────────────────────────────────────────────────────

export interface OptimizerExplanation {
  type:       'selected_reason' | 'rejected_reason' | 'constraint_applied' | 'fallback_used' | 'trade_off' | 'info';
  variantId?: string;
  elementId?: string;
  message:    string;
  details?:   string;
}

/**
 * Warnings are ALWAYS visible — in live, diagnostic, and preview modes.
 * No silent fallbacks allowed.
 */
export interface OptimizerWarning {
  level:      'info' | 'warning' | 'error';
  code:       string;
  message:    string;
  elementId?: string;
  windowId?:  number;
}

export interface ScoringBreakdown {
  selectedVariantId: string;
  selectionCriteria: string;
  priorities: Array<{
    rank:            number;
    name:            string;
    selectedValue:   number | string;
    betterDirection: 'lower' | 'higher';
    comparisonNote?: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Candidate variant summary (for result metadata)
// ─────────────────────────────────────────────────────────────────────────────

export interface CandidateVariantSummary {
  id:              string;
  strategyType:    string;
  description:     string;
  isValid:         boolean;
  rejectionReason?: string;
  score?:          VariantScore;
  isSelected:      boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Optimizer constraints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hard production constraints for the optimizer.
 *
 * @foundation-only Foundation enforcement is partial:
 *   - allowWelding and maxSeamsPerElement are defined but not enforced in pipeline.
 *   - Full constraint enforcement for welding/splits/locks comes in Chapter B.
 *   TODO Chapter B: wire these into validateProductionStrategy for split variants.
 */
export interface OptimizerConstraints {
  /** Whether welding (техпайка) split strategy is allowed for this order. */
  allowWelding:        boolean;
  /** Maximum number of seams per element. */
  maxSeamsPerElement:  number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Input / Output
// ─────────────────────────────────────────────────────────────────────────────

import type { WindowItem } from '@/types';

export interface OptimizerInput {
  windows:       WindowItem[];
  executionMode: ExecutionMode;
  constraints?:  Partial<OptimizerConstraints>;

  /**
   * Geometry source hint.
   * 'live'             — compute from current WindowItem dimensions (default).
   * 'geometrySnapshot' — caller provides pre-computed geometry (Chapter B).
   * Foundation: always treated as 'live'. Field is reserved for Chapter B integration.
   */
  geometrySource?: 'live' | 'geometrySnapshot';

  /**
   * Order freeze state.
   * Allows the optimizer to apply locked constraints per freeze level.
   * Foundation: field is reserved but not enforced. Chapter B integrates with
   * geometrySnapshot / optimizerSnapshot persistence.
   *
   * isFinancialFrozen  — financial snapshot locked; don't change totalExpenses.
   * isProductionFrozen — production plan locked; don't regenerate materialElements.
   * isOptimizerFrozen  — optimizerSnapshot is authoritative; skip live run.
   * isPartiallyFrozen  — mixed state; constrained live optimizer applies.
   */
  freezeState?: {
    isFinancialFrozen?:  boolean;
    isProductionFrozen?: boolean;
    isOptimizerFrozen?:  boolean;
    isPartiallyFrozen?:  boolean;
  };

  /**
   * Optimizer behaviour options.
   * Foundation: allowDiagnosticPreview is reserved for Chapter B.
   */
  optimizerOptions?: {
    /** If true, run in diagnostic/preview mode regardless of executionMode. */
    allowDiagnosticPreview?: boolean;
  };

  /**
   * Remnant detection thresholds.
   * Override the engine defaults when caller has specific warehouse requirements.
   * Foundation default: MIN_REMNANT_WIDTH_CM=80, MIN_REMNANT_LENGTH_CM=80.
   */
  remnantOptions?: {
    minUsableWidthCm?:  number;
    minUsableLengthCm?: number;
  };
}

/**
 * The atomic order-level production artifact.
 *
 * Ownership:
 *   Runtime owner:   calculation domain layer (this module)
 *   Historical owner: optimizerSnapshot (Chapter B)
 *   UI:              MUST NOT own, mutate, or recompute this
 *
 * Financial fields (totalExpenses, profit, etc.) are NOT touched.
 * Remnants are metadata only, NOT accounting credits.
 */
export interface OrderMaterialOptimizationResult {
  engineVersion:  string;
  executionMode:  ExecutionMode;
  /** Identifies where the result came from. */
  source:         'live_optimizer' | 'optimizerSnapshot' | 'diagnostic_preview';

  // ── Core data ─────────────────────────────────────────────────────────────
  materialElements: FilmElement[];
  groupedLayouts:   GroupedLayout[];

  // ── Variants ──────────────────────────────────────────────────────────────
  candidateVariantsSummary: CandidateVariantSummary[];
  selectedVariant:          CandidateVariant | null;

  // ── Aggregates from selectedVariant ──────────────────────────────────────
  totalCutArea:        number;  // m²
  totalWasteArea:      number;  // m²
  totalProductionArea: number;  // m²
  potentialRemnants:   PotentialRemnant[];

  // ── Explanation ───────────────────────────────────────────────────────────
  explanations:     OptimizerExplanation[];
  scoringBreakdown: ScoringBreakdown | null;
  /** Always populated. No silent fallbacks. */
  warnings:         OptimizerWarning[];

  // ── Metadata ──────────────────────────────────────────────────────────────
  optimizerMetadata: {
    windowCount:     number;
    elementCount:    number;
    variantCount:    number;
    processingNote:  string;
  };
  snapshotMetadata: {
    isFromSnapshot:    boolean;
    snapshotVersion?:  string;
  };
}
