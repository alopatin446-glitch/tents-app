import { WindowItem } from '@/types';
import { calculateWindowGeometry } from './windowCalculations';

export interface WindowFinance {
  costPrice: number;               // Чистое изделие: плёнка + кант
  totalExpenses: number;           // Все расходы: материал + перерасход + ЗП + крепёж
  retailPrice: number;             // Розничная цена клиента (изделие + крепёж)
  profit: number;                  // Чистая прибыль

  materialPriceM2: number;         // Закупочная цена плёнки за м²
  materialCutCost: number;         // Стоимость всей списанной плёнки (рулон × длина)
  materialInProductCost: number;   // Плёнка в изделии (прямоугольник + припуск)
  overspending: number;            // Отходы (плёнка + кант)

  kantPriceM2: number;             // Цена канта за м²
  kantMaterialCost: number;        // Кант всего (с перерасходом)
  kantMaterialProductCost: number; // Кант, вошедший в изделие
  kantLaborCost: number;           // Отходы ленты канта

  productionCost: number;          // ЗП сварщика (по productionArea)

  fastenersRetail: number;         // Стоимость крепежа (розница, ₽)
  fastenersCost: number;           // Стоимость крепежа (себестоимость, ₽)
}

export type PriceMap = Record<string, number>;

/**
 * Ширина канта в метрах — физический параметр ленты, не цена.
 * Изменяется вместе с поставкой материала (сейчас 10 см).
 */
const KANT_STRIP_WIDTH_M = 0.1;

/**
 * Количество отрезков ленты на перерасход (по одному на каждую сторону изделия).
 * Физика: 4 ленты × 40 см технологического допуска.
 */
const KANT_WASTE_STRIPS = 4;
const KANT_WASTE_LENGTH_M = 0.4; // 40 см на отрезок

/**
 * Ключи в priceMap для конкретного типа крепежа.
 * retailKey — розничная цена за 1 точку крепления (₽).
 * costKey   — себестоимость за 1 точку крепления (₽).
 */
interface FastenerPriceKeys {
  readonly retailKey: string;
  readonly costKey:   string;
}

/**
 * Маппинг типа крепежа → ключи в PriceMap.
 * ID — только здесь. Функции ниже обращаются к priceMap через этот объект.
 */
const FASTENER_PRICE_KEYS: Readonly<Record<string, FastenerPriceKeys>> = {
  eyelet_10:    { retailKey: 'fast_eyelet_retail',     costKey: 'fast_eyelet_cost' },
  strap:        { retailKey: 'fast_strap_retail',      costKey: 'fast_strap_cost' },
  staple_pa:    { retailKey: 'fast_staple_pa_retail',  costKey: 'fast_staple_pa_cost' },
  staple_metal: { retailKey: 'fast_staple_m_retail',   costKey: 'fast_staple_m_cost' },
  french_lock:  { retailKey: 'fast_french_retail',     costKey: 'fast_french_cost' },
  none:         { retailKey: '',                        costKey: '' },
} as const;

/**
 * Возвращает ключи priceMap для типа крепежа.
 * Неизвестный тип → пустые ключи (цена = 0).
 */
function resolveFastenerKeys(type: string): FastenerPriceKeys {
  return FASTENER_PRICE_KEYS[type] ?? { retailKey: '', costKey: '' };
}

/**
 * Считает суммарную стоимость крепежа по прайс-карте.
 * Если priceMap не содержит ключа — падает на значения из FastenerConfig
 * (snapshot из базы, уже захваченный при сохранении заказа).
 */
function calculateFastenerCosts(
  window: WindowItem,
  priceMap: PriceMap,
): { fastenersRetail: number; fastenersCost: number } {
  const fasteners = window.fasteners;
  if (!fasteners || fasteners.type === 'none') {
    return { fastenersRetail: 0, fastenersCost: 0 };
  }

  const keys        = resolveFastenerKeys(fasteners.type);
  const pointsCount = fasteners.pointsCount ?? 0;

  const unitRetail = keys.retailKey
    ? (priceMap[keys.retailKey] ?? fasteners.priceRetail)
    : fasteners.priceRetail;
  const unitCost   = keys.costKey
    ? (priceMap[keys.costKey] ?? fasteners.priceCost)
    : fasteners.priceCost;

  return {
    fastenersRetail: pointsCount * unitRetail,
    fastenersCost:   pointsCount * unitCost,
  };
}

/**
 * Публичный хелпер: розничная и себестоимостная цена за 1 точку крепления.
 *
 * Используется в FastenersStep при выборе типа крепежа,
 * обеспечивая тот же маппинг ключей, что и calculateWindowFinance.
 *
 * Приоритет: priceMap[key] → fallback.
 */
export function getFastenerUnitPrices(
  type: string,
  priceMap: PriceMap,
  fallback: { retail: number; cost: number } = { retail: 0, cost: 0 },
): { unitRetail: number; unitCost: number } {
  const keys = resolveFastenerKeys(type);
  return {
    unitRetail: keys.retailKey
      ? (priceMap[keys.retailKey] ?? fallback.retail)
      : fallback.retail,
    unitCost: keys.costKey
      ? (priceMap[keys.costKey] ?? fallback.cost)
      : fallback.cost,
  };
}

