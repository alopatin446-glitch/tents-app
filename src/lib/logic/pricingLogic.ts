import { WindowItem } from '@/types';
import { calculateWindowGeometry } from './windowCalculations';

export interface WindowFinance {
  costPrice: number;              // Общая себестоимость
  retailPrice: number;            // Цена для клиента
  profit: number;                 // Чистая прибыль

  materialPriceM2: number;        // Цена материала полотна за м²
  materialInProductCost: number;  // Плёнка, которая вошла в изделие
  materialCutCost: number;        // Вся списанная плёнка
  overspending: number;           // Перерасход плёнки в ₽

  kantPriceM2: number;            // Цена канта за м²
  kantMaterialCost: number;       // Кант: материал, всего с перерасходом
  kantLaborCost: number;          // Работа по пайке канта

  productionCost: number;         // Изготовление: кант + работа
}

export type PriceMap = Record<string, number>;

/**
 * ФИНАНСОВЫЙ МОСТ:
 * Расчёт экономики окна на основе фактической геометрии и живого прайса.
 */
export function calculateWindowFinance(
  window: WindowItem,
  priceMap: PriceMap
): WindowFinance {
  // 1. Геометрия
  const geo = calculateWindowGeometry(window);

  // 2. Себестоимость из прайса
  const buyPrice = priceMap['c_pr_1'] || 0;        // Закупка полотна за м²
  const kantPriceM2 = priceMap['c_pr_4'] || 0;     // Кант за м²
  const laborPriceM = priceMap['c_produc_1'] || 0; // Работа по пайке за м.п.

  const getRetailProductSlug = (item: WindowItem): { slug: string; topFactor: number } => {
    const material = item.material;
    const fastenerType = item.fasteners?.type ?? 'none';

    const leftEnabled = item.fasteners?.sides?.left === true;
    const rightEnabled = item.fasteners?.sides?.right === true;
    const topState = item.fasteners?.sides?.top ?? false;

    const topEnabled = topState === true;

    let baseType = 'none';

    if (leftEnabled && rightEnabled) {
      baseType = fastenerType;
    }

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

    const slug = isTPU ? mapTPU[baseType] : mapPVC[baseType];

    return { slug: slug || (isTPU ? 'prod_12' : 'prod_11'), topFactor };
  };

  const { slug: retailSlug, topFactor } = getRetailProductSlug(window);
  const retailPriceM2 = priceMap[retailSlug] || 0;

  // 3. Плёнка
  const materialInProductCost = geo.areaMaterial * buyPrice;
  const materialCutCost = geo.cutArea * buyPrice;
  const overspending = geo.wasteArea * buyPrice;

  // 4. Кант
  // geo.kantTotalArea уже включает:
  // - кант в изделии
  // - перерасход +30 см на каждую сторону
  // - 2 слоя
  const kantMaterialCost = geo.kantTotalArea * kantPriceM2;

  // 5. Работа по пайке канта
  const perimeterM = geo.perimeter / 100;
  const kantLaborCost = perimeterM * laborPriceM;

  // 6. Производство
  const productionCost = kantMaterialCost + kantLaborCost;

  // 7. Итоги
  const totalCost = materialCutCost + productionCost;
  const totalRetail = geo.areaWithKant * retailPriceM2 * topFactor;

  return {
    costPrice: Math.round(totalCost),
    retailPrice: Math.round(totalRetail),
    profit: Math.round(totalRetail - totalCost),

    materialPriceM2: buyPrice,
    materialInProductCost: Math.round(materialInProductCost),
    materialCutCost: Math.round(materialCutCost),
    overspending: Math.round(overspending),

    kantPriceM2,
    kantMaterialCost: Math.round(kantMaterialCost),
    kantLaborCost: Math.round(kantLaborCost),

    productionCost: Math.round(productionCost),
  };
}