/**
 * ЕДИНЫЙ ИСТОЧНИК ИСТИНЫ — Расчёт точек крепежа
 *
 * Производственные правила:
 *   1. Точки считаются по каждой стороне отдельно.
 *   2. Используются внешние длины сторон (inner + кант смежных сторон).
 *   3. Угловая точка располагается на пересечении центральных линий кантов:
 *      offset = kant_перпендикулярной_стороны / 2 от каждого конца стороны.
 *   4. workingLength = externalLength − offsetStart − offsetEnd.
 *   5. intervals = max(1, ceil(workingLength / 40)) → actualSpacing ≤ 40 см.
 *   6. points = intervals + 1  (fence-post rule).
 *   7. Corner ownership: top=true владеет TL и TR, bottom=true — BL и BR.
 *      top='default' (Ø10) тоже физически владеет TL и TR — вертикали не
 *      претендуют на верхние углы, если верх занят в любом режиме.
 *      Вертикали получают угол только если смежный горизонталь полностью неактивен.
 *   8. top='default' (Ø10 люверс) считается отдельно: другой тип, другая цена,
 *      не входит в mainFastenerPointsCount, но физически владеет верхними углами.
 *
 * ЗАПРЕЩЕНО:
 *   — round(side / 35)
 *   — ceil(fullPerimeter / 40)
 *   — смешивать top='default' Ø10 с основным pointsCount
 *   — давать вертикалям верхние углы при top='default'
 *
 * Геометрия: только через calculateWindowGeometry — единственное геометрическое ядро.
 * Нет React-зависимостей. Нет мутаций. Pure function.
 *
 * @module src/lib/logic/fastenerCalculations.ts
 */

import { calculateWindowGeometry } from '@/lib/logic/windowCalculations';
import { type WindowItem } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Максимально допустимый шаг между точками крепежа (см). */
const MAX_FASTENER_STEP_CM = 40;

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

/** Ключ стороны изделия. */
export type SideKey = 'top' | 'right' | 'bottom' | 'left';

/**
 * Числовое значение для каждой стороны.
 * null означает, что сторона не активна или данные неприменимы.
 */
export interface SideValues {
  top:    number | null;
  right:  number | null;
  bottom: number | null;
  left:   number | null;
}

/**
 * Владелец каждого угла изделия.
 * null — угол не принадлежит ни одной активной стороне.
 *
 * Важно: 'top' как owner устанавливается при top=true ИЛИ top='default'.
 * Это предотвращает двойной счёт угловых точек между Ø10 и вертикалями.
 */
export interface CornerOwnership {
  TL: SideKey | null; // верх-лево
  TR: SideKey | null; // верх-право
  BL: SideKey | null; // низ-лево
  BR: SideKey | null; // низ-право
}

export interface FastenerPointsResult {
  /**
   * Количество точек основного типа крепежа.
   * Это значение записывается в FastenerConfig.pointsCount.
   * Используется в pricingLogic → fastenersCost / fastenersRetail.
   * НЕ включает top='default' Ø10.
   */
  mainFastenerPointsCount: number;

  /**
   * Количество точек Ø10 люверса при top='default'.
   * Физически потребляются на производстве и должны списываться со склада,
   * но по цене fast_eyelet_cost, а не по цене основного типа.
   * Текущая архитектура (один FastenerConfig.type на всё изделие) не позволяет
   * смешивать их с основным учётом — это архитектурный долг.
   */
  defaultTopEyeletPointsCount: number;

  /**
   * Сумма всех физических уникальных точек без двойного счёта: main + defaultTopEyelet.
   * Угловые точки TL/TR при top='default' входят только в defaultTopEyelet,
   * не в mainFastenerPointsCount через вертикали.
   * Для будущего warehouse writeoff.
   */
  uniqueTotalPhysicalPoints: number;

  /**
   * Точки, физически находящиеся на каждой стороне — включая угловые,
   * принадлежащие смежным сторонам по corner ownership.
   *
   * Это то, что производственный рабочий реально пробивает на каждой стороне.
   * Использовать для: production sheet, DrawingCanvas.
   *
   * coveragePointsBySide.top:
   *   — top=true     → основной тип (rawPoints)
   *   — top='default' → Ø10 (= defaultTopEyeletPointsCount)
   *   — top=false    → null
   */
  coveragePointsBySide: SideValues;