/**
 * Определяет закупочную цену плёнки за м² по коду материала.
 *
 * ─── CORE-3A: TPU ────────────────────────────────────────────────────────────
 * Использует c_pr_3 (750 ₽/м²).
 * Валидно: присутствует, > 0, ≠ 9999.
 * Fallback на c_pr_1 если c_pr_3 не настроен — сохраняет поведение до CORE-3A.
 *
 * ─── CORE-3B: TINTED ─────────────────────────────────────────────────────────
 * Использует c_pr_2 (400 ₽/м²).
 * Без fallback на ПВХ: если c_pr_2 не настроен → 0 (видимая проблема).
 * Диагностика materialDiagnostics покажет price_missing / price_not_configured.
 *
 * ─── Остальные материалы ────────────────────────────────────────────────────
 * PVC_700  → c_pr_1  (без изменений)
 * MOSQUITO → c_pr_1  (без изменений — до бизнес-решения CORE-3C)
 * ────────────────────────────────────────────────────────────────────────────
 */
function resolveBuyPrice(material: string, priceMap: PriceMap): number {
  if (material === 'TPU') {
    const tpuPrice = priceMap['c_pr_3'];
    if (tpuPrice !== undefined && tpuPrice > 0 && tpuPrice !== 9999) {
      return tpuPrice;
    }
    // c_pr_3 не настроен → fallback (не обнуляем себестоимость)
    return priceMap['c_pr_1'] || 0;
  }

  if (material === 'TINTED') {
    const tintedPrice = priceMap['c_pr_2'];
    if (tintedPrice !== undefined && tintedPrice > 0 && tintedPrice !== 9999) {
      return tintedPrice;
    }
    // c_pr_2 не настроен → 0 (без fallback на ПВХ: делаем проблему видимой)
    return 0;
  }

  return priceMap['c_pr_1'] || 0;
}

/**
 * Разрешает розничную цену за м² для слага.
 * Возвращает 0 при: slug отсутствует в priceMap, значение = 0, значение = 9999.
 * 9999 — sentinel «цена не установлена», не должен участвовать в расчёте.
 */
function resolveRetailPriceM2(slug: string, priceMap: PriceMap): number {
  const price = priceMap[slug];
  if (price === undefined || price === 0 || price === 9999) return 0;
  return price;
}

/**
 * ФИНАНСОВЫЙ МОСТ:
 * Расчёт экономики окна на основе фактической геометрии и живого прайса.
 *
 * ═══ Закон Директора ════════════════════════════════════════════════════════
 *   retailArea     → розничная цена изделия (клиент платит за габарит).
 *   productionArea → ЗП сварщика (он получает за реальные м²).
 *   perimeterWithKant → длина канта (для трапеции учитывает Пифагор).
 *   Все ставки — только из priceMap. Никаких числовых литералов ставок.
 * ════════════════════════════════════════════════════════════════════════════
 */
