import { WindowItem } from '@/types';
import { calculateWindowGeometry } from './windowCalculations';

export interface WindowFinance {
  costPrice: number;               // 1737 (Чистое изделие)
  totalExpenses: number;           // Будущие 2766 (Все расходы)
  retailPrice: number;            // Розничная цена для клиента 
  profit: number;                 // Чистая прибыль (розничная цена - общая себестоимость)

  materialPriceM2: number;        // Цена материала полотна за м² 
  materialCutCost: number;        // Вся списанная плёнка (Ширина рулона * длину заказа 220*206)
  materialInProductCost: number;  // Плёнка, которая вошла в изделие с учётом припоя (пример 206 на 206)
  overspending: number;           // Плёнка, которая ушла в мусорку (220 на 206 - 206 на 206 = 14 на 206)

  kantPriceM2: number;            // Цена канта за м²
  kantMaterialCost: number;       // Кант: материал, всего с перерасходом 
  kantMaterialProductCost: number // Кант, который пошёл в изделие без + 40см.
  kantLaborCost: number;          // Кант, который ушёл в мусорку, те самые +40см

  productionCost: number;         // Изготовление изделия (площадь * цену)
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

  // ВРЕМЕННЫЙ ДИРЕКТОРСКИЙ КОНТРОЛЬ
  console.log('--- ОТЧЕТ БУХГАЛТЕРИИ ---');
  console.log('Цена закупки (c_pr_1):', buyPrice);
  console.log('Цена канта (c_pr_4):', priceMap['c_pr_4']);
  console.log('------------------------');

  const kantPriceM2 = priceMap['c_pr_4'] || 0;     // Кант за м²
  const laborPriceM2 = priceMap['c_produc_1'] || 0; // ЗП мастера за м² проема

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

  // 3. Плёнка (Чистый расчет заготовки 206х206 для 200х200)
  // Принудительно считаем от габарита изделия + припуск, игнорируя ширину рулона для этой строки
  const manualCutAreaM2 = ((Math.max(window.widthTop, window.widthBottom) + 6) * (Math.max(window.heightLeft, window.heightRight) + 6)) / 10000;
  const materialInProductCost = manualCutAreaM2 * buyPrice;

  // 4. Перерасход (Глава 3 - Только мусор)
  const rollWidthM = geo.rollWidth / 100;
  const cutWidthM = geo.cutWidth / 100;
  const cutHeightM = geo.cutHeight / 100;

  // Пленка: (2.20 - 2.06) * 2.06 * цена
  const overspendingFilm = (rollWidthM - cutWidthM) * cutHeightM * buyPrice;

  // Кант: 4 отрезка по 40 см (0.4м) шириной 10 см (0.1м)
  const kantAllowanceM2 = (0.4 * 0.1) * 4;
  const overspendingKant = kantAllowanceM2 * kantPriceM2;

  // Итоговый перерасход в деньгах
  const overspending = overspendingFilm + overspendingKant;

  // 5. Кант (Глава 2 - Внешний периметр готового изделия)
  const cleanOuterPerimeterM = geo.perimeterWithKant / 100;
  const kantMaterialProductCost = cleanOuterPerimeterM * 0.1 * kantPriceM2;

  // 5.5 Розничный расчет
  const totalRetail = geo.areaWithKant * retailPriceM2 * topFactor;

  // ЗП Мастера остается для отчетности, но НЕ входит в costPrice
  const productionCost = geo.areaMaterial * laborPriceM2;

  // СТРОГО: Пленка (1485.26) + Кант (252) = 1737.26
  const totalCost = materialInProductCost + kantMaterialProductCost;

// 6. Итоги для интерфейса
  const materialCutCost = (rollWidthM * cutHeightM) * buyPrice;
  const kantMaterialCost = kantMaterialProductCost + overspendingKant;

  // ИТОГО РАСХОДОВ: (Материалы 1737) + Перерасход (149) + Изготовление (880) + Монтаж (0)
  const totalExpenses = totalCost + overspending + productionCost;

  return {
    // В поле "Стоимость изделия" пойдет только Пленка + Кант (1737)
    costPrice: Math.round(totalCost), 
    
    // В поле "Всего расходов" пойдет полная сумма (2766)
    totalExpenses: Math.round(totalExpenses), 
    
    retailPrice: Math.round(totalRetail),
    profit: Math.round(totalRetail - totalExpenses),

    materialPriceM2: buyPrice,
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