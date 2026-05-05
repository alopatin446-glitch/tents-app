/**
 * ЕДИНЫЙ ИСТОЧНИК ПРАВДЫ — Геометрические расчёты изделий
 *
 * Все формулы площади, периметра и канта живут ТОЛЬКО здесь.
 * Никаких вычислений в JSX-разметке.
 *
 * Закрывает архитектурный долг D-03.
 *
 * @module src/lib/logic/windowCalculations.ts
 */

import type { WindowItem } from '@/types';
import { logger, LOG_MESSAGES } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Константы
// ---------------------------------------------------------------------------

/** Коэффициент перевода см² → м². */
const CM2_TO_M2 = 10_000;

/** Припуск на припой (по 3 см с каждой стороны = 6 см суммарно). */
export const SOLDER_ALLOWANCE = 6;

/** Допуск «натяжки» при подборе рулона (см). */
export const SMART_TOLERANCE = 4;

/**
 * Порог автоопределения трапеции по разнице высот (см).
 * Если |heightLeft − heightRight| > порога → верхний край считается наклонным.
 */
const TRAPEZOID_HEIGHT_DELTA = 0.5;

/**
 * Порог автоопределения трапеции по разнице ширин (см).
 * Если |widthTop − widthBottom| > порога → форма трапеция.
 */
const TRAPEZOID_WIDTH_DELTA = 0.5;

/**
 * Единый справочник ширин рулонов (в см).
 * ТАМОЖНЯ: параметры здесь — закон.
 */
export const ROLL_WIDTHS: Record<string, number[]> = {
  PVC_700:  [140, 150, 180, 200, 220, 240],
  TPU:      [140],
  TINTED:   [140, 180, 200],
  MOSQUITO: [200],
};

// ---------------------------------------------------------------------------
// Оптимизация раскроя
// ---------------------------------------------------------------------------

/**
 * Подбирает рулон, решает вопрос о повороте, помечает негабарит.
 * Возвращает вариант с минимальной площадью списания.
 */
export function optimizeRollLayout(width: number, height: number, material: string) {
  const prodW = width  + SOLDER_ALLOWANCE;
  const prodH = height + SOLDER_ALLOWANCE;

  const availableRolls = ROLL_WIDTHS[material] ?? ROLL_WIDTHS['PVC_700'];
  const rolls          = [...availableRolls].sort((a, b) => a - b);
  const maxAvailableRoll = rolls[rolls.length - 1];

  const findFit = (w: number, h: number) => {
    const roll = rolls.find(r => (w - SMART_TOLERANCE) <= r);
    if (roll) return { roll, area: roll * h, isOverSize: false };
    return { roll: maxAvailableRoll, area: w * h, isOverSize: true };
  };

  const normal  = findFit(prodW, prodH);
  const rotated = findFit(prodH, prodW);

  if (normal && rotated) {
    return normal.area <= rotated.area
      ? { ...normal,  isRotated: false }
      : { ...rotated, isRotated: true  };
  }

  return normal ? { ...normal, isRotated: false } : null;
}

// ---------------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------------

function hasCompleteTrapezoidMeasurements(window: WindowItem): boolean {
  return (
    Number(window.diagonalLeft)  > 0 &&
    Number(window.diagonalRight) > 0 &&
    Number(window.crossbar)      > 0
  );
}

function calculateBoxAreaCm2(
  widthTop: number,
  widthBottom: number,
  heightLeft: number,
  heightRight: number,
): number {
  return Math.max(widthTop, widthBottom) * Math.max(heightLeft, heightRight);
}

/**
 * Длина верхней стороны изделия.
 *
 * «Наклонная крыша» (heightLeft ≠ heightRight):
 *   Стороны вертикальны, верхний край наклонён.
 *   Длина = √(widthTop² + (heightLeft − heightRight)²)
 *
 * Прямоугольник или «разноширинная» трапеция:
 *   Длина = widthTop (горизонталь).
 */
function computeSideTop(
  widthTop: number,
  heightLeft: number,
  heightRight: number,
  isHeightTrapezoid: boolean,
): number {
  if (!isHeightTrapezoid) return widthTop;
  return Math.sqrt(widthTop ** 2 + (heightLeft - heightRight) ** 2);
}

// ---------------------------------------------------------------------------
// Публичный интерфейс результата
// ---------------------------------------------------------------------------

/**
 * Результат расчёта геометрии одного изделия.
 *
 * ═══ Закон Директора: разделение площадей ═══════════════════════════════════
 *   retailArea    — Max W × Max H (прямоугольник).
 *                   Для чека и расчёта розничной цены изделия.
 *                   Точность: 4 знака.
 *
 *   productionArea — реальная площадь формы (трапеция или прямоугольник).
 *                    Для ЗП сварщика: он получает за реальные м².
 *                    Точность: 4 знака.
 *
 *   Все остальные площади — 2 знака (для отображения мастеру и менеджеру).
 * ════════════════════════════════════════════════════════════════════════════
 */
