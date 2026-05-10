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
  overspending: number;            // Отходы (плёнка + кант + перерасход молнии)

  kantPriceM2: number;             // Цена канта за м²
  kantMaterialCost: number;        // Кант всего (с перерасходом)
  kantMaterialProductCost: number; // Кант, вошедший в изделие
  kantLaborCost: number;           // Отходы ленты канта

  productionCost: number;          // ЗП цеха (базовая + крепёж + допы)
  baseProductionCost: number;      // Базовое изготовление: productionArea × c_produc_1
  fastenersWork: number;           // Работа по крепежу: длина сторон × c_produc_fasteners_per_meter
  extrasWorkCost: number;          // Работа по допам: молния + утяжелитель + юбка + разделители + пайка + вырезы + ремешки

  fastenersRetail: number;         // Стоимость крепежа (розница, ₽)
  fastenersCost: number;           // Стоимость крепежа (себестоимость, ₽)
}

export type PriceMap = Record<string, number>;

const KANT_STRIP_WIDTH_M = 0.1;
const KANT_WASTE_STRIPS = 4;
const KANT_WASTE_LENGTH_M = 0.4;

interface FastenerPriceKeys {
  readonly retailKey: string;
  readonly costKey:   string;
}

const FASTENER_PRICE_KEYS: Readonly<Record<string, FastenerPriceKeys>> = {
  eyelet_10:    { retailKey: 'fast_eyelet_retail',     costKey: 'fast_eyelet_cost' },
  strap:        { retailKey: 'fast_strap_retail',      costKey: 'fast_strap_cost' },
  staple_pa:    { retailKey: 'fast_staple_pa_retail',  costKey: 'fast_staple_pa_cost' },
  staple_metal: { retailKey: 'fast_staple_m_retail',   costKey: 'fast_staple_m_cost' },
  french_lock:  { retailKey: 'fast_french_retail',     costKey: 'fast_french_cost' },
  none:         { retailKey: '',                        costKey: '' },
} as const;

function resolveFastenerKeys(type: string): FastenerPriceKeys {
  return FASTENER_PRICE_KEYS[type] ?? { retailKey: '', costKey: '' };
}

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
 * PVC_700  → c_pr_1 (fallback 0)
 * TINTED   → c_pr_2, без fallback на ПВХ → 0 если не настроен
 * TPU      → c_pr_3, fallback на c_pr_1 если не настроен
 * MOSQUITO → c_pr_5, без fallback → 0 если не настроен  [CORE-3C]
 */
function resolveBuyPrice(material: string, priceMap: PriceMap): number {
  if (material === 'TPU') {
    const v = priceMap['c_pr_3'];
    if (v !== undefined && v > 0 && v !== 9999) return v;
    return priceMap['c_pr_1'] || 0;
  }

  if (material === 'TINTED') {
    const v = priceMap['c_pr_2'];
    if (v !== undefined && v > 0 && v !== 9999) return v;
    return 0;
  }

  if (material === 'MOSQUITO') {
    const v = priceMap['c_pr_5'];
    if (v && v !== 9999) return v;
    return 0;
  }

  return priceMap['c_pr_1'] || 0;
}

/**
 * Разрешает розничную цену за м² для слага.
 * 0 при: slug отсутствует, значение = 0, значение = 9999.
 */
function resolveRetailPriceM2(slug: string, priceMap: PriceMap): number {
  const price = priceMap[slug];
  if (price === undefined || price === 0 || price === 9999) return 0;
  return price;
}

// ---------------------------------------------------------------------------
// FINAL-D V3: Расчёт работы производства по допам
// ---------------------------------------------------------------------------

interface ExtrasWorkResult {
  fastenersWork: number;      // Работа: пробивка крепежа по периметру (₽)
  extrasWorkCost: number;     // Работа: все допы — молния + утяж + юбка + разделитель + пайка + вырезы + ремешки (₽)
  zipperOverspending: number; // Перерасход молнии: +30 см на каждую (₽)
}

