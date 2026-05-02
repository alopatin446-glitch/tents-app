import { WindowItem } from '@/types';
import { calculateWindowGeometry } from './windowCalculations';

export interface WindowFinance {
  costPrice: number;              // Общая себестоимость
  retailPrice: number;            // Цена для клиента
  profit: number;                 // Чистая прибыль
  materialPriceM2: number;        // Цена материала за м²
  materialInProductCost: number;  // Материал, который вошёл в изделие
  materialCutCost: number;        // Весь списанный материал
  overspending: number;           // Перерасход материала в ₽
  productionCost: number;         // Стоимость изготовления
}

export type PriceMap = Record<string, number>;

/**
 * ФИНАНСОВЫЙ МОСТ: Расчет экономики окна на основе фактического раскроя.
 * Теперь принимает объект с ценами из БД или Снапшота.
 */
export function calculateWindowFinance(
  window: WindowItem,
  priceMap: Record<string, number> // Живой прайс из БД или архив
): WindowFinance {
  // 1. Получаем точную геометрию из расчетного ядра
  const geo = calculateWindowGeometry(window);

  // 2. ЦЕНЫ ИЗ ПЕРЕДАННОГО КАРТОТЕКИ (Если цены нет — строго 0)
  const buyPrice = priceMap['c_pr_1'] || 0;       // Закупка ПВХ за м2
  const kantPrice = priceMap['c_pr_4'] || 0;      // Цена ткани канта за пог. м
  const laborPrice = priceMap['c_produc_1'] || 0; // Зарплата мастера за метр пайки

  const getRetailProductSlug = (item: WindowItem): { slug: string; topFactor: number } => {
    const material = item.material;

    const fastenerType = item.fasteners?.type ?? 'none';

    const leftEnabled = item.fasteners?.sides?.left === true;
    const rightEnabled = item.fasteners?.sides?.right === true;
    const topState = item.fasteners?.sides?.top ?? false;

    const topEnabled = topState === true;

    // 1. Определяем базу по вертикалям
    let baseType = 'none';

    if (leftEnabled && rightEnabled) {
      baseType = fastenerType;
    } else {
      baseType = 'none';
    }

    const topFactor =
      topEnabled && baseType !== 'none'
        ? 4 / 3
        : 1;

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

    return { slug, topFactor };
  };

  const { slug: retailSlug, topFactor } = getRetailProductSlug(window);
  const retailPriceM2 = priceMap[retailSlug] || 0;

  // 3. Материал считается одной ценой за м²:
  // что вошло в изделие и что ушло в перерасход — стоит одинаково.
  const materialInProductCost = geo.areaMaterial * buyPrice;
  const materialCutCost = geo.cutArea * buyPrice;

  // 4. Перерасход материала — только по wasteArea из геометрического ядра.
  const overspending = geo.wasteArea * buyPrice;

  // 5. СТОИМОСТЬ ИЗГОТОВЛЕНИЯ (Периметр изделия * (Кант + Работа))
  const perimeterM = geo.perimeter / 100; // Переводим см в метры
  const productionCost = perimeterM * (kantPrice + laborPrice);

  // ИТОГИ
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
    productionCost: Math.round(productionCost),
  };
}