export interface WindowGeometry {
  // ── Тип геометрии ──────────────────────────────────────────────────────────
  /** Тип формы: прямоугольник или трапеция (определяется автоматически). */
  type: 'rectangle' | 'trapezoid';

  // ── Фактические длины сторон (см) ──────────────────────────────────────────
  /** Высота левой стороны (см). */
  leftHeight: number;
  /** Высота правой стороны (см). */
  rightHeight: number;
  /**
   * Точная длина верхней стороны (см).
   * Для «наклонной крыши»: √(widthTop² + (heightLeft − heightRight)²).
   * Для прямоугольника: widthTop.
   */
  sideTop: number;
  /** Нижняя сторона (= widthBottom, всегда горизонталь, см). */
  sideBottom: number;
  /** Левая сторона (= heightLeft, см). */
  sideLeft: number;
  /** Правая сторона (= heightRight, см). */
  sideRight: number;

  // ── Площади — Закон Директора (4 знака) ────────────────────────────────────
  /**
   * Площадь для чека (м²): Max Width × Max Height.
   * Клиент платит за габарит — всегда прямоугольник.
   */
  retailArea: number;
  /**
   * Реальная площадь изделия (м²).
   * Сварщик получает за фактическую геометрию — трапецию или прямоугольник.
   */
  productionArea: number;

  // ── Площади для раскроя и отображения (2 знака) ────────────────────────────
  /** Площадь изделия с кантом (м²). */
  areaWithKant: number;
  /** Площадь прямоугольной заготовки из рулона (м²). */
  cutArea: number;
  /** Геометрический перерасход при раскрое (м²). */
  wasteArea: number;
  /** Площадь канта, вошедшая в изделие (м²). */
  kantAreaInProduct: number;
  /** Перерасход канта (м²). */
  kantWasteArea: number;
  /** Суммарный расход канта (м²). */
  kantTotalArea: number;

  // ── Периметр (см) ──────────────────────────────────────────────────────────
  /** Периметр полотна (см). Учитывает наклон верхней стороны трапеции. */
  perimeter: number;
  /**
   * Внешний периметр изделия с кантом (см).
   * Для «наклонной крыши» включает sideTop через Пифагор.
   * Используется в pricingLogic.ts для расчёта длины и стоимости канта.
   */
  perimeterWithKant: number;

  // ── Параметры раскроя ──────────────────────────────────────────────────────
  /** Ширина подобранного рулона (см). */
  rollWidth: number;
  /** Ширина заготовки = maxW + SOLDER_ALLOWANCE (см). */
  cutWidth: number;
  /** Высота заготовки = maxH + SOLDER_ALLOWANCE (см). */
  cutHeight: number;
  /** true = деталь повёрнута на 90° для экономии рулона. */
  isRotated: boolean;
  /** true = деталь шире максимального доступного рулона. */
  isOverSize?: boolean;
  /** false = приближённый расчёт (нет данных для точной трапеции). */
  isExact: boolean;
}

/**
 * Расширенный результат для всего заказа (цеховое планирование).
 */
export interface OrderOptimization {
  /** Общая площадь списания по заказу (м²). */
  totalCutArea: number;
  /** Общий перерасход материала (м²). */
  totalWasteArea: number;
  batches: MaterialBatch[];
}

interface MaterialBatch {
  material: string;
  rollWidth: number;
  /** Общий погонаж отреза (см). */
  totalLength: number;
  /** ID изделий, входящих в этот отрез. */
  windowIds: number[];
}

// ---------------------------------------------------------------------------
// Основная функция расчёта
// ---------------------------------------------------------------------------

/**
 * Вычисляет полную геометрию одного изделия.
 *
 * Правило точности: промежуточные значения (areaCm2, retailAreaCm2)
 * не округляются. Math.round применяется только в финальном return.
 *
 * Поддерживаемые формы:
 *   Прямоугольник   — heightLeft ≈ heightRight, widthTop ≈ widthBottom.
 *   Трапеция-высота — heightLeft ≠ heightRight (наклонный верх, Пифагор).
 *   Трапеция-ширина — widthTop ≠ widthBottom (требует crossbar для точности).
 */
