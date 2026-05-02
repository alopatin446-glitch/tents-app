import { WindowItem } from '@/types';
import { calculateWindowGeometry } from './windowCalculations';

export interface WindowFinance {
  costPrice: number;      // Общая себестоимость
  retailPrice: number;    // Цена для клиента (розница)
  profit: number;         // Чистая прибыль
  overspending: number;   // ПЕРЕРАСХОД
  productionCost: number; // Стоимость изготовления
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
  const retailPriceM2 = priceMap['prod_1'] || 0;  // Розница для клиента за м2

  // 3. РАСЧЕТ СЕБЕСТОИМОСТИ МАТЕРИАЛА (по площади списания cutArea)
  const materialCost = geo.cutArea * buyPrice;

  // 4. РАСЧЕТ ПЕРЕРАСХОДА (убыток от ширины рулона)
  const overspending = (geo.cutArea - geo.areaWithKant) * buyPrice;

  // 5. СТОИМОСТЬ ИЗГОТОВЛЕНИЯ (Периметр изделия * (Кант + Работа))
  const perimeterM = geo.perimeter / 100; // Переводим см в метры
  const productionCost = perimeterM * (kantPrice + laborPrice);

  // ИТОГИ
  const totalCost = materialCost + productionCost;
  const totalRetail = geo.areaWithKant * retailPriceM2;

  return {
    costPrice: Math.round(totalCost),
    retailPrice: Math.round(totalRetail),
    profit: Math.round(totalRetail - totalCost),
    overspending: Math.round(overspending),
    productionCost: Math.round(productionCost),
  };
}