/**
 * Считает себестоимость работы производства по допам и крепежу.
 *
 * ВАЖНО:
 * — fastenersWork    → идёт в productionCost (работа, не материал)
 * — extrasWorkCost   → идёт в productionCost (работа)
 * — zipperOverspending → идёт в overspending (перерасход, не изделие)
 *
 * Не трогает: totalCost, fastenersCost, totalExpenses верхней формулы.
 */
function calculateExtrasWork(
  win: WindowItem,
  priceMap: PriceMap,
): ExtrasWorkResult {

  // ── Outer-размеры (в метрах) ────────────────────────────────────────────
  // outer = inner + кант (все в см → /100)
  const outerWidth  = (Math.max(win.widthTop, win.widthBottom) + win.kantLeft + win.kantRight) / 100;
  const outerHeight = (Math.max(win.heightLeft, win.heightRight) + win.kantTop + win.kantBottom) / 100;
  // outerBottom — нижняя сторона с кантом (для утяжелителя и юбки)
  const outerBottom = (win.widthBottom + win.kantLeft + win.kantRight) / 100;

  // ── 1. РАБОТА ПО КРЕПЕЖУ ────────────────────────────────────────────────
  // Сумма inner-длин сторон с активным крепежом × c_produc_fasteners_per_meter
  // INNER: без канта. top='default' !== true → не входит.
  const fastenersPerMeter = priceMap['c_produc_fasteners_per_meter'] ?? 80;
  let fastenersWork = 0;

  const ft = win.fasteners;
  if (ft && ft.type !== 'none') {
    const sides = ft.sides;
    // top: FastenerSideState ('default' | boolean) — только true считается активным
    if (sides.top    === true) fastenersWork += win.widthTop    / 100;
    if (sides.bottom === true) fastenersWork += win.widthBottom / 100;
    if (sides.left   === true) fastenersWork += win.heightLeft  / 100;
    if (sides.right  === true) fastenersWork += win.heightRight / 100;
    fastenersWork *= fastenersPerMeter;
  }

  // ── Нет additionalElements — возвращаем только крепёж ──────────────────
  const ae = win.additionalElements;
  if (!ae) {
    return { fastenersWork, extrasWorkCost: 0, zipperOverspending: 0 };
  }

  // ── Safe guards — защита от undefined в legacy-записях ─────────────────
  const zippers    = ae.zippers   ?? [];
  const dividers   = ae.dividers  ?? [];
  const welding    = ae.welding   ?? [];
  const cutouts    = ae.cutouts   ?? [];
  const strapsCount = ae.straps?.count ?? 0;

  // ── 2. МОЛНИЯ — работа и перерасход ────────────────────────────────────
  // Работа: длина молнии (outer) × c_produc_zipper_per_meter
  // Перерасход: +30 см материала молнии за каждую шт × addo_zipper_cost_per_meter
  const zipperPerMeter     = priceMap['c_produc_zipper_per_meter']  ?? 220;
  const zipperCostPerMeter = priceMap['addo_zipper_cost_per_meter'] ?? 250;
  let zipperWork         = 0;
  let zipperOverspending = 0;

  for (const z of zippers) {
    const len = z.orientation === 'vertical' ? outerHeight : outerWidth;
    zipperWork         += len * zipperPerMeter;
    zipperOverspending += 0.30 * zipperCostPerMeter; // 15 см сверху + 15 снизу
  }

  // ── 3. УТЯЖЕЛИТЕЛЬ ──────────────────────────────────────────────────────
  // (outerBottom − 2 см) × c_produc_weight_per_meter
  const weightPerMeter = priceMap['c_produc_weight_per_meter'] ?? 50;
  const weightWork = ae.hasWeight
    ? Math.max(0, outerBottom - 0.02) * weightPerMeter
    : 0;

  // ── 4. ЮБКА ─────────────────────────────────────────────────────────────
  // outerBottom (полный, без вычетов) × c_produc_skirt_per_meter
  const skirtPerMeter = priceMap['c_produc_skirt_per_meter'] ?? 100;
  const skirtWork = ae.hasSkirt ? outerBottom * skirtPerMeter : 0;

  // ── 5. РАЗДЕЛИТЕЛЬ ──────────────────────────────────────────────────────
  // Фактическая длина = полная сторона − offsetStart − offsetEnd
  // offsetStart / offsetEnd хранятся в см → /100
  const dividerPerMeter = priceMap['c_produc_divider_per_meter'] ?? 100;
  let dividerWork = 0;

  for (const d of dividers) {
    const total  = d.orientation === 'horizontal' ? outerWidth : outerHeight;
    const actual = Math.max(0, total - d.offsetStart / 100 - d.offsetEnd / 100);
    dividerWork += actual * dividerPerMeter;
  }

  // ── 6. ТЕХПАЙКА ─────────────────────────────────────────────────────────
  // Всегда на всю сторону — нельзя начать пайку в середине
  const weldingPerMeter = priceMap['c_produc_welding_per_meter'] ?? 200;
  let weldingWork = 0;

  for (const w of welding) {
    const len = w.orientation === 'vertical' ? outerHeight : outerWidth;
    weldingWork += len * weldingPerMeter;
  }

  // ── 7. ВЫРЕЗЫ И ЗАПЛАТКИ ────────────────────────────────────────────────
  // Малый:   обе стороны ≤ 10 см → 200
  // Большой: обе стороны > 30 см → 500
  // Средний: всё остальное        → 400
  const cutSmall  = priceMap['c_produc_cut_small_piece']  ?? 200;
  const cutMedium = priceMap['c_produc_cut_medium_piece'] ?? 400;
  const cutBig    = priceMap['c_produc_cut_big_piece']    ?? 500;
  let cutWork = 0;

  for (const c of cutouts) {
    const w = c.width;
    const h = c.height;
    if (w <= 10 && h <= 10) {
      cutWork += cutSmall;
    } else if (w > 30 && h > 30) {
      cutWork += cutBig;
    } else {
      cutWork += cutMedium;
    }
  }

  // ── 8. РЕМЕШКИ ФИКСАЦИИ СКРУТКИ ─────────────────────────────────────────
  // НЕ путать с fasteners.type === 'strap' (крепёж)
  // Это additionalElements.straps.count — ремешки фиксации в скрученном положении
  const strapPiece = priceMap['c_produc_fixation_strap_piece'] ?? 15;
  const strapWork  = strapsCount * strapPiece;

  // ── Итог работы по допам ────────────────────────────────────────────────
  const extrasWorkCost =
    zipperWork +
    weightWork +
    skirtWork  +
    dividerWork +
    weldingWork +
    cutWork     +
    strapWork;

  return { fastenersWork, extrasWorkCost, zipperOverspending };
}