export function calculateWindowGeometry(window: WindowItem): WindowGeometry {
  const { widthTop, widthBottom, heightLeft, heightRight, isTrapezoid } = window;
  const { kantTop, kantRight, kantBottom, kantLeft } = window;

  // ── Тип формы ──────────────────────────────────────────────────────────────
  const isHeightTrapezoid = Math.abs(heightLeft - heightRight) > TRAPEZOID_HEIGHT_DELTA;
  const isWidthTrapezoid  = Math.abs(widthTop   - widthBottom) > TRAPEZOID_WIDTH_DELTA;
  const geometryType: 'rectangle' | 'trapezoid' =
    isHeightTrapezoid || isWidthTrapezoid ? 'trapezoid' : 'rectangle';

  // ── Физические длины сторон (см) ───────────────────────────────────────────
  const sideLeft   = heightLeft;
  const sideRight  = heightRight;
  const sideBottom = widthBottom;
  const sideTop    = computeSideTop(widthTop, heightLeft, heightRight, isHeightTrapezoid);

  // ── Производственная площадь (не округляем до финального return) ────────────
  let areaCm2: number;
  let isExact = true;

  const canCalculateTrapezoid = isTrapezoid && hasCompleteTrapezoidMeasurements(window);

  if (canCalculateTrapezoid) {
    const h = Number(window.crossbar);
    if (!Number.isFinite(h) || h <= 0) {
      areaCm2 = calculateBoxAreaCm2(widthTop, widthBottom, heightLeft, heightRight);
      isExact  = false;
      logger.warn(LOG_MESSAGES.TRAPEZOID_IMPOSSIBLE, {
        windowId: window.id,
        windowName: window.name,
        widthTop, widthBottom, heightLeft, heightRight,
      });
    } else {
      areaCm2 = ((widthTop + widthBottom) / 2) * h;
    }
  } else if (isHeightTrapezoid) {
    // «Наклонная крыша»: ширина одинакова, высоты разные.
    // S = avgWidth × avgHeight
    areaCm2 = ((widthTop + widthBottom) / 2) * ((heightLeft + heightRight) / 2);
  } else {
    areaCm2 = calculateBoxAreaCm2(widthTop, widthBottom, heightLeft, heightRight);
  }

  // ── Розничная площадь (не округляем до финального return) ──────────────────
  const maxW         = Math.max(widthTop, widthBottom);
  const maxH         = Math.max(heightLeft, heightRight);
  const retailAreaCm2 = maxW * maxH;

  // ── Раскрой ────────────────────────────────────────────────────────────────
  const layout = optimizeRollLayout(maxW, maxH, window.material || 'PVC_700');

  const finalRollWidth  = layout ? layout.roll        : (maxW + SOLDER_ALLOWANCE);
  const finalCutAreaCm2 = layout ? layout.area        : (finalRollWidth * (maxH + SOLDER_ALLOWANCE));
  const finalIsRotated  = layout ? layout.isRotated   : false;

  const wasteAreaCm2 = Math.max(0, finalCutAreaCm2 - areaCm2);

  // ── Периметр ───────────────────────────────────────────────────────────────
  const perimeter = sideTop + sideRight + sideBottom + sideLeft;

  // ── Площадь с кантом ───────────────────────────────────────────────────────
  const kantedSideTop     = sideTop    + kantLeft + kantRight;
  const kantedHeightRight = sideRight  + kantTop  + kantBottom;
  const kantedWidthBottom = sideBottom + kantLeft + kantRight;
  const kantedHeightLeft  = sideLeft   + kantTop  + kantBottom;

  let areaWithKantCm2: number;
  if (canCalculateTrapezoid && isExact) {
    const hKanted    = Number(window.crossbar) + kantTop + kantBottom;
    const wTopKanted = widthTop    + kantLeft + kantRight;
    const wBotKanted = widthBottom + kantLeft + kantRight;
    areaWithKantCm2  = ((wTopKanted + wBotKanted) / 2) * hKanted;
  } else {
    areaWithKantCm2 = (maxW + kantLeft + kantRight) * (maxH + kantTop + kantBottom);
  }

  // ── Площадь канта по сторонам (2 слоя: лицо + тыл) ───────────────────────
  const topKantAreaCm2    = kantedSideTop     * kantTop    * 2;
  const rightKantAreaCm2  = kantedHeightRight * kantRight  * 2;
  const bottomKantAreaCm2 = kantedWidthBottom * kantBottom * 2;
  const leftKantAreaCm2   = kantedHeightLeft  * kantLeft   * 2;

  const kantAreaInProductCm2 =
    topKantAreaCm2 + rightKantAreaCm2 + bottomKantAreaCm2 + leftKantAreaCm2;

  // Технологический перерасход: +30 см на каждую ленту канта (допуск машины)
  const KANT_MACHINE_WASTE_CM = 30;
  const kantWasteAreaCm2 =
    (kantTop    > 0 ? KANT_MACHINE_WASTE_CM * kantTop    * 2 : 0) +
    (kantRight  > 0 ? KANT_MACHINE_WASTE_CM * kantRight  * 2 : 0) +
    (kantBottom > 0 ? KANT_MACHINE_WASTE_CM * kantBottom * 2 : 0) +
    (kantLeft   > 0 ? KANT_MACHINE_WASTE_CM * kantLeft   * 2 : 0);

  const kantTotalAreaCm2 = kantAreaInProductCm2 + kantWasteAreaCm2;

  // ── Финальный return — здесь применяем округление ─────────────────────────
  return {
    type: geometryType,

    leftHeight: sideLeft,
    rightHeight: sideRight,
    sideTop,
    sideBottom,
    sideLeft,
    sideRight,

    // Финансово значимые площади — 4 знака
    retailArea:    round4(retailAreaCm2 / CM2_TO_M2),
    productionArea: round4(areaCm2      / CM2_TO_M2),

    // Отображаемые площади — 2 знака
    areaWithKant:      roundM2(areaWithKantCm2     / CM2_TO_M2),
    cutArea:           roundM2(finalCutAreaCm2      / CM2_TO_M2),
    wasteArea:         roundM2(wasteAreaCm2         / CM2_TO_M2),
    kantAreaInProduct: roundM2(kantAreaInProductCm2 / CM2_TO_M2),
    kantWasteArea:     roundM2(kantWasteAreaCm2     / CM2_TO_M2),
    kantTotalArea:     roundM2(kantTotalAreaCm2     / CM2_TO_M2),

    perimeter,
    perimeterWithKant: kantedSideTop + kantedHeightRight + kantedWidthBottom + kantedHeightLeft,

    rollWidth: finalRollWidth,
    cutWidth:  maxW + SOLDER_ALLOWANCE,
    cutHeight: maxH + SOLDER_ALLOWANCE,
    isRotated: finalIsRotated,
    isOverSize: layout?.isOverSize ?? false,
    isExact,
  };
}

