import { WindowItem } from '@/types';
import { calculateWindowGeometry } from './windowCalculations';

export interface WindowFinance {
  costPrice: number;               // Чистое изделие: плёнка + кант
  totalExpenses: number;           // Все расходы: материал + перерасход + ЗП
  retailPrice: number;             // Розничная цена клиента (по retailArea)
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
  const buyPrice = priceMap['c_pr_1'] || 0; // Закупка плёнки за м²
  const kantPriceM2 = priceMap['c_pr_4'] || 0; // Кант за м²
  const laborPriceM2 = priceMap['c_produc_1'] || 0; // ЗП сварщика за м²

  console.log('--- ОТЧЕТ БУХГАЛТЕРИИ ---');
  console.log('Плёнка (c_pr_1):', buyPrice, '| Кант (c_pr_4):', kantPriceM2);
  console.log('ЗП (c_produc_1):', laborPriceM2);
  console.log('Тип:', geo.type, '| sideTop:', geo.sideTop.toFixed(2), 'см');
  console.log('retailArea:', geo.retailArea, 'м² | productionArea:', geo.productionArea, 'м²');
  console.log('------------------------');

  // 3. Розничный слаг и коэффициент верхнего крепежа
  const { slug: retailSlug, topFactor } = getRetailProductSlug(window);
  const retailPriceM2 = priceMap[retailSlug] || 0;

  // 4. Стоимость плёнки в изделии
  //    Плёнка всегда кроится из прямоугольника: (maxW + припуск) × (maxH + припуск).
  //    geo.cutWidth и geo.cutHeight уже содержат SOLDER_ALLOWANCE — хардкода нет.
  const materialInProductCost = (geo.cutWidth * geo.cutHeight / 10_000) * buyPrice;

  // 5. Перерасход плёнки (рулон шире заготовки → разница в мусор)
  const rollWidthM = geo.rollWidth / 100;
  const cutWidthM = geo.cutWidth / 100;
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

  // 8. Розничная цена
  //    Закон Директора: клиент платит за габарит → строго по retailArea.
  const totalRetail = geo.retailArea * retailPriceM2 * topFactor;

  // 9. Себестоимость изделия (плёнка + кант, без перерасхода и ЗП)
  const totalCost = materialInProductCost + kantMaterialProductCost;

  // 10. Полные расходы
  const totalExpenses = totalCost + overspending + productionCost;

  // 11. Вспомогательные метрики для бухгалтерии
  const materialCutCost = rollWidthM * cutHeightM * buyPrice;
  const kantMaterialCost = kantMaterialProductCost + overspendingKant;

  return {
    costPrice: Math.round(totalCost),
    totalExpenses: Math.round(totalExpenses),
    retailPrice: Math.round(totalRetail),
    profit: Math.round(totalRetail - totalExpenses),

    // Исправляем здесь: подтягиваем цену из входящих данных (buyPrice)
    materialPriceM2: Math.round(buyPrice),

    materialInProductCost: Math.round(materialInProductCost),
    materialCutCost: Math.round(materialCutCost),
    overspending: Math.round(overspending),

    kantPriceM2,
    kantMaterialCost: Math.round(kantMaterialCost),
    kantMaterialProductCost: Math.round(kantMaterialProductCost),
    kantLaborCost: Math.round(overspendingKant),

    productionCost: Math.round(productionCost),
  };
}

// ---------------------------------------------------------------------------
// Вспомогательные
// ---------------------------------------------------------------------------

function getRetailProductSlug(item: WindowItem): { slug: string; topFactor: number } {
  const material = item.material;
  const fastenerType = item.fasteners?.type ?? 'none';

  const leftEnabled = item.fasteners?.sides?.left === true;
  const rightEnabled = item.fasteners?.sides?.right === true;
  const topState = item.fasteners?.sides?.top ?? false;
  const topEnabled = topState === true;

  const baseType = leftEnabled && rightEnabled ? fastenerType : 'none';
  const topFactor = topEnabled && baseType !== 'none' ? 4 / 3 : 1;

  const isTPU = material === 'ТПУ Полиуретан';

  const mapPVC: Record<string, string> = {
    none: 'prod_11',
    eyelet_10: 'prod_1',
    strap: 'prod_2',
    staple_pa: 'prod_3',
    staple_metal: 'prod_4',
    french_lock: 'prod_5',
  };

  const mapTPU: Record<string, string> = {
    none: 'prod_12',
    eyelet_10: 'prod_6',
    strap: 'prod_7',
    staple_pa: 'prod_8',
    staple_metal: 'prod_9',
    french_lock: 'prod_10',
  };

  const slug = (isTPU ? mapTPU : mapPVC)[baseType];

  return {
    slug: slug || (isTPU ? 'prod_12' : 'prod_11'),
    topFactor,
  };
}