export function calculateWindowFinance(
  window: WindowItem,
  priceMap: PriceMap
): WindowFinance {
  // 1. Геометрия — единственный источник всех размеров и площадей
  const geo = calculateWindowGeometry(window);

  // 2. Ставки из справочника
  const buyPrice     = resolveBuyPrice(window.material, priceMap); // Закупка плёнки за м²
  const kantPriceM2  = priceMap['c_pr_4']     || 0; // Кант за м²
  const laborPriceM2 = priceMap['c_produc_1'] || 0; // ЗП сварщика за м²

  // 3. Розничный слаг и коэффициент верхнего крепежа
  const { slug: retailSlug, topFactor } = getRetailProductSlug(window);
  const retailPriceM2 = resolveRetailPriceM2(retailSlug, priceMap);

  // 4. Стоимость плёнки в изделии
  //    Плёнка всегда кроится из прямоугольника: (maxW + припуск) × (maxH + припуск).
  //    geo.cutWidth и geo.cutHeight уже содержат SOLDER_ALLOWANCE — хардкода нет.
  const materialInProductCost = (geo.cutWidth * geo.cutHeight / 10_000) * buyPrice;

  // 5. Перерасход плёнки (рулон шире заготовки → разница в мусор)
  const rollWidthM = geo.rollWidth / 100;
  const cutWidthM  = geo.cutWidth  / 100;
  const cutHeightM = geo.cutHeight / 100;

  const overspendingFilm = (rollWidthM - cutWidthM) * cutHeightM * buyPrice;

  // 6. Кант — длина по фактическому внешнему периметру изделия
  //    geo.perimeterWithKant для трапеции использует sideTop (теорема Пифагора).
  const cleanOuterPerimeterM = geo.perimeterWithKant / 100;
  const kantMaterialProductCost = cleanOuterPerimeterM * KANT_STRIP_WIDTH_M * kantPriceM2;

  // Технологический перерасход канта: 4 ленты × 40 см × ширина ленты
  const kantWasteM2 = KANT_WASTE_STRIPS * KANT_WASTE_LENGTH_M * KANT_STRIP_WIDTH_M;
  const overspendingKant = kantWasteM2 * kantPriceM2;

  const overspending = overspendingFilm + overspendingKant;

  // 7. ЗП сварщика
  //    Закон Директора: трудозатраты строго по productionArea.
  //    Для трапеции productionArea < retailArea → сварщик получает меньше за реальный объём.
  const productionCost = geo.productionArea * laborPriceM2;

  // 8. Розничная цена изделия (полотно)
  //    Закон Директора: клиент платит за габарит → строго по retailArea.
  const productRetail = geo.retailArea * retailPriceM2 * topFactor;

  // 9. Стоимость крепежа
  const { fastenersRetail, fastenersCost } = calculateFastenerCosts(window, priceMap);

  // 10. Итоговая розничная цена = изделие + крепёж
  const totalRetail = productRetail + fastenersRetail;

  // 11. Себестоимость изделия (плёнка + кант, без перерасхода и ЗП)
  const totalCost = materialInProductCost + kantMaterialProductCost;

  // 12. Полные расходы = материал + перерасход + ЗП + крепёж
  const totalExpenses = totalCost + overspending + productionCost + fastenersCost;

  // 13. Вспомогательные метрики для бухгалтерии
  const materialCutCost  = rollWidthM * cutHeightM * buyPrice;
  const kantMaterialCost = kantMaterialProductCost + overspendingKant;

  return {
    costPrice:     Math.round(totalCost),
    totalExpenses: Math.round(totalExpenses),
    retailPrice:   Math.round(totalRetail),
    profit:        Math.round(totalRetail - totalExpenses),

    materialPriceM2: Math.round(buyPrice),

    materialInProductCost: Math.round(materialInProductCost),
    materialCutCost:       Math.round(materialCutCost),
    overspending:          Math.round(overspending),

    kantPriceM2,
    kantMaterialCost:        Math.round(kantMaterialCost),
    kantMaterialProductCost: Math.round(kantMaterialProductCost),
    kantLaborCost:           Math.round(overspendingKant),

    productionCost: Math.round(productionCost),

    fastenersRetail: Math.round(fastenersRetail),
    fastenersCost:   Math.round(fastenersCost),
  };
}

// ---------------------------------------------------------------------------
// Вспомогательные
// ---------------------------------------------------------------------------

function getRetailProductSlug(item: WindowItem): { slug: string; topFactor: number } {
  const material     = item.material;
  const fastenerType = item.fasteners?.type ?? 'none';

  const leftEnabled  = item.fasteners?.sides?.left  === true;
  const rightEnabled = item.fasteners?.sides?.right === true;
  const topState     = item.fasteners?.sides?.top   ?? false;
  const topEnabled   = topState === true;

  const baseType  = leftEnabled && rightEnabled ? fastenerType : 'none';
  const topFactor = topEnabled && baseType !== 'none' ? 4 / 3 : 1;

  // ─── CORE-3B: TINTED — собственная розница ────────────────────────────────
  // Тонировка продаётся дороже ПВХ на +200 ₽/м². Крепёжная логика та же.
  // mapTINTED зеркалит mapPVC: одинаковые ключи, новые slug prod_13..prod_18.
  // CORE-3C (MOSQUITO) — отдельный этап, здесь не затронут.
  if (material === 'TINTED') {
    const mapTINTED: Record<string, string> = {
      none:         'prod_18',
      eyelet_10:    'prod_13',
      strap:        'prod_14',
      staple_pa:    'prod_15',
      staple_metal: 'prod_16',
      french_lock:  'prod_17',
    };
    const slug = mapTINTED[baseType];
    return { slug: slug || 'prod_18', topFactor };
  }

  // ─── CORE-3A: isTPU исправлен ────────────────────────────────────────────
  // До исправления: material === 'ТПУ Полиуретан' — всегда false после нормализации.
  // После исправления: material === 'TPU' — правильный короткий код.
  // MOSQUITO не затронут — остаётся на mapPVC до CORE-3C.
  const isTPU = material === 'TPU';

  const mapPVC: Record<string, string> = {
    none:         'prod_11',
    eyelet_10:    'prod_1',
    strap:        'prod_2',
    staple_pa:    'prod_3',
    staple_metal: 'prod_4',
    french_lock:  'prod_5',
  };

  const mapTPU: Record<string, string> = {
    none:         'prod_12',
    eyelet_10:    'prod_6',
    strap:        'prod_7',
    staple_pa:    'prod_8',
    staple_metal: 'prod_9',
    french_lock:  'prod_10',
  };

  const slug = (isTPU ? mapTPU : mapPVC)[baseType];

  return {
    slug: slug || (isTPU ? 'prod_12' : 'prod_11'),
    topFactor,
  };
}