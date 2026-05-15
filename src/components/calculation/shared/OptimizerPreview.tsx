'use client';

/**
 * OptimizerPreview.tsx
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  DIAGNOSTIC BOUNDARY — READ-ONLY LAYER                                  ║
 * ║                                                                          ║
 * ║  This component is a PARALLEL DIAGNOSTIC display.                       ║
 * ║  It is explicitly NOT authoritative production truth.                   ║
 * ║                                                                          ║
 * ║  This component:                                                         ║
 * ║    — does NOT replace CuttingDiagnostics                                ║
 * ║    — does NOT replace orderSummary                                       ║
 * ║    — does NOT replace geometrySnapshot                                   ║
 * ║    — does NOT replace the production plan                                ║
 * ║    — does NOT participate in save pipeline                               ║
 * ║    — does NOT affect resolvedRollWidth                                   ║
 * ║    — does NOT affect CuttingCanvas                                       ║
 * ║    — does NOT affect finance calculations                                ║
 * ║    — does NOT affect materialDiagnostics                                 ║
 * ║    — CANNOT be used to patch or sync current batches                    ║
 * ║    — CANNOT be used to replace current cutArea / wasteArea              ║
 * ║    — groupedLayouts are NOT synced into orderSummary                    ║
 * ║    — potentialRemnants are optimization metadata, NOT financial credits  ║
 * ║                                                                          ║
 * ║  Authoritative production display: CuttingDiagnostics.orderSummary      ║
 * ║  This component:                   experimental diagnostic layer         ║
 * ║                                                                          ║
 * ║  Discrepancies between this and CuttingDiagnostics are EXPECTED         ║
 * ║  diagnostic behavior until explicit promotion to authoritative runtime.                ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Displays the result of optimizeOrderMaterialPlan() in readonly mode.
 * Collapsed by default to avoid visual interference with current production UI.
 *
 * Props are readonly — component holds no mutable state derived from result.
 *
 * @module src/components/calculation/shared/OptimizerPreview.tsx
 */

import { useState } from 'react';
import type { OrderMaterialOptimizationResult } from '@/lib/logic/materialOptimization';
import { buildTopologySummary } from '@/lib/logic/materialOptimization';
import styles from './OptimizerPreview.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const MATERIAL_LABELS: Record<string, string> = {
  PVC_700:  'ПВХ 700',
  TPU:      'ТПУ',
  TINTED:   'ПВХ тониров.',
  MOSQUITO: 'Москитка',
};

function getMaterialLabel(code: string): string {
  return MATERIAL_LABELS[code] ?? code;
}

function fArea(m2: number): string {
  return `${m2.toFixed(2)} м²`;
}

function fLength(cm: number): string {
  return `${(cm / 100).toFixed(2)} м.п.`;
}