// ---------------------------------------------------------------------------
// Агрегирующие функции
// ---------------------------------------------------------------------------

/**
 * Суммирует производственные площади всех изделий.
 * Используется для расчёта ЗП цеха и производственного планирования.
 */
export function calculateTotalArea(windows: WindowItem[]): number {
  return round4(
    windows.reduce((sum, w) => sum + calculateWindowGeometry(w).productionArea, 0),
  );
}

/**
 * Суммирует розничные площади всех изделий (Max W × Max H).
 * Используется для формирования чека и расчёта итоговой розничной стоимости.
 */
export function calculateTotalRetailArea(windows: WindowItem[]): number {
  return round4(
    windows.reduce((sum, w) => sum + calculateWindowGeometry(w).retailArea, 0),
  );
}

/**
 * Суммирует площади с кантом для всех изделий.
 */
export function calculateTotalAreaWithKant(windows: WindowItem[]): number {
  return roundM2(
    windows.reduce((sum, w) => sum + calculateWindowGeometry(w).areaWithKant, 0),
  );
}

/**
 * Быстрый доступ к производственной площади одного изделия.
 */
export function calculateArea(window: WindowItem): number {
  return calculateWindowGeometry(window).productionArea;
}

// ---------------------------------------------------------------------------
// Оптимизация заказа (цеховое планирование)
// ---------------------------------------------------------------------------

/**
 * Группирует изделия по материалу и ширине рулона.
 * Минимизирует количество смен рулона на производстве.
 */
export function calculateOrderOptimization(windows: WindowItem[]): OrderOptimization {
  const results = windows.map(w => ({
    id:       w.id,
    geo:      calculateWindowGeometry(w),
    material: w.material || 'PVC_700',
  }));

  const batchMap: Record<string, MaterialBatch> = {};

  results.forEach(res => {
    const key = `${res.material}_${res.geo.rollWidth}`;

    if (!batchMap[key]) {
      batchMap[key] = {
        material:    res.material,
        rollWidth:   res.geo.rollWidth,
        totalLength: 0,
        windowIds:   [],
      };
    }

    const orig   = windows.find(w => w.id === res.id)!;
    const length = res.geo.isRotated
      ? (Number(orig.widthTop) + SOLDER_ALLOWANCE)
      : (Math.max(Number(orig.heightLeft), Number(orig.heightRight)) + SOLDER_ALLOWANCE);

    batchMap[key].totalLength += length;
    batchMap[key].windowIds.push(res.id);
  });

  return {
    totalCutArea:   results.reduce((sum, r) => sum + r.geo.cutArea,   0),
    totalWasteArea: results.reduce((sum, r) => sum + r.geo.wasteArea, 0),
    batches: Object.values(batchMap),
  };
}

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------

/**
 * Округление до 4 знаков.
 * Только для финансово значимых площадей: retailArea, productionArea.
 */
function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/**
 * Округление до 2 знаков.
 * Для отображаемых площадей: раскрой, кант, перерасход.
 */
function roundM2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Форматирует площадь для UI.
 * @example formatArea(1.5) → "1.50 м²"
 */
export function formatArea(areaM2: number): string {
  return `${areaM2.toFixed(2)} м²`;
}