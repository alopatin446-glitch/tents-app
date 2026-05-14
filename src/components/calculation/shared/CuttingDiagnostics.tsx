'use client';

/**
 * CuttingDiagnostics — «ПЛАН РАСКРОЯ ЗАКАЗА».
 *
 * Chapter 4 (rev 2): расширенные секции с collapsible промежуточными расчётами.
 *
 * Секции каждого изделия:
 *   1. Геометрия (всегда развёрнута)
 *   2. Кант     (кол-во, перерасход, формула — скрываемая детализация)
 *   3. Крепёж   (тип, стороны, шаг, ЗП, розница/себес — скрываемая детализация)
 *   4. Допы     (каждый элемент с ценами — скрываемая детализация)
 *   5. Себестоимость (итоговый breakdown — скрываемая детализация)
 *
 * priceMap — опционален. Без него финансовые секции скрыты (backward compat).
 * Snapshot: activePrices из ProductionStep (resolveActivePrices) — инвариант Ch.1.
 *
 * @module src/components/calculation/shared/CuttingDiagnostics.tsx
 */

import { useMemo, useState } from 'react';
import { type WindowItem, type GeometrySnapshotV1, type WindowGeometrySnapshot } from '@/types';
import {
  calculateFastenerPoints,
  type FastenerPointsResult,
} from '@/lib/logic/fastenerCalculations';
import {
  calculateWindowGeometry,
  formatArea,
  SOLDER_ALLOWANCE,
  ROLL_WIDTHS,
  SMART_TOLERANCE,
  type WindowGeometry,
  type OrderOptimization,
} from '@/lib/logic/windowCalculations';
import {
  calculateWindowFinance,
  type PriceMap,
  type WindowFinance,
  type FinancialGeometrySnapshot,
} from '@/lib/logic/pricingLogic';
import {
  calculateExtrasAsServiceItems,
  getOuterBottomCm,
} from '@/lib/logic/extrasCalculations';
import { type ServiceItem } from '@/logic/orders/Order';
import styles from './CuttingDiagnostics.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// Публичный тип — импортируется ProductionStep и CalculationClient
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Агрегаты уровня заказа из useCalculationState / CalculationClient.
 * Передаются в CuttingDiagnostics для сверки с per-window расчётом.
 *
 * clientProductCostDisplay = costPrice + fastenersCostTotal + extrasCostTotal
 *   — то, что ClientStep показывает в строке «Стоимость изделия».
 *   Нельзя путать с finance.costPrice (только плёнка + кант одного окна).
 *
 * expensesWithoutMounting = totalExpenses - mountingCostTotal
 *   — «Всего расходов» без монтажа, т.к. CuttingDiagnostics монтаж не видит.
 */