const WARNING_ICONS: Record<string, string> = {
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface OptimizerPreviewProps {
  /**
   * Readonly calculation artifact from optimizeOrderMaterialPlan().
   * This component MUST NOT mutate this object.
   */
  readonly result: Readonly<OrderMaterialOptimizationResult>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function OptimizerPreview({ result }: OptimizerPreviewProps) {
  // Collapsed by default — does not visually compete with CuttingDiagnostics.
  const [isOpen, setIsOpen] = useState(false);

  const isDiagnostic = result.source === 'diagnostic_preview';
  const hasWarnings  = result.warnings.length > 0;
  const hasSelected  = result.selectedVariant !== null;

  // ── Source badge ────────────────────────────────────────────────────────────
  const sourceBadge = isDiagnostic
    ? <span className={`${styles.sourceBadge} ${styles['sourceBadge--diagnostic']}`}>
        ⚠ diagnostic preview
      </span>
    : <span className={`${styles.sourceBadge} ${styles['sourceBadge--live']}`}>
        live optimizer
      </span>;

  // ── Header label ────────────────────────────────────────────────────────────
  // Show warning dot on header if there are errors, even when collapsed.
  const errorCount = result.warnings.filter(w => w.level === 'error').length;
  const headerLabel = errorCount > 0
    ? `Optimizer (${errorCount} ошибок)`
    : 'Optimizer Preview';

  return (
    <div className={styles.root}>
      {/* ── Toggle header ──────────────────────────────────────────────────── */}
      <button
        className={styles.toggleButton}
        onClick={() => setIsOpen(prev => !prev)}
        type="button"
        aria-expanded={isOpen}
      >
        <span className={styles.toggleLeft}>
          {headerLabel}
          {sourceBadge}
        </span>
        <span className={`${styles.toggleChevron} ${isOpen ? styles['toggleChevron--open'] : ''}`}>
          ▼
        </span>
      </button>

      {/* ── Collapsible content ────────────────────────────────────────────── */}
      {isOpen && (
        <div className={styles.content}>

          {/* Diagnostic disclaimer — always first */}
          <div className={styles.disclaimer}>
            {isDiagnostic
              ? 'Diagnostic preview — frozen order. Результат не является production-авторитетным. ' +
                'Расхождения с Plan раскроя заказа выше — ожидаемое поведение.'
              : 'Experimental diagnostic layer. Не заменяет текущий Plan раскроя заказа. ' +
                'До promotion в authoritative runtime — параллельный расчёт только для диагностики.'
            }
          </div>

          {/* ── Topology summary ─────────────────────────────────────────── */}
          {(() => {
            const topo = buildTopologySummary(result.materialElements);
            const sourceLabels: Record<string, string> = {
              divider: 'разделитель',
              welding: 'техпайка',
              zipper:  'молния',
            };
            const sourcesText = topo.splitSources.length > 0
              ? topo.splitSources.map(s => sourceLabels[s] ?? s).join(', ')
              : '—';
            return (
              <div>
                <div className={styles.sectionTitle}>Топология материала</div>
                <div className={styles.batchStats} style={{ gap: '16px', flexWrap: 'wrap' }}>
                  <span>Секций: <strong>{topo.sectionCount}</strong></span>
                  <span>Швов: <strong>{topo.seamCount}</strong></span>
                  <span>Сплит: <strong>{sourcesText}</strong></span>
                </div>
                <div className={styles.disclaimer} style={{ marginTop: '6px' }}>
                  {topo.explanation}
                </div>
              </div>
            );
          })()}

          {/* ── Warnings — always rendered when present ─────────────────── */}
          {hasWarnings && (
            <div>
              <div className={styles.sectionTitle}>Предупреждения</div>
              <div className={styles.warningList}>
                {result.warnings.map((w, i) => (
                  <div
                    key={i}
                    className={`${styles.warning} ${styles[`warning--${w.level}`]}`}
                  >
                    <span className={styles.warningIcon}>{WARNING_ICONS[w.level] ?? '•'}</span>
                    <span>{w.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── GroupedLayouts (batch summary) ──────────────────────────── */}
          {hasSelected && result.groupedLayouts.length > 0 ? (
            <div>
              <div className={styles.sectionTitle}>
                Группы раскроя (optimizer roll batch summary)
              </div>
              <div className={styles.batchList}>
                {result.groupedLayouts.map((layout) => (
                  // Chapter D bug fix: key uses layout.batchKey which is now sl.id
                  // for v2 shared layouts (guaranteed unique) and material_rollWidth
                  // for v1 / individual layouts (deduplicated in Map).
                  // No more React duplicate key warning from batchKey collision.
                  <div key={layout.batchKey} className={styles.batchCard}>
                    <div className={styles.batchHeader}>
                      <span className={styles.batchMaterial}>
                        {getMaterialLabel(layout.material)}
                      </span>
                      <span className={styles.batchRoll}>
                        {layout.rollWidth} см рулон
                      </span>
                    </div>
                    <div className={styles.batchStats}>
                      <span>
                        {/* Chapter D bug fix: label differs for shared (one strip) vs individual (sum) */}
                        {layout.sharedLayouts && layout.sharedLayouts.length > 0
                          ? 'Полоса:'
                          : 'Погонаж:'
                        }{' '}
                        <strong>{fLength(layout.totalLength)}</strong>
                      </span>
                      <span>
                        Площадь: <strong>{fArea(layout.totalCutArea)}</strong>
                      </span>
                      <span>
                        Отход: <strong>{fArea(layout.totalWasteArea)}</strong>
                      </span>
                    </div>

                    {/* Chapter D bug fix: SharedLayout details for v2 grouped variants.
                        Renders explanation, element count, width utilisation, remnant.
                        Only shown when layout.sharedLayouts is populated (v2 only).
                        v1 layouts have sharedLayouts=undefined — block is skipped. */}
                    {layout.sharedLayouts && layout.sharedLayouts.length > 0 && (
                      <div style={{
                        marginTop: '6px',
                        paddingTop: '6px',
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}>
                        {layout.sharedLayouts.map(sl => (
                          <div key={sl.id}>
                            {/* Width utilisation bar: layoutWidthUsed / rollWidth */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '11px',
                              color: 'rgba(255,255,255,0.5)',
                              marginBottom: '3px',
                            }}>
                              <span>
                                {sl.elementCount} эл.
                              </span>
                              <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
                              <span>
                                {sl.layoutWidthUsed} / {sl.rollWidth} см ширина
                              </span>
                              {sl.remnantWidthCm > 0 && (
                                <>
                                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
                                  <span style={{ color: 'rgba(99,102,241,0.8)' }}>
                                    остаток {sl.remnantWidthCm} см
                                  </span>
                                </>
                              )}
                            </div>
                            {/* explanation — always populated in Chapter D */}
                            <div style={{
                              fontSize: '10px',
                              color: 'rgba(255,255,255,0.3)',
                              lineHeight: '1.4',
                              fontStyle: 'italic',
                            }}>
                              {sl.explanation}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className={styles.totalsRow}>
                <span className={styles.totalsLabel}>Итого площадь списания</span>
                <span className={styles.totalsValue}>{fArea(result.totalCutArea)}</span>
              </div>
              <div className={styles.totalsRow}>
                <span className={styles.totalsLabel}>Итого перерасход</span>
                <span className={`${styles.totalsValue} ${styles['totalsValue--waste']}`}>
                  {fArea(result.totalWasteArea)}
                </span>
              </div>
            </div>
          ) : !hasSelected ? (
            <div className={styles.noStrategy}>
              Валидная стратегия не найдена. Проверьте предупреждения выше.
            </div>
          ) : null}

          {/* ── Potential remnants ────────────────────────────────────────── */}
          {result.potentialRemnants.length > 0 && (
            <div>
              <div className={styles.sectionTitle}>Потенциальные остатки</div>
              <div className={styles.remnantList}>
                {result.potentialRemnants.map((r, i) => (
                  <div key={i} className={styles.remnantItem}>
                    <span>
                      {getMaterialLabel(r.material)} — {r.remnantWidthCm}×{r.remnantLengthCm} см
                    </span>
                    <span className={styles.remnantMeta}>{fArea(r.area)}</span>
                  </div>
                ))}
              </div>
              <div className={styles.remnantNote}>
                Optimization metadata only — не является складским активом и не влияет на финансы
              </div>
            </div>
          )}

          {/* ── Explanations ─────────────────────────────────────────────── */}
          {result.explanations.length > 0 && (
            <div>
              <div className={styles.sectionTitle}>Объяснение выбора</div>
              <div className={styles.explanationList}>
                {result.explanations.map((e, i) => {
                  const cls = e.type === 'selected_reason'
                    ? styles['explanation--selected']
                    : e.type === 'rejected_reason'
                      ? styles['explanation--rejected']
                      : '';
                  return (
                    <div key={i} className={`${styles.explanation} ${cls}`}>
                      {e.message}
                      {e.details && <span> — {e.details}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Engine metadata ───────────────────────────────────────────── */}
          <div className={styles.disclaimer}>
            Engine: {result.engineVersion} ·
            Windows: {result.optimizerMetadata.windowCount} ·
            Elements: {result.optimizerMetadata.elementCount} ·
            Variants: {result.optimizerMetadata.variantCount}
          </div>

        </div>
      )}
    </div>
  );
}