// ---------------------------------------------------------------------------

export function calculateWindowFinance(
  window: WindowItem,
  priceMap: PriceMap
): WindowFinance {
  const geo = calculateWindowGeometry(window);

  const buyPrice     = resolveBuyPrice(window.material, priceMap);
  const kantPriceM2  = priceMap['c_pr_4']     || 0;
  const laborPriceM2 = priceMap['c_produc_1'] || 0;

  const { slug: retailSlug, topFactor } = getRetailProductSlug(window);
  const retailPriceM2 = resolveRetailPriceM2(retailSlug, priceMap);

  const materialInProductCost = (geo.cutWidth * geo.cutHeight / 10_000) * buyPrice;

  const rollWidthM = geo.rollWidth / 100;
  const cutWidthM  = geo.cutWidth  / 100;
  const cutHeightM = geo.cutHeight / 100;

  // ── ROTATION FIX ──────────────────────────────────────────────────────────
  // При geo.isRotated=true рулон подобран по высоте изделия, а полоса отрезается
  // по ширине изделия. Формулы должны учитывать фактическую ориентацию.
  //
  // stripLengthM  — длина полосы вдоль рулона (сколько рулона отрезаем).
  // fitsWidthM    — ширина изделия поперёк рулона (roll должен перекрыть её).
  //
  // TODO: Перенести material allocation и overspending
  //       на order-level roll optimization.
  //       Текущий runtime — per-window approximation.
  const stripLengthM = geo.isRotated ? cutWidthM  : cutHeightM;
  const fitsWidthM   = geo.isRotated ? cutHeightM : cutWidthM;

  const overspendingFilm = Math.max(0, rollWidthM - fitsWidthM) * stripLengthM * buyPrice;

  const cleanOuterPerimeterM = geo.perimeterWithKant / 100;
  const kantMaterialProductCost = cleanOuterPerimeterM * KANT_STRIP_WIDTH_M * kantPriceM2;

  const kantWasteM2 = KANT_WASTE_STRIPS * KANT_WASTE_LENGTH_M * KANT_STRIP_WIDTH_M;
  const overspendingKant = kantWasteM2 * kantPriceM2;

  // ── FINAL-D V3: работа производства по допам ────────────────────────────
  const { fastenersWork, extrasWorkCost, zipperOverspending } =
    calculateExtrasWork(window, priceMap);

  // Перерасход расширяется: плёнка + кант + перерасход молнии
  const overspending = overspendingFilm + overspendingKant + zipperOverspending;

  // productionCost расширяется: базовая ЗП + работа крепежа + работа допов
  // totalExpenses формула НЕ МЕНЯЕТСЯ — productionCost уже внутри неё
  const baseProductionCost = geo.productionArea * laborPriceM2;
  const productionCost     = baseProductionCost + fastenersWork + extrasWorkCost;

  const productRetail = geo.retailArea * retailPriceM2 * topFactor;

  const { fastenersRetail, fastenersCost } = calculateFastenerCosts(window, priceMap);

  const totalRetail = productRetail + fastenersRetail;

  const totalCost = materialInProductCost + kantMaterialProductCost;

  // !! НЕ МЕНЯТЬ эту формулу !!
  const totalExpenses = totalCost + overspending + productionCost + fastenersCost;

  const materialCutCost  = rollWidthM * stripLengthM * buyPrice;
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

    productionCost:    Math.round(productionCost),
    baseProductionCost: Math.round(baseProductionCost),
    fastenersWork:     Math.round(fastenersWork),
    extrasWorkCost:    Math.round(extrasWorkCost),

    fastenersRetail: Math.round(fastenersRetail),
    fastenersCost:   Math.round(fastenersCost),
  };
}

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

  // ─── CORE-3B: TINTED ─────────────────────────────────────────────────────
  if (material === 'TINTED') {
    const mapTINTED: Record<string, string> = {
      none:         'prod_18',
      eyelet_10:    'prod_13',
      strap:        'prod_14',
      staple_pa:    'prod_15',
      staple_metal: 'prod_16',
      french_lock:  'prod_17',
    };
    return { slug: mapTINTED[baseType] || 'prod_18', topFactor };
  }

  // ─── CORE-3C: MOSQUITO ───────────────────────────────────────────────────
  // Отдельная розница prod_19..prod_24. Крепёжная логика та же, что у ПВХ.
  // Buy: c_pr_5 (400 ₽/м²). Ограничение 197×197 проверяется в ItemsStep.
  if (material === 'MOSQUITO') {
    const mapMOSQUITO: Record<string, string> = {
      none:         'prod_19',
      eyelet_10:    'prod_20',
      strap:        'prod_21',
      staple_pa:    'prod_22',
      staple_metal: 'prod_23',
      french_lock:  'prod_24',
    };
    return { slug: mapMOSQUITO[baseType] || 'prod_19', topFactor };
  }

  // ─── CORE-3A: TPU / PVC_700 ──────────────────────────────────────────────
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
  return { slug: slug || (isTPU ? 'prod_12' : 'prod_11'), topFactor };
}