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

// ---------------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------------

/**
 * Вычисляет высоту трапеции по четырём сторонам методом аналитической геометрии.
 *
 * Задача: трапеция ABCD, AB = widthTop (верхнее основание),
 * CD = widthBottom (нижнее основание), BC = heightRight, AD = heightLeft.
 *
 * Алгоритм:
 * Размещаем AB на оси X: A = (0, 0), B = (a, 0).
 * D = (x, h), C = (x + b, h) — нижнее основание.
 *
 * Из длин боковых сторон:
 *   AD² = x² + h²            → уравнение 1
 *   BC² = (a − b − x)² + h²  → уравнение 2
 *
 * Вычитаем (1) из (2):
 *   BC² − AD² = (a − b − x)² − x²
 *   BC² − AD² = (a − b)² − 2(a − b)x
 *   x = [(a − b)² − (BC² − AD²)] / [2(a − b)]
 *
 * При a = b (прямоугольник): возвращаем среднее высот.
 *
 * @returns высота трапеции в сантиметрах, или null если геометрия невозможна
 */
function computeTrapezoidHeight(
  widthTop: number,
  widthBottom: number,
  heightLeft: number,
  heightRight: number
): number | null {
  const a = widthTop;
  const b = widthBottom;
  const ad = heightLeft;
  const bc = heightRight;

  // Прямоугольник / параллелограмм — боковые стороны и есть высота
  if (Math.abs(a - b) < 0.001) {
    // Среднее двух высот как запасной вариант для не идеально прямоугольных окон
    return (ad + bc) / 2;
  }

  const delta = a - b;
  const numerator = delta * delta - (bc * bc - ad * ad);
  const x = numerator / (2 * delta);

  const h2 = ad * ad - x * x;

  if (h2 <= 0) {
    // Геометрически невозможно (стороны не замыкаются)
    return null;
  }

  return Math.sqrt(h2);
}

// ---------------------------------------------------------------------------
// Публичный API
// ---------------------------------------------------------------------------

/**
 * Результат расчёта геометрии одного изделия.
 */
export interface WindowGeometry {
  /** Площадь полотна в м². */
  areaMaterial: number;

  /** Площадь с учётом канта в м². */
  areaWithKant: number;

  /** Периметр полотна в см (для расчёта расхода канта). */
  perimeter: number;

  /**
   * true, если расчёт произведён точно.
   * false — если трапеция геометрически некорректна и использована приближённая формула.
   */
  isExact: boolean;
}

/**
 * Вычисляет полную геометрию изделия.
 *
 * Для прямоугольника: площадь = ((T + B) / 2) * ((L + R) / 2)
 * Для трапеции: используем аналитический метод по 4 сторонам.
 * При невалидной геометрии — fallback на формулу прямоугольника с пометкой !isExact.
 *
 * Кант учитывается как дополнительный периметр сверху и снизу.
 */
export function calculateWindowGeometry(window: WindowItem): WindowGeometry {
  const { widthTop, widthBottom, heightLeft, heightRight, isTrapezoid } = window;
  const { kantTop, kantRight, kantBottom, kantLeft } = window;

  let areaCm2: number;
  let isExact = true;

  if (isTrapezoid) {
    const h = computeTrapezoidHeight(widthTop, widthBottom, heightLeft, heightRight);

    if (h !== null) {
      // Формула площади трапеции: S = (a + b) / 2 * h
      areaCm2 = ((widthTop + widthBottom) / 2) * h;
    } else {
      // Fallback: геометрия невозможна — стороны трапеции не замыкаются.
      areaCm2 =
        ((widthTop + widthBottom) / 2) * ((heightLeft + heightRight) / 2);
      isExact = false;
      logger.warn(LOG_MESSAGES.TRAPEZOID_IMPOSSIBLE, {
        windowId: window.id,
        windowName: window.name,
        widthTop,
        widthBottom,
        heightLeft,
        heightRight,
      });
    }
  } else {
    // Стандартный четырёхугольник — средние значения сторон
    areaCm2 =
      ((widthTop + widthBottom) / 2) * ((heightLeft + heightRight) / 2);
  }

  // Периметр полотна
  const perimeter = widthTop + heightRight + widthBottom + heightLeft;

  // Площадь с учётом канта (кант добавляет полосу по периметру)
  const kantedWidthTop = widthTop + kantLeft + kantRight;
  const kantedWidthBottom = widthBottom + kantLeft + kantRight;
  const kantedHeightLeft = heightLeft + kantTop + kantBottom;
  const kantedHeightRight = heightRight + kantTop + kantBottom;

  let areaWithKantCm2: number;

  if (isTrapezoid && isExact) {
    const hKanted = computeTrapezoidHeight(
      kantedWidthTop,
      kantedWidthBottom,
      kantedHeightLeft,
      kantedHeightRight
    );
    areaWithKantCm2 =
      hKanted !== null
        ? ((kantedWidthTop + kantedWidthBottom) / 2) * hKanted
        : ((kantedWidthTop + kantedWidthBottom) / 2) *
          ((kantedHeightLeft + kantedHeightRight) / 2);
  } else {
    areaWithKantCm2 =
      ((kantedWidthTop + kantedWidthBottom) / 2) *
      ((kantedHeightLeft + kantedHeightRight) / 2);
  }

  return {
    areaMaterial: roundM2(areaCm2 / CM2_TO_M2),
    areaWithKant: roundM2(areaWithKantCm2 / CM2_TO_M2),
    perimeter,
    isExact,
  };
}

/**
 * Быстрый расчёт площади одного изделия в м².
 * Используется в тех местах, где нужно только это значение.
 */
export function calculateArea(window: WindowItem): number {
  return calculateWindowGeometry(window).areaMaterial;
}

/**
 * Суммирует площади всех изделий в заказе.
 *
 * @param windows - массив изделий
 * @returns общая площадь в м²
 */
export function calculateTotalArea(windows: WindowItem[]): number {
  return roundM2(
    windows.reduce((sum, w) => sum + calculateWindowGeometry(w).areaMaterial, 0)
  );
}

/**
 * Суммирует площади с учётом канта для всех изделий.
 *
 * @param windows - массив изделий
 * @returns общая площадь с кантом в м²
 */
export function calculateTotalAreaWithKant(windows: WindowItem[]): number {
  return roundM2(
    windows.reduce((sum, w) => sum + calculateWindowGeometry(w).areaWithKant, 0)
  );
}

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------

/**
 * Округляет значение площади до 2 знаков после запятой.
 * Централизованное место для управления точностью.
 */
function roundM2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Форматирует площадь для отображения в UI.
 * @example formatArea(1.5) → "1.50 м²"
 */
export function formatArea(areaM2: number): string {
  return `${areaM2.toFixed(2)} м²`;
}