export interface OrderTotals {
  /** ClientStep «Стоимость изделия» = costPrice + fasteners + extras (все окна) */
  clientProductCostDisplay: number;
  /** ClientStep «Перерасход» = Σ finance.overspending (все окна) */
  totalOverspending: number;
  /** ClientStep «Изготовление» = Σ finance.productionCost (все окна) */
  totalProductionCost: number;
  /** «Всего расходов без монтажа» = windowsExpensesTotal + extrasCostTotal */
  expensesWithoutMounting: number;
  /** Розница без монтажа = windowsRetailTotal + extrasRetailTotal */
  totalRetailNoMounting: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Константы
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Типы
// ─────────────────────────────────────────────────────────────────────────────

interface WindowRow {
  id: number;
  index: number;
  name: string;
  material: string;
  geometry: WindowGeometry;
  finance: WindowFinance | null;
  extrasItems: ServiceItem[];
  fastenerPoints: FastenerPointsResult;
  item: WindowItem;
}

// ─────────────────────────────────────────────────────────────────────────────
// Форматирование
// ─────────────────────────────────────────────────────────────────────────────

function getMaterialLabel(m: string): string {
  return ({ PVC_700: 'ПВХ 700', TINTED: 'Тонировка', TPU: 'TPU', MOSQUITO: 'Москитка' } as Record<string, string>)[m] ?? m ?? '—';
}

function getFastenerLabel(t: string): string {
  return ({
    eyelet_10: 'Люверс 10мм', strap: 'Ремешок', staple_pa: 'Полиам. скоба',
    staple_metal: 'Металл. скоба', french_lock: 'Фр. скоба', none: '—',
  } as Record<string, string>)[t] ?? t ?? '—';
}

function fCm(v: number): string {
  return Number.isFinite(v) ? `${v.toFixed(0)} см` : '—';
}

function fM(vcm: number): string {
  return Number.isFinite(vcm) ? `${(vcm / 100).toFixed(2)} м` : '—';
}

function fRub(v: number): string {
  return Number.isFinite(v) ? `${Math.round(v).toLocaleString('ru-RU')} ₽` : '—';
}

// ─────────────────────────────────────────────────────────────────────────────
// Построение строки
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Строит Map<windowId, WindowGeometrySnapshot> из GeometrySnapshotV1.
 * Возвращает null если snapshot отсутствует, невалиден или пустой.
 * Используется в buildRow и orderSummary для frozen orders.
 */
function buildSnapshotMap(
  snapshot: GeometrySnapshotV1 | null | undefined,
): Map<number, WindowGeometrySnapshot> | null {
  if (!snapshot || snapshot.version !== '1.0' || !snapshot.windows) return null;

  const map = new Map<number, WindowGeometrySnapshot>();

  for (const [key, entry] of Object.entries(snapshot.windows)) {
    const windowId = Number(key);
    if (!Number.isFinite(windowId)) continue;
    map.set(windowId, entry);
  }

  return map.size > 0 ? map : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Построение строки
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Строит WindowRow для одного изделия.
 *
 * snapshotEntry (опционально) — для frozen orders.
 * При наличии:
 *   — engine-dependent geo поля (rollWidth, cutWidth, cutHeight, isRotated,
 *     productionArea, retailArea, perimeterWithKant, cutArea, wasteArea, isOverSize)
 *     берутся из snapshot.
 *   — display-only поля (maxWidth, maxHeight, areaWithKant, type, sideTop/Left/Right,
 *     kantAreaInProduct, kantWasteArea, kantTotalArea, isExact) остаются live —
 *     они не зависят от ROLL_WIDTHS/SOLDER_ALLOWANCE и всегда корректны.
 *   — calculateWindowFinance получает precomputedGeo из snapshot.
 * При отсутствии: поведение идентично прежнему (live geometry).
 */
function buildRow(
  item: WindowItem,
  index: number,
  pm: PriceMap | null,
  snapshotEntry?: WindowGeometrySnapshot,
): WindowRow {
  const liveGeometry = calculateWindowGeometry(item);

  const geometry: WindowGeometry = snapshotEntry
    ? {
        ...liveGeometry,
        rollWidth:         snapshotEntry.rollWidth,
        cutWidth:          snapshotEntry.cutWidth,
        cutHeight:         snapshotEntry.cutHeight,
        isRotated:         snapshotEntry.isRotated,
        productionArea:    snapshotEntry.productionArea,
        retailArea:        snapshotEntry.retailArea,
        perimeterWithKant: snapshotEntry.perimeterWithKant,
        cutArea:           snapshotEntry.cutArea,
        wasteArea:         snapshotEntry.wasteArea,
        isOverSize:        snapshotEntry.isOverSize,
      }
    : liveGeometry;

  // Explicit pick — только 7 финансово-значимых полей для calculateWindowFinance.
  const financialGeo: FinancialGeometrySnapshot | undefined = snapshotEntry
    ? {
        rollWidth:         snapshotEntry.rollWidth,
        cutWidth:          snapshotEntry.cutWidth,
        cutHeight:         snapshotEntry.cutHeight,
        isRotated:         snapshotEntry.isRotated,
        productionArea:    snapshotEntry.productionArea,
        retailArea:        snapshotEntry.retailArea,
        perimeterWithKant: snapshotEntry.perimeterWithKant,
      }
    : undefined;

  const finance = pm ? calculateWindowFinance(item, pm, financialGeo) : null;
  const extrasItems = pm ? calculateExtrasAsServiceItems(item, pm, index) : [];
  const fastenerPoints = calculateFastenerPoints(item);
  return { id: item.id, index, name: item.name, material: item.material || 'PVC_700', geometry, finance, extrasItems, fastenerPoints, item };
}

// ─────────────────────────────────────────────────────────────────────────────
// Divider section helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Результат расчёта одной секции-полосы (divider strip).
 * Используется в orderSummary для учёта раскроя разделительных секций.
 */
interface DividerStrip {
  rollWidth:   number;  // см  — ширина рулона для этой секции
  stripLength: number;  // см  — длина отреза вдоль рулона (isRotated=false)
  cutArea:     number;  // м²  — площадь списания
  wasteArea:   number;  // м²  — перерасход
  batchKey:    string;  // `${material}_${rollWidth}`
}

/**
 * Находит рулон для ширины секции без поворота (isRotated=false принудительно).
 *
 * Пояснение: припой у разделителя — вдоль рулона, поворот запрещён.
 * MOSQUITO: вызывается только из calcDividerStrips, который уже фильтрует москитку.
 */
function findRollNoRotation(
  sectionWidth: number,
  material: string,
): { rollWidth: number } {
  const prodW = sectionWidth + SOLDER_ALLOWANCE;
  const rolls = [...(ROLL_WIDTHS[material] ?? ROLL_WIDTHS['PVC_700'])].sort((a, b) => a - b);
  const roll  = rolls.find(r => (prodW - SMART_TOLERANCE) <= r);
  return { rollWidth: roll ?? rolls[rolls.length - 1] };
}

/**
 * Строит массив DividerStrip для одного WindowRow.
 *
 * Разделитель делит изделие на секции. Каждая секция раскраивается
 * из рулона отдельно с isRotated=false (припой идёт вдоль рулона).
 *
 * Вертикальные разделители → делят maxWidth на секции по X.
 * Горизонтальные разделители → делят maxHeight на секции по Y.
 *
 * Правило поворота: isRotated=false для всех материалов.
 *   PVC_700 / TPU / TINTED: запаян вдоль рулона — поворот недопустим.
 *   MOSQUITO: разделители запрещены бизнес-правилом → пустой массив.
 *
 * Backward-compat: dividers=undefined или [] → пустой массив.
 */
function calcDividerStrips(row: WindowRow): DividerStrip[] {
  const dividers = row.item.additionalElements?.dividers ?? [];
  if (dividers.length === 0 || row.material === 'MOSQUITO') return [];

  const { maxWidth, maxHeight } = row.geometry;
  const material = row.material;
  const strips: DividerStrip[] = [];

  // Утилита округления до 2 знаков (площади)
  const round2 = (v: number) => Math.round(v * 100) / 100;

  // ── Вертикальные разделители → делят ширину на секции ──────────────────
  const vertDividers = dividers
    .filter(d => d.orientation === 'vertical')
    .sort((a, b) => a.position - b.position);

  if (vertDividers.length > 0) {
    // Позиции границ: [0, pos1, pos2, ..., maxWidth]
    const xBounds = [0, ...vertDividers.map(d => d.position), maxWidth];

    for (let i = 0; i < xBounds.length - 1; i++) {
      const secW = xBounds[i + 1] - xBounds[i];
      const secH = maxHeight;
      if (secW <= 0) continue;

      const { rollWidth } = findRollNoRotation(secW, material);
      const stripLength   = secH + SOLDER_ALLOWANCE;   // isRotated=false → длина по высоте
      const cutArea       = round2(rollWidth * stripLength / 10_000);
      const wasteArea     = Math.max(0, round2(cutArea - secW * secH / 10_000));

      strips.push({
        rollWidth,
        stripLength,
        cutArea,
        wasteArea,
        batchKey: `${material}_${rollWidth}`,
      });
    }
  }

  // ── Горизонтальные разделители → делят высоту на секции ────────────────
  const horizDividers = dividers
    .filter(d => d.orientation === 'horizontal')
    .sort((a, b) => a.position - b.position);

  if (horizDividers.length > 0) {
    const yBounds = [0, ...horizDividers.map(d => d.position), maxHeight];

    for (let i = 0; i < yBounds.length - 1; i++) {
      const secW = maxWidth;
      const secH = yBounds[i + 1] - yBounds[i];
      if (secH <= 0) continue;

      const { rollWidth } = findRollNoRotation(secW, material);
      const stripLength   = secH + SOLDER_ALLOWANCE;
      const cutArea       = round2(rollWidth * stripLength / 10_000);
      const wasteArea     = Math.max(0, round2(cutArea - secW * secH / 10_000));

      strips.push({
        rollWidth,
        stripLength,
        cutArea,
        wasteArea,
        batchKey: `${material}_${rollWidth}`,
      });
    }
  }

  return strips;
}

// ─────────────────────────────────────────────────────────────────────────────
// Компоненты-секции
// ─────────────────────────────────────────────────────────────────────────────

/** Заголовок коллапсируемой секции */
function SectionHeader({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) {
  return (
    <button className={styles.sectionHeader} onClick={onToggle} type="button">
      <span className={styles.sectionTitle}>{title}</span>
      <span className={styles.sectionChevron}>{open ? '▲' : '▼'}</span>
    </button>
  );
}

/** Одна строка label / value */
function Row({ label, value, variant }: { label: string; value: string; variant?: 'ok' | 'warn' | 'note' }) {
  const cls = variant === 'ok' ? styles['paramValue--ok'] : variant === 'warn' ? styles['paramValue--waste'] : variant === 'note' ? styles['paramValue--note'] : styles.paramValue;
  return (
    <div className={styles.paramRow}>
      <span className={styles.paramLabel}>{label}</span>
      <span className={cls}>{value}</span>
    </div>
  );
}

/** Строка формулы (мелким шрифтом) */
function FormulaRow({ formula }: { formula: string }) {
  return <div className={styles.formulaRow}>{formula}</div>;
}

// ── 1. Геометрия ─────────────────────────────────────────────────────────────

function GeoSection({ row }: { row: WindowRow }) {
  const g = row.geometry;
  return (
    <div className={styles.sectionBody}>
      <div className={styles.paramGrid}>
        <Row label="Внутренний размер" value={`${fCm(g.maxWidth)} × ${fCm(g.maxHeight)}`} />
        <Row label={`Заготовка (+${SOLDER_ALLOWANCE} см, ш × в)`} value={`${fCm(g.cutWidth)} × ${fCm(g.cutHeight)}`} />
        <Row label="Поворот" value={g.isRotated ? '90°' : '0°'} variant={g.isRotated ? 'warn' : 'ok'} />
        <Row label="Рулон" value={fCm(g.rollWidth)} />
        <Row label="Длина отреза по рулону" value={fM(g.isRotated ? g.cutWidth : g.cutHeight)} />
        <Row label="Производство м²" value={`${g.productionArea.toFixed(4)} м²`} />
        <Row label="Чек (Max W×H) м²" value={`${g.retailArea.toFixed(4)} м²`} variant="ok" />
        <Row label="С кантом м²" value={formatArea(g.areaWithKant)} />
        <Row label="Списание рулона" value={formatArea(g.cutArea)} variant="ok" />
        <Row label="Перерасход плёнки" value={formatArea(g.wasteArea)} variant={g.wasteArea > 0 ? 'warn' : 'ok'} />
        {g.type === 'trapezoid' && (
          <>
            <Row label="Верх sideTop" value={`${g.sideTop.toFixed(1)} см`} />
            <Row label="Лево / Право" value={`${g.sideLeft.toFixed(1)} / ${g.sideRight.toFixed(1)} см`} />
          </>
        )}
      </div>
    </div>
  );
}

// ── 2. Кант ──────────────────────────────────────────────────────────────────

function KantSection({ row, open, onToggle }: { row: WindowRow; open: boolean; onToggle: () => void }) {
  const g = row.geometry;
  const f = row.finance;
  const perimM = (g.perimeterWithKant / 100).toFixed(3);

  return (
    <div className={styles.extraSection}>
      <SectionHeader title="Кант" open={open} onToggle={onToggle} />
      {open && (
        <div className={styles.sectionBody}>
          <div className={styles.paramGrid}>
            <Row label="Периметр с кантом" value={`${perimM} м`} />
            <Row label="Ширина ленты канта" value="10 см (0.10 м)" variant="note" />
            <Row label="Кант в изделии" value={`${g.kantAreaInProduct.toFixed(3)} м²`} />
            <FormulaRow formula={`= периметр ${perimM}м × 0.10м`} />
            <Row label="Перерасход канта" value={`${g.kantWasteArea.toFixed(3)} м²`} variant="warn" />
            <FormulaRow formula="= по 30 см отхода × ширину канта × 2 слоя на каждую сторону с кантом" />
            <Row label="Кант всего" value={`${g.kantTotalArea.toFixed(3)} м²`} />
          </div>
          {f && (
            <>
              <div className={styles.divider} />
              <div className={styles.paramGrid}>
                <Row label="Цена канта за м²" value={fRub(f.kantPriceM2)} variant="note" />
                <Row label="Кант в изделии ₽" value={fRub(f.kantMaterialProductCost)} />
                <FormulaRow formula={`= ${perimM}м × 0.10м × ${fRub(f.kantPriceM2)}/м²`} />
                <Row label="Перерасход канта ₽" value={fRub(f.kantLaborCost)} variant="warn" />
                <Row label="Кант всего ₽" value={fRub(f.kantMaterialCost)} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── 3. Крепёж ────────────────────────────────────────────────────────────────

function FastenerSection({ row, open, onToggle }: { row: WindowRow; open: boolean; onToggle: () => void }) {
  const ft = row.item.fasteners;
  const f = row.finance;
  const fp = row.fastenerPoints;

  if (!ft || ft.type === 'none') return null;

  const { sides } = ft;
  const hasDefaultTop = sides.top === 'default';

  // Стороны основного типа крепежа (top=true, bottom/left/right=true)
  const mainSideRows = ([
    { key: 'top', label: 'Верх' },
    { key: 'bottom', label: 'Низ' },
    { key: 'left', label: 'Лево' },
    { key: 'right', label: 'Право' },
  ] as const).filter(({ key }) => sides[key] === true);

  return (
    <div className={styles.extraSection}>
      <SectionHeader title={`Крепёж — ${getFastenerLabel(ft.type)}`} open={open} onToggle={onToggle} />
      {open && (
        <div className={styles.sectionBody}>
          {/* Счётчики точек */}
          <div className={styles.paramGrid}>
            <Row label="Тип" value={getFastenerLabel(ft.type)} />
            {ft.finish && <Row label="Отделка" value={ft.finish} />}
            <Row label="Основной крепёж" value={`${fp.mainFastenerPointsCount} шт.`} />
            {hasDefaultTop && fp.defaultTopEyeletPointsCount > 0 && (
              <Row label="Верх Ø10" value={`${fp.defaultTopEyeletPointsCount} шт.`} variant="note" />
            )}
            <Row label="Физических точек всего" value={`${fp.uniqueTotalPhysicalPoints} шт.`} variant="ok" />
          </div>

          {/* Производственная разбивка по сторонам */}
          {mainSideRows.length > 0 && (
            <>
              <div className={styles.stepHeading}>Производственная разбивка по сторонам (≤40 см):</div>
              <div className={styles.formulaRow}>
                Физические точки на стороне, включая угловые.
                Для финансового учёта — строка «Основной крепёж» выше.
              </div>
              <div className={styles.stepGrid}>
                {mainSideRows.map(({ key, label }) => {
                  const count = fp.coveragePointsBySide[key];
                  const spacing = fp.actualSpacingBySide[key];
                  const wl = fp.workingLengths[key];
                  const intv = fp.intervalsBySide[key];
                  if (count === null) return null;
                  return (
                    <div key={key} className={styles.stepRow}>
                      <span className={styles.stepLabel}>{label}:</span>
                      <span className={styles.stepValue}>
                        {count} шт × <b>{spacing !== null ? spacing.toFixed(1) : '—'} см</b>
                      </span>
                      <span className={styles.stepFormula}>
                        ({wl !== null ? wl.toFixed(0) : '—'} ÷ {intv ?? '—'})
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Шаг для верха Ø10 — отдельно от основного типа */}
          {hasDefaultTop && fp.defaultTopEyeletPointsCount > 0 && (
            <>
              <div className={styles.stepHeading}>Шаг — верх Ø10 (≤40 см):</div>
              <div className={styles.stepGrid}>
                <div className={styles.stepRow}>
                  <span className={styles.stepLabel}>Верх Ø10:</span>
                  <span className={styles.stepValue}>
                    {fp.defaultTopEyeletPointsCount} шт ×{' '}
                    <b>{fp.actualSpacingBySide.top !== null ? fp.actualSpacingBySide.top.toFixed(1) : '—'} см</b>
                  </span>
                  <span className={styles.stepFormula}>
                    ({fp.workingLengths.top !== null ? fp.workingLengths.top.toFixed(0) : '—'} ÷ {fp.intervalsBySide.top ?? '—'})
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Финансовые строки — источник finance, не меняется */}
          {f && (
            <>
              <div className={styles.divider} />
              <div className={styles.paramGrid}>
                <Row label="Розница крепёж" value={fRub(f.fastenersRetail)} variant="ok" />
                <Row label="Себес крепёж" value={fRub(f.fastenersCost)} />
                <Row label="ЗП пробивка" value={fRub(f.fastenersWork)} />
                <FormulaRow formula="= периметр активных сторон (м) × c_produc_fasteners_per_meter" />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── 4. Допы ──────────────────────────────────────────────────────────────────

function ExtrasSection({ row, open, onToggle }: { row: WindowRow; open: boolean; onToggle: () => void }) {
  // siMap строится до любых return — правило хуков (hooks must not follow early returns).
  // useMemo здесь не нужен: buildRow уже мемоизирован на уровне родителя,
  // extrasItems меняется только при пересчёте всей строки.
  const siMap: Record<string, ServiceItem> = {};
  row.extrasItems.forEach(si => { siMap[si.id] = si; });

  const ae = row.item.additionalElements;
  if (!ae) return null;

  // Safe destructuring: legacy-записи могут не иметь поля straps совсем.
  const { zippers = [], dividers = [], cutouts = [], welding = [], hasSkirt = false, hasWeight = false, skirtWidth = 0 } = ae;
  const strapsCount = ae.straps?.count ?? 0;
  const strapsType = ae.straps?.type ?? 'grommet';

  const outerBottomM = getOuterBottomCm(row.item) / 100;
  const f = row.finance;

  const hasAny = strapsCount > 0 || zippers.length > 0 || hasSkirt || hasWeight ||
    dividers.length > 0 || cutouts.length > 0 || welding.length > 0;
  if (!hasAny) return null;

  const totalRetail = row.extrasItems.reduce((s, i) => s + i.totalRetail, 0);
  const totalCost = row.extrasItems.reduce((s, i) => s + i.totalCost, 0);

  function PriceSpan({ slug }: { slug: string }) {
    const si = siMap[slug];
    if (!si || !row.finance) return null;
    return (
      <span className={styles.extraItemPrice}>
        {fRub(si.totalRetail)} / {fRub(si.totalCost)}
      </span>
    );
  }

  return (
    <div className={styles.extraSection}>
      <SectionHeader title={`Допы (${row.extrasItems.length})`} open={open} onToggle={onToggle} />
      {open && (
        <div className={styles.sectionBody}>
          <div className={styles.extrasList}>

            {strapsCount > 0 && (
              <div className={styles.extraItem}>
                <span className={styles.extraItemIcon}>⊙</span>
                <span className={styles.extraItemLabel}>
                  Стяжки {strapsCount} шт ({strapsType === 'fastex' ? 'фастекс' : 'люверс'})
                </span>
                <PriceSpan slug={`${strapsType === 'fastex' ? 'strap_fastex' : 'strap_grommet'}-w${row.item.id}`} />
              </div>
            )}

            {zippers.map((z, i) => (
              <div key={z.id} className={styles.extraItem}>
                <span className={styles.extraItemIcon}>↕</span>
                <span className={styles.extraItemLabel}>
                  Молния #{i + 1} ({z.orientation === 'horizontal' ? 'горизонт.' : 'вертик.'})
                </span>
                <PriceSpan slug={`zipper-w${row.item.id}-${z.id}`} />
              </div>
            ))}

            {hasSkirt && (
              <div className={styles.extraItem}>
                <span className={styles.extraItemIcon}>▬</span>
                <span className={styles.extraItemLabel}>
                  Юбка {outerBottomM.toFixed(2)} м.п.{skirtWidth > 0 ? ` (ш. ${skirtWidth} см)` : ''}
                </span>
                <PriceSpan slug={`skirt-w${row.item.id}`} />
              </div>
            )}

            {hasWeight && (
              <div className={styles.extraItem}>
                <span className={styles.extraItemIcon}>≡</span>
                <span className={styles.extraItemLabel}>
                  Утяжелитель {outerBottomM.toFixed(2)} м.п.
                </span>
                <PriceSpan slug={`weight-w${row.item.id}`} />
              </div>
            )}

            {dividers.map((d, i) => (
              <div key={d.id} className={styles.extraItem}>
                <span className={styles.extraItemIcon}>│</span>
                <span className={styles.extraItemLabel}>
                  Разделитель #{i + 1} ({d.orientation === 'horizontal' ? 'горизонт.' : 'вертик.'})
                  {d.width > 0 ? ` ш.${d.width}см` : ''}
                </span>
                <PriceSpan slug={`divider-w${row.item.id}-${d.id}`} />
              </div>
            ))}

            {cutouts.map((c, i) => (
              <div key={c.id} className={styles.extraItem}>
                <span className={styles.extraItemIcon}>{c.type === 'cut' ? '□' : '◪'}</span>
                <span className={styles.extraItemLabel}>
                  {c.type === 'cut' ? 'Вырез' : 'Заплатка'} #{i + 1}
                  {c.width > 0 && c.height > 0 ? ` ${c.width}×${c.height}см` : ''}
                </span>
                <PriceSpan slug={`${c.type}-w${row.item.id}-${c.id}`} />
              </div>
            ))}

            {welding.map((w, i) => (
              <div key={w.id} className={styles.extraItem}>
                <span className={styles.extraItemIcon}>⌇</span>
                <span className={styles.extraItemLabel}>
                  Техпайка #{i + 1} ({w.orientation === 'horizontal' ? 'горизонт.' : 'вертик.'})
                </span>
                <PriceSpan slug={`welding-w${row.item.id}-${w.id}`} />
              </div>
            ))}
          </div>

          {/* ЗП допы */}
          {f && f.extrasWorkCost > 0 && (
            <div className={styles.extraWorkRow}>
              <span className={styles.paramLabel}>ЗП допы:</span>
              <span className={styles.paramValue}>{fRub(f.extrasWorkCost)}</span>
            </div>
          )}

          {/* Итого допы */}
          {row.extrasItems.length > 0 && (
            <div className={styles.extrasTotals}>
              <div className={styles.paramRow}>
                <span className={styles.paramLabel}>Итого допы — розница:</span>
                <span className={styles['paramValue--ok']}>{fRub(totalRetail)}</span>
              </div>
              <div className={styles.paramRow}>
                <span className={styles.paramLabel}>Себес материал:</span>
                <span className={styles.paramValue}>{fRub(totalCost)}</span>
              </div>
              {f && (
                <div className={styles.paramRow}>
                  <span className={styles.paramLabel}>ЗП монтаж:</span>
                  <span className={styles.paramValue}>{fRub(f.extrasWorkCost)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 5. Себестоимость ─────────────────────────────────────────────────────────

function FinanceSection({ row, open, onToggle }: { row: WindowRow; open: boolean; onToggle: () => void }) {
  const f = row.finance;
  if (!f) return null;
  const g = row.geometry;

  // ── Агрегаты допов этого окна ─────────────────────────────────────────────
  // Берём из row.extrasItems — те же данные, что useCalculationState суммирует
  // в extrasCostTotal / extrasRetailTotal по всем окнам.
  const extrasWindowCost = row.extrasItems.reduce((s, i) => s + i.totalCost, 0);
  const extrasWindowRetail = row.extrasItems.reduce((s, i) => s + i.totalRetail, 0);

  // ── Полный итог по окну (соответствует полям ClientStep) ──────────────────
  //
  // windowDisplayCost  → вклад в «Стоимость изделия» ClientStep
  //   = costPrice + fastenersCost + extrasCostWindow
  //
  // windowTotalExpenses → вклад в «Всего расходов» ClientStep
  //   = finance.totalExpenses (film+kant+waste+production+fasteners)
  //   + extrasCostWindow (материал допов)
  //
  // windowRetailFull → вклад в «Итого розница» ClientStep
  //   = finance.retailPrice (изделие+крепёж)
  //   + extrasWindowRetail (допы розница)
  //
  // finance.totalExpenses уже содержит overspending, productionCost, fastenersCost.
  // extrasCostWindow — единственное, что не входило в finance.totalExpenses.
  const windowDisplayCost = f.costPrice + f.fastenersCost + extrasWindowCost;
  const windowTotalExpenses = f.totalExpenses + extrasWindowCost;
  const windowRetailFull = f.retailPrice + extrasWindowRetail;
  const windowProfit = windowRetailFull - windowTotalExpenses;

  return (
    <div className={styles.extraSection}>
      <SectionHeader title="Себестоимость изделия" open={open} onToggle={onToggle} />
      {open && (
        <div className={styles.sectionBody}>
          <div className={styles.paramGrid}>

            {/* Материал */}
            <div className={styles.subHeading}>Плёнка</div>
            <Row label="Цена за м²" value={fRub(f.materialPriceM2)} variant="note" />
            <Row label="Площадь в изделии" value={`${(g.cutWidth * g.cutHeight / 10000).toFixed(4)} м²`} />
            <FormulaRow formula={`= заготовка ${fCm(g.cutWidth)} × ${fCm(g.cutHeight)} / 10000`} />
            <Row label="Плёнка в изделии" value={fRub(f.materialInProductCost)} />
            <Row label="Списание рулона (вся полоса)" value={fRub(f.materialCutCost)} />
            <Row label="Перерасход (плёнка + кант + молнии)" value={fRub(f.overspending)} variant="warn" />
            <FormulaRow formula="= остаток рулона × цена + обрезки канта × цена + 30 см × кол-во молний" />

            {/* Кант */}
            <div className={styles.subHeading}>Кант</div>
            <Row label="Кант в изделии" value={fRub(f.kantMaterialProductCost)} />
            <Row label="Перерасход канта" value={fRub(f.kantLaborCost)} variant="warn" />
            <Row label="Кант всего" value={fRub(f.kantMaterialCost)} />

            {/* Работа */}
            <div className={styles.subHeading}>Работа цеха</div>
            <Row label="ЗП базовая" value={fRub(f.baseProductionCost)} />
            <FormulaRow formula={`= ${g.productionArea.toFixed(4)} м² × c_produc_1`} />
            <Row label="ЗП крепёж" value={fRub(f.fastenersWork)} />
            <Row label="ЗП допы" value={fRub(f.extrasWorkCost)} />

            {/* Крепёж материал */}
            <div className={styles.subHeading}>Крепёж (материал)</div>
            <Row label="Себес крепёж" value={fRub(f.fastenersCost)} />

            {/* Итог pricingLogic (без допов-материала) */}
            <div className={styles.divider} />
            <Row label="costPrice (плёнка + кант)" value={fRub(f.costPrice)} />
            <Row label="totalExpenses (без допов-материала)" value={fRub(f.totalExpenses)} variant="warn" />
            <FormulaRow formula="= costPrice + overspending + productionCost + fastenersCost" />
            <Row label="Розница изделия (без допов)" value={fRub(f.retailPrice)} variant="ok" />
          </div>

          {/* ── ВКЛАД ОКНА В ИТОГ ЗАКАЗА ──────────────────────────────────── */}
          {/* Показывает, что именно это окно добавляет в суммы ClientStep.     */}
          {/* Полная сверка с ClientStep находится ниже — после всех карточек.  */}
          <div className={styles.fullTotalsBlock}>
            <div className={styles.fullTotalsHeading}>▶ Вклад окна в итог заказа</div>
            <div className={styles.paramGrid}>
              <div className={styles.subHeading}>Вклад в «Стоимость изделия» (ClientStep)</div>
              <Row label="Плёнка + кант (costPrice)" value={fRub(f.costPrice)} />
              <Row label="Крепёж материал" value={fRub(f.fastenersCost)} />
              <Row label="Допы материал" value={fRub(extrasWindowCost)} />
              <Row
                label="= Итого вклад"
                value={fRub(windowDisplayCost)}
                variant="ok"
              />
              <FormulaRow formula="costPrice + fastenersCost + extrasCostWindow" />

              <div className={styles.divider} />
              <div className={styles.subHeading}>Вклад в «Всего расходов без монтажа»</div>
              <Row label="totalExpenses окна" value={fRub(f.totalExpenses)} />
              <FormulaRow formula="= costPrice + overspending + productionCost + fastenersCost" />
              <Row label="+ допы материал" value={fRub(extrasWindowCost)} />
              <Row
                label="= Итого вклад в расходы"
                value={fRub(windowTotalExpenses)}
                variant="warn"
              />

              <div className={styles.divider} />
              <div className={styles.subHeading}>Вклад в розницу и прибыль</div>
              <Row label="Розница изделия" value={fRub(f.retailPrice)} />
              <Row label="+ допы розница" value={fRub(extrasWindowRetail)} />
              <Row
                label="= Розница окна полная"
                value={fRub(windowRetailFull)}
                variant="ok"
              />
              <Row
                label="Прибыль окна"
                value={fRub(windowProfit)}
                variant={windowProfit >= 0 ? 'ok' : 'warn'}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Order-level reconciliation row
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Одна строка сверки заказа.
 * OK = |clientVal - diagVal| ≤ 1 ₽ (допуск на Math.round в pricingLogic).
 */
function OrderReconcileRow({
  label, hint, clientVal, diagVal,
}: {
  label: string;
  hint: string;
  clientVal: number;
  diagVal: number;
}) {
  const isOk = Math.abs(clientVal - diagVal) <= 1;
  return (
    <div className={styles.orderReconcileRow}>
      <span className={styles.orcLabel}>
        {label}
        <span className={styles.orcHint}>{hint}</span>
      </span>
      <span className={styles.orcClientVal}>{fRub(clientVal)}</span>
      <span className={styles.orcDiagVal}>{fRub(diagVal)}</span>
      <span className={isOk ? styles['orcStatus--ok'] : styles['orcStatus--mismatch']}>
        {isOk ? '✓ OK' : '✗ ΔΔΔΔ'}
      </span>
      {!isOk && (
        <div className={styles.orcMismatchNote}>
          Δ {fRub(Math.abs(clientVal - diagVal))}
          {' '}({clientVal > diagVal ? 'ClientStep больше' : 'CuttingDiag больше'})
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Пропсы и состояние коллапсов
// ─────────────────────────────────────────────────────────────────────────────

interface CuttingDiagnosticsProps {
  windows: WindowItem[];
  priceMap?: PriceMap;
  /**
   * Агрегаты из useCalculationState (уровень заказа).
   * Опционально — без них блок сверки скрыт (backward compat).
   */
  orderTotals?: OrderTotals;
  /**
   * Снапшот геометрии из Client.geometrySnapshot.
   * Присутствует только для frozen orders (completed/rejected/isPriceLocked).
   * При наличии — geometry и orderSummary строятся из snapshot,
   * а не из live calculateWindowGeometry. Закрывает BUG-8A-02 для display.
   * При отсутствии (null/undefined) — поведение как прежде (live geometry).
   */
  geometrySnapshot?: GeometrySnapshotV1 | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Компонент
// ─────────────────────────────────────────────────────────────────────────────

export default function CuttingDiagnostics({ windows, priceMap, orderTotals, geometrySnapshot }: CuttingDiagnosticsProps) {
  const pm = priceMap && Object.keys(priceMap).length > 0 ? priceMap : null;

  // Глобальные переключатели секций (одно состояние на всё)
  const [openKant, setOpenKant] = useState(false);
  const [openFastener, setOpenFastener] = useState(false);
  const [openExtras, setOpenExtras] = useState(false);
  const [openFinance, setOpenFinance] = useState(false);

  // Snapshot map — строится один раз при изменении geometrySnapshot.
  // Null для active orders и frozen orders без snapshot (старые записи).
  const snapshotMap = useMemo(
    () => buildSnapshotMap(geometrySnapshot),
    [geometrySnapshot],
  );

  const rows = useMemo(
    () => windows.map((item, i) => buildRow(item, i, pm, snapshotMap?.get(item.id))),
    [windows, pm, snapshotMap],
  );

  // orderSummary строится из уже snapshot-aware rows, а не через
  // calculateOrderOptimization(windows). Это гарантирует, что batch-группировка,
  // погонаж, totalCutArea и totalWasteArea совпадают с историческим раскроем
  // для frozen orders при любых последующих изменениях ROLL_WIDTHS.
  // Алгоритм идентичен calculateOrderOptimization — только источник geometry другой.
  // BUG-8A-01 (widthTop вместо maxW для rotated трапеций) намеренно сохранён.
  //
  // Разделители (dividers): окна с разделителями раскраиваются по секциям.
  // Для таких окон cutArea/wasteArea/totalLength берётся из calcDividerStrips
  // (live для всех заказов, т.к. divider-секции в snapshot не хранятся).
  // Финансы (finance) при этом НЕ меняются — они snapshot-aware через buildRow.
  const orderSummary = useMemo((): OrderOptimization => {
    if (rows.length === 0) {
      return { totalCutArea: 0, totalWasteArea: 0, batches: [] };
    }

    const batchMap: Record<string, {
      material: string;
      rollWidth: number;
      totalLength: number;
      windowIds: number[];
    }> = {};

    let totalCutArea   = 0;
    let totalWasteArea = 0;

    // ── Основной цикл: snapshot-aware ──────────────────────────────────────
    for (const row of rows) {
      const geo = row.geometry;
      const key = `${row.material}_${geo.rollWidth}`;

      if (!batchMap[key]) {
        batchMap[key] = {
          material:    row.material,
          rollWidth:   geo.rollWidth,
          totalLength: 0,
          windowIds:   [],
        };
      }

      // windowId всегда фиксируется — для идентификации изделия в группе.
      batchMap[key].windowIds.push(row.id);

      // Изделия с разделителями: totalLength/cutArea/wasteArea считаются
      // через секции ниже. Основной вклад пропускаем во избежание двойного учёта.
      const hasDividers =
        (row.item.additionalElements?.dividers ?? []).length > 0 &&
        row.material !== 'MOSQUITO';

      if (!hasDividers) {
        // Оригинальная логика — snapshot-aware. BUG-8A-01 намеренно сохранён.
        const length = geo.isRotated
          ? (Number(row.item.widthTop) + SOLDER_ALLOWANCE)
          : (Math.max(Number(row.item.heightLeft), Number(row.item.heightRight)) + SOLDER_ALLOWANCE);

        batchMap[key].totalLength += length;
        totalCutArea   += geo.cutArea;
        totalWasteArea += geo.wasteArea;
      }
    }

    // ── Divider-секции: всегда live ─────────────────────────────────────────
    // Для каждого изделия с разделителями строим отдельные полосы-секции.
    // Их cutArea/wasteArea/totalLength заменяет вклад основного изделия выше.
    // MOSQUITO: calcDividerStrips вернёт [] по своему guard-у.
    for (const row of rows) {
      const strips = calcDividerStrips(row);
      if (strips.length === 0) continue;

      for (const strip of strips) {
        if (!batchMap[strip.batchKey]) {
          batchMap[strip.batchKey] = {
            material:    row.material,
            rollWidth:   strip.rollWidth,
            totalLength: 0,
            windowIds:   [],
          };
        }
        batchMap[strip.batchKey].totalLength += strip.stripLength;
        totalCutArea   += strip.cutArea;
        totalWasteArea += strip.wasteArea;
      }
    }

    return {
      totalCutArea,
      totalWasteArea,
      batches: Object.values(batchMap),
    };
  }, [rows]);

  // ── Агрегаты CuttingDiagnostics — сумма по всем окнам ───────────────────
  // Используются для сверки с orderTotals (значения из useCalculationState).
  // Вычисляются только при наличии priceMap (иначе finance = null).
  const diagTotals = useMemo(() => {
    if (!pm) return null;

    const sumCostPrice = rows.reduce((s, r) => s + (r.finance?.costPrice ?? 0), 0);
    const sumFastenersCost = rows.reduce((s, r) => s + (r.finance?.fastenersCost ?? 0), 0);
    const sumOverspending = rows.reduce((s, r) => s + (r.finance?.overspending ?? 0), 0);
    const sumProductionCost = rows.reduce((s, r) => s + (r.finance?.productionCost ?? 0), 0);
    const sumTotalExpenses = rows.reduce((s, r) => s + (r.finance?.totalExpenses ?? 0), 0);
    const sumRetailPrice = rows.reduce((s, r) => s + (r.finance?.retailPrice ?? 0), 0);

    const sumExtrasCost = rows.reduce((s, r) =>
      s + r.extrasItems.reduce((es, i) => es + i.totalCost, 0), 0);
    const sumExtrasRetail = rows.reduce((s, r) =>
      s + r.extrasItems.reduce((es, i) => es + i.totalRetail, 0), 0);

    return {
      // clientProductCostDisplay =
      //   Σ costPrice + Σ fastenersCost + Σ extrasCost
      //   → соответствует ClientStep «Стоимость изделия»
      clientProductCostDisplay: sumCostPrice + sumFastenersCost + sumExtrasCost,
      totalOverspending: sumOverspending,
      totalProductionCost: sumProductionCost,
      // expensesWithoutMounting =
      //   Σ finance.totalExpenses + Σ extrasCost
      //   → соответствует ClientStep «Всего расходов без монтажа»
      expensesWithoutMounting: sumTotalExpenses + sumExtrasCost,
      totalRetailNoMounting: sumRetailPrice + sumExtrasRetail,
    };
  }, [rows, pm]);

  return (
    <div className={styles.root}>
      <h4 className={styles.heading}>План раскроя заказа</h4>

      <div className={styles.description}>
        Геометрия — <b>calculateWindowGeometry()</b> / Финансы — <b>calculateWindowFinance()</b>
        <br />
        <b>Производство</b> — реальная площадь.{' '}
        <b>Чек</b> — MaxW × MaxH (розничная цена).
        {pm && ' Розница / Себес в разделах ниже.'}
      </div>

      {/* Карточки изделий */}
      <div className={styles.batchList}>
        {rows.map((row) => (
          <div
            key={row.id}
            className={row.geometry.isOverSize ? `${styles.windowCard} ${styles['windowCard--oversize']}` : styles.windowCard}
          >
            {/* Шапка */}
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>
                Окно {row.index + 1}: {row.name}
                {row.geometry.type === 'trapezoid' && (
                  <span style={{ color: '#FFD600', marginLeft: 6, fontSize: '0.65rem' }}>◆ трапеция</span>
                )}
              </span>
              <span className={styles.cardMaterial}>
                {getMaterialLabel(row.material)} / рулон {row.geometry.rollWidth} см
              </span>
            </div>

            {/* Геометрия — всегда видна */}
            <GeoSection row={row} />

            {/* Предупреждения */}
            {(row.geometry.isOverSize || !row.geometry.isExact) && (
              <div className={styles.warnings}>
                {row.geometry.isOverSize && <div className={styles.warnOversize}>⚠ Негабарит: алгоритм берёт максимальный рулон.</div>}
                {!row.geometry.isExact && <div className={styles.warnApprox}>⚠ Приближённый расчёт: данных crossbar нет.</div>}
              </div>
            )}

            {/* Кант */}
            <KantSection row={row} open={openKant} onToggle={() => setOpenKant(v => !v)} />
            {/* Крепёж */}
            <FastenerSection row={row} open={openFastener} onToggle={() => setOpenFastener(v => !v)} />
            {/* Допы */}
            <ExtrasSection row={row} open={openExtras} onToggle={() => setOpenExtras(v => !v)} />
            {/* Себестоимость */}
            <FinanceSection row={row} open={openFinance} onToggle={() => setOpenFinance(v => !v)} />
          </div>
        ))}
      </div>

      {/* ── СВЕРКА ЗАКАЗА: ClientStep vs CuttingDiagnostics ───────────────── */}
      {/* Показывается один раз после всех карточек окон.                      */}
      {/* Сравнивает значения useCalculationState (orderTotals) с суммой       */}
      {/* per-window расчётов CuttingDiagnostics (diagTotals).                 */}
      {/* OK = разница ≤ 1 ₽ (допуск округления Math.round).                  */}
      {orderTotals && diagTotals && (
        <div className={styles.orderReconcileBlock}>
          <div className={styles.orderReconcileHeading}>
            ⚡ Сверка заказа — ClientStep vs CuttingDiagnostics
          </div>
          <div className={styles.orderReconcileSubtitle}>
            Левый столбец: значения из useCalculationState (те же, что видит «Прибыль и расход»).
            Правый: Σ всех окон из CuttingDiagnostics.
          </div>
          <div className={styles.orderReconcileTable}>
            <div className={styles.orderReconcileHeaderRow}>
              <span className={styles.orcLabel}>Поле</span>
              <span className={styles.orcClientVal}>ClientStep</span>
              <span className={styles.orcDiagVal}>CuttingDiag</span>
              <span className={styles.orcStatus}>Статус</span>
            </div>
            <OrderReconcileRow
              label="Стоимость изделия"
              hint="costPrice + fasteners + extras"
              clientVal={orderTotals.clientProductCostDisplay}
              diagVal={diagTotals.clientProductCostDisplay}
            />
            <OrderReconcileRow
              label="Перерасход"
              hint="Σ overspending всех окон"
              clientVal={orderTotals.totalOverspending}
              diagVal={diagTotals.totalOverspending}
            />
            <OrderReconcileRow
              label="Изготовление"
              hint="Σ productionCost всех окон"
              clientVal={orderTotals.totalProductionCost}
              diagVal={diagTotals.totalProductionCost}
            />
            <OrderReconcileRow
              label="Всего расходов без монтажа"
              hint="windowsExpenses + extrasCost"
              clientVal={orderTotals.expensesWithoutMounting}
              diagVal={diagTotals.expensesWithoutMounting}
            />
            <OrderReconcileRow
              label="Розница без монтажа"
              hint="windowsRetail + extrasRetail"
              clientVal={orderTotals.totalRetailNoMounting}
              diagVal={diagTotals.totalRetailNoMounting}
            />
          </div>
        </div>
      )}

      {/* Сводка групп раскроя */}
      <div className={styles.groupsHeading}>Группы раскроя</div>
      {orderSummary.batches.length > 0 ? (
        <div className={styles.batchList}>
          {orderSummary.batches.map((batch, idx) => (
            <div key={`${batch.material}-${batch.rollWidth}-${idx}`} className={styles.groupCard}>
              <div className={styles.groupHeader}>
                <span className={styles.groupMaterial}>{getMaterialLabel(batch.material)}</span>
                <span className={styles.groupRoll}>{batch.rollWidth} см</span>
              </div>
              <div className={styles.groupStats}>
                <div className={styles.groupStatRow}>
                  <span className={styles.groupStatLabel}>Длина:</span>
                  <span className={styles.groupStatValue}>{(batch.totalLength / 100).toFixed(2)} м.п.</span>
                </div>
                <div className={styles.groupStatRow}>
                  <span className={styles.groupStatLabel}>ID изделий:</span>
                  <span className={styles.groupStatValue}>{batch.windowIds.join(', ')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyGroups}>Нет изделий для расчёта.</div>
      )}

      {/* Итого заказ */}
      <div className={styles.totals}>
        <div className={styles.totalRow}>
          <span>Списание всего заказа:</span>
          <span className={styles.totalValue}>{orderSummary.totalCutArea.toFixed(2)} м²</span>
        </div>
        <div className={`${styles.totalRow} ${styles['totalRow--waste']}`}>
          <span>Перерасход всего заказа:</span>
          <span>{orderSummary.totalWasteArea.toFixed(2)} м²</span>
        </div>
      </div>
    </div>
  );
}