  /**
   * Точки, принадлежащие стороне по corner ownership (без двойного счёта).
   * Σ ownedPointsBySide[side] = mainFastenerPointsCount.
   *
   * ownedPointsBySide.top = null если top='default'
   * (Ø10 не входит в основной финансовый учёт).
   */
  ownedPointsBySide: SideValues;

  /**
   * Владелец каждого угла.
   * 'top' устанавливается при topActive=true ИЛИ topDefault=true,
   * чтобы вертикали не претендовали на верхние углы в обоих случаях.
   */
  cornerOwnership: CornerOwnership;

  /**
   * Фактический шаг между точками (см) по каждой активной стороне.
   * Для top='default' — шаг Ø10 люверсов.
   * Для QA-проверки на производстве.
   */
  actualSpacingBySide: SideValues;

  /**
   * Рабочая длина (см) между центрами крайних точек по каждой стороне.
   * Промежуточный результат. Показывается для top если top=true или top='default'.
   */
  workingLengths: SideValues;

  /**
   * Количество интервалов по каждой стороне.
   * intervals = coveragePoints − 1 = rawPoints − 1.
   */
  intervalsBySide: SideValues;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeNullSides(): SideValues {
  return { top: null, right: null, bottom: null, left: null };
}

function makeZeroResult(): FastenerPointsResult {
  return {
    mainFastenerPointsCount:     0,
    defaultTopEyeletPointsCount: 0,
    uniqueTotalPhysicalPoints:   0,
    coveragePointsBySide:  makeNullSides(),
    ownedPointsBySide:     makeNullSides(),
    cornerOwnership:       { TL: null, TR: null, BL: null, BR: null },
    actualSpacingBySide:   makeNullSides(),
    workingLengths:        makeNullSides(),
    intervalsBySide:       makeNullSides(),
  };
}

interface SideCalcResult {
  intervals:      number;
  ownedPoints:    number;
  coveragePoints: number; // = intervals + 1
  actualSpacing:  number;
}

/**
 * Вычисляет параметры точек для одной стороны.
 *
 * @param workingLength  рабочая длина стороны (см)
 * @param startOwner     владелец начального угла данной стороны
 * @param endOwner       владелец конечного угла данной стороны
 * @param thisSide       ключ данной стороны для сравнения с owner
 */
function calcOneSide(
  workingLength: number,
  startOwner:    SideKey | null,
  endOwner:      SideKey | null,
  thisSide:      SideKey,
): SideCalcResult {
  const intervals      = Math.max(1, Math.ceil(workingLength / MAX_FASTENER_STEP_CM));
  const coveragePoints = intervals + 1;
  const ownedStart     = startOwner === thisSide ? 1 : 0;
  const ownedEnd       = endOwner   === thisSide ? 1 : 0;
  // max(0, ...) — защита от отрицательных значений при ownedCorners=0, intervals=1
  const ownedPoints    = Math.max(0, intervals - 1 + ownedStart + ownedEnd);
  const actualSpacing  = workingLength / intervals;

  return { intervals, ownedPoints, coveragePoints, actualSpacing };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Вычисляет количество и расположение точек крепежа для одного изделия.
 *
 * Использует calculateWindowGeometry как единственное геометрическое ядро —
 * трапеции, наклонные крыши и нестандартные формы учтены автоматически.
 *
 * Pure function: не мутирует WindowItem, не читает из БД, не зависит от React.
 *
 * @example
 * const result = calculateFastenerPoints(window);
 * // Для сохранения в FastenerConfig:
 * const pointsCount = result.mainFastenerPointsCount;
 * // Для production sheet:
 * const coverageRight = result.coveragePointsBySide.right;
 */
export function calculateFastenerPoints(window: WindowItem): FastenerPointsResult {
  const ft = window.fasteners;

  // Guard: нет крепежа или тип 'none'
  if (!ft || ft.type === 'none') return makeZeroResult();

  const sides = ft.sides;

  // ── Активность сторон ─────────────────────────────────────────────────────
  // top имеет три состояния:
  //   true      — основной тип крепежа на верхней стороне
  //   'default' — люверс Ø10 по умолчанию (другой тип, отдельный учёт)
  //   false     — верх не крепится
  const topActive    = sides.top    === true;
  const topDefault   = sides.top    === 'default';
  const bottomActive = sides.bottom === true;
  const leftActive   = sides.left   === true;
  const rightActive  = sides.right  === true;

  const hasAnyMain = topActive || bottomActive || leftActive || rightActive;
  const hasDefault = topDefault;

  if (!hasAnyMain && !hasDefault) return makeZeroResult();

  // ── Геометрия через единственное ядро ────────────────────────────────────
  // sideTop учитывает наклон верха трапеции (Пифагор в windowCalculations.ts).
  const geo = calculateWindowGeometry(window);
  const { sideTop, sideBottom, sideLeft, sideRight } = geo;
  const { kantTop, kantRight, kantBottom, kantLeft } = window;

  // ── Внешние длины сторон ──────────────────────────────────────────────────
  // Горизонтальные (top/bottom): к inner добавляем кант слева и справа.
  // Вертикальные   (left/right): к inner добавляем кант сверху и снизу.
  const extTop    = sideTop    + kantLeft + kantRight;
  const extBottom = sideBottom + kantLeft + kantRight;
  const extLeft   = sideLeft   + kantTop  + kantBottom;
  const extRight  = sideRight  + kantTop  + kantBottom;

  // ── Рабочие длины ─────────────────────────────────────────────────────────
  // Угловая точка — пересечение центральных линий двух смежных кантов.
  // Offset от каждого конца стороны = kant_перпендикулярной_стороны / 2.
  //
  //   workingTop:    kantLeft/2 от левого угла,  kantRight/2 от правого
  //   workingBottom: kantLeft/2 от левого угла,  kantRight/2 от правого
  //   workingLeft:   kantTop/2 от верхнего угла, kantBottom/2 от нижнего
  //   workingRight:  kantTop/2 от верхнего угла, kantBottom/2 от нижнего
  const workingTop    = extTop    - kantLeft  / 2 - kantRight  / 2;
  const workingBottom = extBottom - kantLeft  / 2 - kantRight  / 2;
  const workingLeft   = extLeft   - kantTop   / 2 - kantBottom / 2;
  const workingRight  = extRight  - kantTop   / 2 - kantBottom / 2;

  // ── Corner ownership ──────────────────────────────────────────────────────
  // topHasPhysicalFasteners = true если на верхней стороне ЕСТЬ физические
  // точки крепежа — в любом режиме (основной тип или Ø10 по умолчанию).
  //
  // КРИТИЧНО: при top='default' верхние углы TL/TR принадлежат Ø10 люверсам.
  // Если отдать TL/TR вертикалям при top='default', угловые точки
  // войдут в mainFastenerPointsCount И в defaultTopEyeletPointsCount —
  // двойной счёт физических точек.
  //
  // Правило:
  //   top (любой режим с физическими точками) → владеет TL и TR
  //   bottom=true                              → владеет BL и BR
  //   Вертикали получают угол только если смежный горизонталь полностью неактивен
  //   (top=false, т.е. ни true, ни 'default').
  const topHasPhysicalFasteners = topActive || topDefault;

  const co: CornerOwnership = {
    TL: topHasPhysicalFasteners ? 'top'    : leftActive  ? 'left'  : null,
    TR: topHasPhysicalFasteners ? 'top'    : rightActive ? 'right' : null,
    BL: bottomActive            ? 'bottom' : leftActive  ? 'left'  : null,
    BR: bottomActive            ? 'bottom' : rightActive ? 'right' : null,
  };

  // ── Расчёт по основным активным сторонам ─────────────────────────────────
  // top='default' НЕ передаётся в calcOneSide — считается отдельно ниже.
  // Углы каждой стороны:
  //   top:    TL (start) → TR (end)
  //   bottom: BL (start) → BR (end)
  //   left:   TL (start) → BL (end)
  //   right:  TR (start) → BR (end)
  const topCalc    = topActive    ? calcOneSide(workingTop,    co.TL, co.TR, 'top')    : null;
  const bottomCalc = bottomActive ? calcOneSide(workingBottom, co.BL, co.BR, 'bottom') : null;
  const leftCalc   = leftActive   ? calcOneSide(workingLeft,   co.TL, co.BL, 'left')   : null;
  const rightCalc  = rightActive  ? calcOneSide(workingRight,  co.TR, co.BR, 'right')  : null;

  // ── top='default' — Ø10 люверс ────────────────────────────────────────────
  // co.TL='top', co.TR='top' уже установлены через topHasPhysicalFasteners.
  // Вертикали при расчёте leftCalc/rightCalc получат startOwner/endOwner='top'
  // для верхних углов → ownedStart/ownedEnd = 0 → не засчитают эти углы.
  // Ø10 самостоятельно владеет обоими верхними углами → ownedPoints = intervals + 1.
  let defaultTopEyeletPointsCount = 0;
  let defaultIntervals:   number | null = null;
  let defaultTopSpacing:  number | null = null;

  if (hasDefault && workingTop > 0) {
    defaultIntervals            = Math.max(1, Math.ceil(workingTop / MAX_FASTENER_STEP_CM));
    defaultTopEyeletPointsCount = defaultIntervals + 1; // owns TL + TR corners
    defaultTopSpacing           = workingTop / defaultIntervals;
  }

  // ── Итоговые счётчики ─────────────────────────────────────────────────────
  const mainFastenerPointsCount =
    (topCalc?.ownedPoints    ?? 0) +
    (bottomCalc?.ownedPoints ?? 0) +
    (leftCalc?.ownedPoints   ?? 0) +
    (rightCalc?.ownedPoints  ?? 0);

  // uniqueTotalPhysicalPoints не содержит двойного счёта:
  // TL/TR при top='default' входят только в defaultTopEyelet, не в main.
  const uniqueTotalPhysicalPoints = mainFastenerPointsCount + defaultTopEyeletPointsCount;

  // ── coveragePointsBySide.top ──────────────────────────────────────────────
  // top=true     → coverage основного типа (rawPoints от calcOneSide)
  // top='default' → Ø10 coverage (defaultTopEyeletPointsCount)
  // top=false    → null
  const coverageTop =
    topCalc    != null ? topCalc.coveragePoints        :
    hasDefault         ? defaultTopEyeletPointsCount    :
    null;

  // actualSpacing и intervals для top: основной если top=true, Ø10 если top='default'
  const spacingTop   = topCalc?.actualSpacing ?? defaultTopSpacing  ?? null;
  const intervalsTop = topCalc?.intervals     ?? defaultIntervals    ?? null;

  // workingLengths.top — показываем для любого активного режима верха
  const workingLengthTop = (topActive || topDefault) ? workingTop : null;

  // ─────────────────────────────────────────────────────────────────────────
  return {
    mainFastenerPointsCount,
    defaultTopEyeletPointsCount,
    uniqueTotalPhysicalPoints,

    coveragePointsBySide: {
      top:    coverageTop,
      right:  rightCalc?.coveragePoints  ?? null,
      bottom: bottomCalc?.coveragePoints ?? null,
      left:   leftCalc?.coveragePoints   ?? null,
    },

    ownedPointsBySide: {
      // null если top='default' — Ø10 не входит в основной финансовый учёт
      top:    topCalc?.ownedPoints    ?? null,
      right:  rightCalc?.ownedPoints  ?? null,
      bottom: bottomCalc?.ownedPoints ?? null,
      left:   leftCalc?.ownedPoints   ?? null,
    },

    cornerOwnership: co,

    actualSpacingBySide: {
      top:    spacingTop,
      right:  rightCalc?.actualSpacing  ?? null,
      bottom: bottomCalc?.actualSpacing ?? null,
      left:   leftCalc?.actualSpacing   ?? null,
    },

    workingLengths: {
      top:    workingLengthTop,
      right:  rightActive  ? workingRight  : null,
      bottom: bottomActive ? workingBottom : null,
      left:   leftActive   ? workingLeft   : null,
    },

    intervalsBySide: {
      top:    intervalsTop,
      right:  rightCalc?.intervals  ?? null,
      bottom: bottomCalc?.intervals ?? null,
      left:   leftCalc?.intervals   ?? null,
    },
  };
}