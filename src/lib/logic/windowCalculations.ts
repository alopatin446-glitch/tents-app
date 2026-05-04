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

// 1. Добавляем припуск на припой (по 3 см с каждой стороны)
export const SOLDER_ALLOWANCE = 6; // +6 см на припуски
export const SMART_TOLERANCE = 4; // Допуск "натяжки"

/**
 * Единый справочник ширин рулонов (в см)
 * ТАМОЖНЯ: Цены и параметры здесь — это закон.
 */
export const ROLL_WIDTHS: Record<string, number[]> = {
  'PVC_700': [140, 150, 180, 200, 220, 240], // Теперь это наш стандарт
  'TPU': [140],
  'TINTED': [140, 180, 200],
  'MOSQUITO': [200],
};

// --- СЕРЕДИНА ФАЙЛА (ЛОГИКА) ---

/**
 * Оптимизация раскроя: подбор рулона, вращение и обработка негабаритов.
 * 
 * Мы не удаляем старые правила, мы наращиваем их!
 */
export function optimizeRollLayout(width: number, height: number, material: string) {
  const prodW = width + SOLDER_ALLOWANCE;
  const prodH = height + SOLDER_ALLOWANCE;

  // Используем ПВХ 700 как безопасный fallback
  const availableRolls = ROLL_WIDTHS[material] || ROLL_WIDTHS['PVC_700'];
  const rolls = [...availableRolls].sort((a, b) => a - b);
  const maxAvailableRoll = rolls[rolls.length - 1];

  const findFit = (w: number, h: number) => {
    // А) Ищем рулон с учетом SMART_TOLERANCE
    let roll = rolls.find(r => (w - SMART_TOLERANCE) <= r);

    if (roll) {
      // ПОГРАНИЧНИК-ЛОГИКА: Если влезли в рулон, списываем ВСЮ его ширину
      return {
        roll,
        area: roll * h,
        isOverSize: false
      };
    }

    // Б) Кейс "Оверзайс": Деталь шире всех рулонов
    return {
      roll: maxAvailableRoll,
      area: w * h,
      isOverSize: true
    };
  };

  const normal = findFit(prodW, prodH);
  const rotated = findFit(prodH, prodW);

  // ПОГРАНИЧНИК-ЛОГИКА: Выбираем вариант с МИНИМАЛЬНОЙ площадью списания
  if (normal && rotated) {
    return normal.area <= rotated.area
      ? { ...normal, isRotated: false }
      : { ...rotated, isRotated: true };
  }

  return normal ? { ...normal, isRotated: false } : null;
}

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

  if (h2 <= 0 || Math.abs(bc - ad) > 5) {
    // Геометрически невозможно (стороны не замыкаются или разница слишком велика)
    logger.warn(LOG_MESSAGES.TRAPEZOID_IMPOSSIBLE, {
      widthTop,
      widthBottom,
      heightLeft,
      heightRight,
    });
    return null;
  }

  return Math.sqrt(h2);
}

function hasCompleteTrapezoidMeasurements(window: WindowItem): boolean {
  return (
    Number(window.diagonalLeft) > 0 &&
    Number(window.diagonalRight) > 0 &&
    Number(window.crossbar) > 0
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

// ---------------------------------------------------------------------------
// Публичный API
// ---------------------------------------------------------------------------

/**
 * Результат расчёта геометрии одного изделия.
 */
export interface WindowGeometry {
  areaMaterial: number;   /** Площадь полотна в м². */
  areaWithKant: number;   /** Площадь с учётом канта в м². */
  cutArea: number;        /** Площадь прямоугольной заготовки в м². */
  wasteArea: number;      /** Геометрический перерасход в м². */
  kantAreaInProduct: number; /** Площадь канта, вошедшая в изделие, м². */
  kantWasteArea: number;     /** Перерасход канта, м². */
  kantTotalArea: number;     /** Весь расход канта, м². */
  perimeter: number;         /** Периметр полотна в см. */
  perimeterWithKant: number; /** ПЕРИМЕТР ИЗДЕЛИЯ С КАНТОМ (добавлено) */
  rollWidth: number;      // Ширина рулона
  cutWidth: number;       // ШИРИНА ЗАГОТОВКИ (добавлено)
  cutHeight: number;      // ВЫСОТА ЗАГОТОВКИ (добавлено)
  isRotated: boolean;     // Метка поворота
  isOverSize?: boolean;   // Метка негабарита (для ТПУ)
  isExact: boolean;       /** Флаг точности трапеции */
}

/**
 * Расширенный результат для всего заказа (Цеховое планирование)
 */
export interface OrderOptimization {
  totalCutArea: number;   /** Общая площадь списания по заказу. */
  totalWasteArea: number; /** Общий перерасход материала. */
  batches: MaterialBatch[];
}

interface MaterialBatch {
  material: string;
  rollWidth: number;
  totalLength: number;    /** Общий погонаж отреза (см). */
  windowIds: number[];    /** ID окон, входящих в этот отрез. */
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

  const canCalculateTrapezoid = isTrapezoid && hasCompleteTrapezoidMeasurements(window);


  if (canCalculateTrapezoid) {
    const h = Number(window.crossbar);

    if (!Number.isFinite(h) || h <= 0) {
      areaCm2 = calculateBoxAreaCm2(widthTop, widthBottom, heightLeft, heightRight);
      isExact = false;
      logger.warn(LOG_MESSAGES.TRAPEZOID_IMPOSSIBLE, {
        windowId: window.id,
        windowName: window.name,
        widthTop,
        widthBottom,
        heightLeft,
        heightRight,
      });
    } else {
      // Для полной трапеции используем фактическую площадь:
      // S = (верх + низ) / 2 × параллель.
      areaCm2 = ((widthTop + widthBottom) / 2) * h;
    }
  } else {
    // Если трапеция не включена или не заполнены диагонали/параллель,
    // считаем как обычное изделие по габариту.
    areaCm2 = calculateBoxAreaCm2(widthTop, widthBottom, heightLeft, heightRight);
  }

  // --- НОВАЯ ЛОГИКА РАСКРОЯ ---
  // 1. Берем максимальные габариты (ведь рулон должен закрыть всё окно)
  const maxW = Math.max(widthTop, widthBottom);
  const maxH = Math.max(heightLeft, heightRight);

  // 2. Вызываем наш оптимизатор. Передаем материал из объекта window
  const layout = optimizeRollLayout(maxW, maxH, window.material || 'PVC_500');

  // 3. Определяем параметры списания
  const finalRollWidth = layout ? layout.roll : (maxW + SOLDER_ALLOWANCE);
  const finalCutAreaCm2 = layout ? layout.area : (finalRollWidth * (maxH + SOLDER_ALLOWANCE));
  const finalIsRotated = layout ? layout.isRotated : false;

  // 4. Считаем честный перерасход (сколько рулона ушло в мусор)
  const wasteAreaCm2 = Math.max(0, finalCutAreaCm2 - areaCm2);

  // Периметр полотна
  const perimeter = widthTop + heightRight + widthBottom + heightLeft;

  // Площадь с учётом канта (кант добавляет полосу по периметру)
  const kantedWidthTop = widthTop + kantLeft + kantRight;
  const kantedWidthBottom = widthBottom + kantLeft + kantRight;
  const kantedHeightLeft = heightLeft + kantTop + kantBottom;
  const kantedHeightRight = heightRight + kantTop + kantBottom;

  let areaWithKantCm2: number;

  if (canCalculateTrapezoid && isExact) {
    const hKanted = Number(window.crossbar) + kantTop + kantBottom;

    areaWithKantCm2 = ((kantedWidthTop + kantedWidthBottom) / 2) * hKanted;
  } else {
    const outerWidth = Math.max(widthTop, widthBottom) + kantLeft + kantRight;
    const outerHeight = Math.max(heightLeft, heightRight) + kantTop + kantBottom;

    areaWithKantCm2 = outerWidth * outerHeight;
  }

  // Площадь канта по сторонам.
  // Кант считается как лента по каждой стороне в 2 слоя: лицо + тыл.
  const topKantLength = widthTop + kantLeft + kantRight;
  const rightKantLength = heightRight + kantTop + kantBottom;
  const bottomKantLength = widthBottom + kantLeft + kantRight;
  const leftKantLength = heightLeft + kantTop + kantBottom;

  const topKantAreaCm2 = topKantLength * kantTop * 2;
  const rightKantAreaCm2 = rightKantLength * kantRight * 2;
  const bottomKantAreaCm2 = bottomKantLength * kantBottom * 2;
  const leftKantAreaCm2 = leftKantLength * kantLeft * 2;

  const kantAreaInProductCm2 =
    topKantAreaCm2 +
    rightKantAreaCm2 +
    bottomKantAreaCm2 +
    leftKantAreaCm2;

  // Перерасход канта: +30 см на каждую ленту, тоже в 2 слоя.
  const KANT_MACHINE_WASTE_CM = 30;

  const topKantWasteCm2 = kantTop > 0 ? KANT_MACHINE_WASTE_CM * kantTop * 2 : 0;
  const rightKantWasteCm2 = kantRight > 0 ? KANT_MACHINE_WASTE_CM * kantRight * 2 : 0;
  const bottomKantWasteCm2 = kantBottom > 0 ? KANT_MACHINE_WASTE_CM * kantBottom * 2 : 0;
  const leftKantWasteCm2 = kantLeft > 0 ? KANT_MACHINE_WASTE_CM * kantLeft * 2 : 0;

  const kantWasteAreaCm2 =
    topKantWasteCm2 +
    rightKantWasteCm2 +
    bottomKantWasteCm2 +
    leftKantWasteCm2;

  const kantTotalAreaCm2 = kantAreaInProductCm2 + kantWasteAreaCm2;

  return {
    areaMaterial: roundM2(areaCm2 / CM2_TO_M2),
    areaWithKant: roundM2(areaWithKantCm2 / CM2_TO_M2),
    cutArea: roundM2(finalCutAreaCm2 / CM2_TO_M2),
    wasteArea: roundM2(wasteAreaCm2 / CM2_TO_M2),

    kantAreaInProduct: roundM2(kantAreaInProductCm2 / CM2_TO_M2),
    kantWasteArea: roundM2(kantWasteAreaCm2 / CM2_TO_M2),
    kantTotalArea: roundM2(kantTotalAreaCm2 / CM2_TO_M2),

    perimeter: perimeter,
    perimeterWithKant: kantedWidthTop + kantedHeightRight + kantedWidthBottom + kantedHeightLeft,
    rollWidth: finalRollWidth,
    cutWidth: maxW + SOLDER_ALLOWANCE,  // Передаем реальный габарит заготовки
    cutHeight: maxH + SOLDER_ALLOWANCE, // Передаем реальный габарит заготовки
    isRotated: finalIsRotated,
    isOverSize: layout?.isOverSize || false,
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
 * Глобальный оптимизатор заказа.
 * ТАМОЖНЯ: Группирует окна по материалу и ширине рулона для минимизации остатков.[cite: 1]
 */
export function calculateOrderOptimization(windows: WindowItem[]): OrderOptimization {
  // 1. Получаем индивидуальные расчеты для каждого окна[cite: 1]
  const results = windows.map(w => ({
    id: w.id,
    geo: calculateWindowGeometry(w),
    material: w.material || 'PVC_700' // Наш новый стандарт вместо 500[cite: 1]
  }));

  // 2. Группируем по Материалу + Ширине рулона[cite: 1]
  const batchMap: Record<string, MaterialBatch> = {};

  results.forEach(res => {
    const key = `${res.material}_${res.geo.rollWidth}`;

    if (!batchMap[key]) {
      batchMap[key] = {
        material: res.material,
        rollWidth: res.geo.rollWidth,
        totalLength: 0,
        windowIds: []
      };
    }

    // Находим исходное окно для получения точных размеров[cite: 1]
    const originalWindow = windows.find(w => w.id === res.id)!;

    // Длина отреза зависит от того, повернули мы деталь или нет[cite: 1]
    const length = res.geo.isRotated
      ? (Number(originalWindow.widthTop) + SOLDER_ALLOWANCE)
      : (Math.max(Number(originalWindow.heightLeft), Number(originalWindow.heightRight)) + SOLDER_ALLOWANCE);

    batchMap[key].totalLength += length;
    batchMap[key].windowIds.push(res.id);
  });

  return {
    totalCutArea: results.reduce((sum, r) => sum + r.geo.cutArea, 0),
    totalWasteArea: results.reduce((sum, r) => sum + r.geo.wasteArea, 0),
    batches: Object.values(batchMap)
  };
}

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
