export interface DefaultPriceRow {
    slug: string;
    name: string;
    value: number;
    unit: string;
    category: string;
}

export const DEFAULT_PRICE_ROWS: DefaultPriceRow[] = [
    { slug: 'c_fa_1', name: 'Люверс 10мм + шайба (цинк)', value: 3, unit: 'Шт', category: 'cost_fasteners' },
    { slug: 'c_fa_10', name: 'Люверс 37 + полиамидная скоба (цинк)', value: 75, unit: 'Шт', category: 'cost_fasteners' },
    { slug: 'c_fa_2', name: 'Люверс 10мм + шайба (черный)', value: 6, unit: 'Шт', category: 'cost_fasteners' },
    { slug: 'c_fa_3', name: 'Люверс 18 + французская скоба (цветной)', value: 150, unit: 'Шт', category: 'cost_fasteners' },
    { slug: 'c_fa_4', name: 'Люверс 18 + французская скоба (цинк)', value: 120, unit: 'Шт', category: 'cost_fasteners' },
    { slug: 'c_fa_5', name: 'Люверс 27+ скоба + ремень (цветной)', value: 85, unit: 'Шт', category: 'cost_fasteners' },
    { slug: 'c_fa_6', name: 'Люверс 27+ скоба + ремень (цинк)', value: 65, unit: 'Шт', category: 'cost_fasteners' },
    { slug: 'c_fa_7', name: 'Люверс 37 + металл скоба (цветной)', value: 120, unit: 'Шт', category: 'cost_fasteners' },
    { slug: 'c_fa_8', name: 'Люверс 37 + металл скоба (цинк)', value: 85, unit: 'Шт', category: 'cost_fasteners' },
    { slug: 'c_fa_9', name: 'Люверс 37 + полиамидная скоба (цветной)', value: 110, unit: 'Шт', category: 'cost_fasteners' },

    // ── Системные ключи для алгоритма расчёта крепежа (pricingLogic.ts) ──
    { slug: 'fast_eyelet_cost',    name: 'Расчёт: Люверс 10мм (цинк) — себес',           value: 3,   unit: 'Шт', category: 'cost_fasteners' },
    { slug: 'fast_strap_cost',     name: 'Расчёт: Ремешок (цинк) — себес',               value: 65,  unit: 'Шт', category: 'cost_fasteners' },
    { slug: 'fast_staple_pa_cost', name: 'Расчёт: Полиамид. скоба (цинк) — себес',       value: 75,  unit: 'Шт', category: 'cost_fasteners' },
    { slug: 'fast_staple_m_cost',  name: 'Расчёт: Металл. скоба (цинк) — себес',         value: 85,  unit: 'Шт', category: 'cost_fasteners' },
    { slug: 'fast_french_cost',    name: 'Расчёт: Французская скоба (цинк) — себес',     value: 120, unit: 'Шт', category: 'cost_fasteners' },

    // ── Системные строки для алгоритма себестоимости монтажа ──
    { slug: 'team_cost_pro',    name: 'Себес: бригада Про',       value: 350, unit: 'м2',    category: 'cost_install' },
    { slug: 'team_cost_mid',    name: 'Себес: бригада Стандарт',  value: 280, unit: 'м2',    category: 'cost_install' },
    { slug: 'team_cost_junior', name: 'Себес: бригада Эконом',    value: 200, unit: 'м2',    category: 'cost_install' },
    { slug: 'fuel_cost_per_km', name: 'Себес: ГСМ за км',         value: 8,   unit: 'км',    category: 'cost_install' },
    { slug: 'extra_works_cost_factor', name: 'Коэффициент себеса доп. работ', value: 0.6, unit: 'коэф.', category: 'cost_install' },

    { slug: 'c_in_1', name: 'ГСМ монтажника',                     value: 16,    unit: 'Км.',      category: 'cost_install' },
    { slug: 'c_in_2', name: 'Минимальная стоимость монтажа',       value: 5000,  unit: 'Шт.',      category: 'cost_install' },
    { slug: 'c_in_3', name: 'Монтаж по бетону',                    value: 500,   unit: 'м2',       category: 'cost_install' },
    { slug: 'c_in_4', name: 'Монтаж по дереву',                    value: 350,   unit: 'м2',       category: 'cost_install' },
    { slug: 'c_in_5', name: 'Монтаж по кирпичу',                   value: 600,   unit: 'м2',       category: 'cost_install' },
    { slug: 'c_in_6', name: 'Монтаж по круглому брусу',            value: 600,   unit: 'м2',       category: 'cost_install' },
    { slug: 'c_in_7', name: 'Монтаж по металлу',                   value: 600,   unit: 'м2',       category: 'cost_install' },
    { slug: 'c_in_8', name: 'Строительные леса',                   value: 15000, unit: 'День',     category: 'cost_install' },
    { slug: 'c_in_9', name: 'Установка базы из бруса',             value: 200,   unit: 'Пог.м.',   category: 'cost_install' },

    // ── Себестоимость производства — базовая операция (НЕ МЕНЯТЬ) ──
    { slug: 'c_produc_1',  name: 'Пайка канта к плёнке',                           value: 220, unit: 'м2.',      category: 'cost_production' },
    // ── Устаревшие строки прайса (НЕ удалять — отображаются в UI) ──
    { slug: 'c_produc_2',  name: 'Пробивка и завальцоовка люверса',                value: 80,  unit: 'Шт.',      category: 'cost_production' },
    { slug: 'c_produc_3',  name: 'Прошивка и припой молнии',                       value: 220, unit: 'М.',       category: 'cost_production' },
    { slug: 'c_produc_4',  name: 'Изготовление ремешка фиксации',                  value: 15,  unit: 'Шт.',      category: 'cost_production' },
    { slug: 'c_produc_5',  name: 'Вырез малый',                                    value: 200, unit: 'Шт.',      category: 'cost_production' },
    { slug: 'c_produc_6',  name: 'Вырез большой',                                  value: 400, unit: 'Шт.',      category: 'cost_production' },
    { slug: 'c_produc_7',  name: 'Техническая пайка',                              value: 200, unit: 'М.',       category: 'cost_production' },
    { slug: 'c_produc_8',  name: 'Изготовление и установка утяжелителя',           value: 50,  unit: 'М.',       category: 'cost_production' },
    { slug: 'c_produc_9',  name: 'Припой Юбки к изделию',                          value: 100, unit: 'М.',       category: 'cost_production' },
    { slug: 'c_produc_10', name: 'Припой разделительной полосы',                   value: 100, unit: 'М.',       category: 'cost_production' },
    { slug: 'c_produc_11', name: 'Покраска бруса',                                 value: 200, unit: 'М.',       category: 'cost_production' },
    { slug: 'c_produc_12', name: 'Проверка и Упаковка для клиента и на монтаж',    value: 500, unit: 'За заказ', category: 'cost_production' },
    // ── Системные ключи для алгоритма расчёта производства (FINAL-D V3) ──────
    // Используются ТОЛЬКО в pricingLogic.ts. Не дублируют c_produc_2..12.
    { slug: 'c_produc_fasteners_per_meter',    name: 'Изготовление: пробивка и завальцовка крепежа', value: 80,  unit: 'М.',  category: 'cost_production' },
    { slug: 'c_produc_zipper_per_meter',       name: 'Изготовление: прошивка и припой молнии',       value: 220, unit: 'М.',  category: 'cost_production' },
    { slug: 'c_produc_fixation_strap_piece',   name: 'Изготовление: ремешок фиксации',               value: 15,  unit: 'Шт.', category: 'cost_production' },
    { slug: 'c_produc_cut_small_piece',        name: 'Изготовление: вырез малый',                    value: 200, unit: 'Шт.', category: 'cost_production' },
    { slug: 'c_produc_cut_medium_piece',       name: 'Изготовление: вырез средний',                  value: 400, unit: 'Шт.', category: 'cost_production' },
    { slug: 'c_produc_cut_big_piece',          name: 'Изготовление: вырез большой',                  value: 500, unit: 'Шт.', category: 'cost_production' },
    { slug: 'c_produc_welding_per_meter',      name: 'Изготовление: техпайка',                       value: 200, unit: 'М.',  category: 'cost_production' },
    { slug: 'c_produc_weight_per_meter',       name: 'Изготовление: установка утяжелителя',          value: 50,  unit: 'М.',  category: 'cost_production' },
    { slug: 'c_produc_skirt_per_meter',        name: 'Изготовление: пайка юбки',                     value: 100, unit: 'М.',  category: 'cost_production' },
    { slug: 'c_produc_divider_per_meter',      name: 'Изготовление: разделительная полоса',          value: 100, unit: 'М.',  category: 'cost_production' },
    { slug: 'c_produc_paint_bar_per_meter',    name: 'Изготовление: покраска бруса',                 value: 200, unit: 'М.',  category: 'cost_production' },
    { slug: 'c_produc_profile_weld_per_seam',  name: 'Изготовление: сварка профильной системы',      value: 750, unit: 'Шт.', category: 'cost_production' },

    { slug: 'c_pr_1', name: 'Пвх 700 мкр. Crystal Window» прозрачный ', value: 350, unit: 'м2', category: 'cost_products' },
    { slug: 'c_pr_2', name: 'Тонировка ПВХ', value: 400, unit: 'м2', category: 'cost_products' },
    { slug: 'c_pr_3', name: 'Пленка ТПУ 700 мкр. Crystal Window LX TPU', value: 750, unit: 'м2', category: 'cost_products' },
    { slug: 'c_pr_4', name: 'Кант 650гр м2 «sealtex»', value: 300, unit: 'м2', category: 'cost_products' },
    // ── CORE-3C: Москитная сетка — закупка ──────────────────────────────────
    { slug: 'c_pr_5', name: 'Москитная сетка', value: 400, unit: 'м2', category: 'cost_products' },

    { slug: 'addo_1',  name: 'Молния витая Waterproof, влагостойка, с двух сторонним бегунком', value: 1600, unit: 'Пог.м.', category: 'retail_addons' },
    { slug: 'addo_10', name: 'Ремешок фиксации в скрученном положении на фастексе',             value: 350,  unit: 'Шт',     category: 'retail_addons' },
    { slug: 'addo_2',  name: 'Утяжелитель',                                                     value: 900,  unit: 'Пог.м.', category: 'retail_addons' },
    { slug: 'addo_3',  name: 'Разделитель',                                                     value: 1000, unit: 'Пог.м.', category: 'retail_addons' },
    { slug: 'addo_4',  name: 'Техническая пайка',                                               value: 500,  unit: 'Пог.м.', category: 'retail_addons' },
    { slug: 'addo_5',  name: 'Вырез малый',                                                     value: 500,  unit: 'Шт',     category: 'retail_addons' },
    { slug: 'addo_6',  name: 'Вырез большой',                                                   value: 1000, unit: 'Шт',     category: 'retail_addons' },
    { slug: 'addo_7',  name: 'Заплатка',                                                        value: 500,  unit: 'Шт',     category: 'retail_addons' },
    { slug: 'addo_8',  name: 'Юбка',                                                            value: 650,  unit: 'Пог.м.', category: 'retail_addons' },
    { slug: 'addo_9',  name: 'Ремешок фиксации в скрученном положении на люверсе',              value: 250,  unit: 'Шт',     category: 'retail_addons' },

    // ── Системные ключи для алгоритма расчёта допов (extrasCalculations.ts) ──
    { slug: 'addo_zipper_retail',        name: 'Расчёт: Молния — розница (шт)',            value: 1600, unit: 'шт',     category: 'retail_addons' },
    { slug: 'addo_divider_retail',       name: 'Расчёт: Разделитель — розница (шт)',        value: 1000, unit: 'шт',     category: 'retail_addons' },
    { slug: 'addo_cut_retail',           name: 'Расчёт: Вырез — розница (шт)',              value: 750,  unit: 'шт',     category: 'retail_addons' },
    { slug: 'addo_patch_retail',         name: 'Расчёт: Заплатка — розница (шт)',           value: 500,  unit: 'шт',     category: 'retail_addons' },
    { slug: 'addo_welding_retail',       name: 'Расчёт: Техпайка — розница (пог.м.)',       value: 500,  unit: 'пог.м.', category: 'retail_addons' },
    { slug: 'addo_weight_retail',        name: 'Расчёт: Утяжелитель — розница (пог.м.)',    value: 900,  unit: 'пог.м.', category: 'retail_addons' },
    { slug: 'addo_skirt_retail',         name: 'Расчёт: Юбка — розница (пог.м.)',           value: 650,  unit: 'пог.м.', category: 'retail_addons' },
    { slug: 'addo_strap_grommet_retail', name: 'Расчёт: Ремешок люверс — розница (шт)',    value: 250,  unit: 'шт',     category: 'retail_addons' },
    { slug: 'addo_strap_fastex_retail',  name: 'Расчёт: Ремешок фастекс — розница (шт)',   value: 350,  unit: 'шт',     category: 'retail_addons' },

    // ── Себестоимость допов ──────────────────────────────────────────────────
    { slug: 'addo_zipper_cost',           name: 'Расчёт: Молния — себес (шт)',              value: 800,  unit: 'шт',     category: 'cost_addons' },
    { slug: 'addo_divider_cost',          name: 'Расчёт: Разделитель — себес (пог.м.)',     value: 300,  unit: 'пог.м.', category: 'cost_addons' },
    { slug: 'addo_cut_cost',              name: 'Расчёт: Вырез — себес (шт)',               value: 200,  unit: 'шт',     category: 'cost_addons' },
    { slug: 'addo_patch_cost',            name: 'Расчёт: Заплатка — себес (шт)',            value: 150,  unit: 'шт',     category: 'cost_addons' },
    { slug: 'addo_welding_cost',          name: 'Расчёт: Техпайка — себес (пог.м.)',        value: 200,  unit: 'пог.м.', category: 'cost_addons' },
    { slug: 'addo_weight_cost',           name: 'Расчёт: Утяжелитель — себес (пог.м.)',     value: 300,  unit: 'пог.м.', category: 'cost_addons' },
    { slug: 'addo_skirt_cost',            name: 'Расчёт: Юбка — себес (пог.м.)',            value: 200,  unit: 'пог.м.', category: 'cost_addons' },
    // DEPRECATED: addo_strap_cost — generic slug, не читается в расчёте.
    // extrasCalculations.ts использует addo_strap_grommet_cost / addo_strap_fastex_cost.
    // Оставлен для отображения в UI страницы Цен. Не удалять.
    { slug: 'addo_strap_cost',            name: 'Расчёт: Ремешок — себес (шт) [устарел]',  value: 50,   unit: 'шт',     category: 'cost_addons' },
    // ── CH2-BUG-01 FIX: Себестоимость стяжек по типу ───────────────────────
    // Используются в calculateExtrasAsServiceItems (extrasCalculations.ts).
    // Без этих slug: priceMap[costKey] → undefined → ?? 9999 → hasPriceError = true.
    { slug: 'addo_strap_grommet_cost',    name: 'Расчёт: Стяжка люверс — себес (шт)',      value: 15,   unit: 'шт',     category: 'cost_addons' },
    { slug: 'addo_strap_fastex_cost',     name: 'Расчёт: Стяжка фастекс — себес (шт)',     value: 30,   unit: 'шт',     category: 'cost_addons' },
    // Перерасход молнии: +30 см на каждую молнию (15 сверху + 15 снизу)
    // НЕ путать с addo_zipper_cost — тот slug не существовал, это новый
    { slug: 'addo_zipper_cost_per_meter', name: 'Молния себестоимость за метр',             value: 250,  unit: 'М.',     category: 'cost_addons' },

    { slug: 'fast_eyelet_retail',     name: 'Расчёт: Люверс 10мм (цинк) — розница',           value: 12,  unit: 'Шт', category: 'retail_fasteners' },
    { slug: 'fast_strap_retail',      name: 'Расчёт: Ремешок (цинк) — розница',               value: 105, unit: 'Шт', category: 'retail_fasteners' },
    { slug: 'fast_staple_pa_retail',  name: 'Расчёт: Полиамид. скоба (цинк) — розница',       value: 120, unit: 'Шт', category: 'retail_fasteners' },
    { slug: 'fast_staple_m_retail',   name: 'Расчёт: Металл. скоба (цинк) — розница',         value: 150, unit: 'Шт', category: 'retail_fasteners' },
    { slug: 'fast_french_retail',     name: 'Расчёт: Французская скоба (цинк) — розница',     value: 190, unit: 'Шт', category: 'retail_fasteners' },

    // ── Системные строки для алгоритма розничного монтажа ──
    { slug: 'team_retail_pro',    name: 'Бригада Про',       value: 850, unit: 'м2', category: 'retail_install' },
    { slug: 'team_retail_mid',    name: 'Бригада Стандарт',  value: 720, unit: 'м2', category: 'retail_install' },
    { slug: 'team_retail_junior', name: 'Бригада Эконом',    value: 600, unit: 'м2', category: 'retail_install' },

    { slug: 'base_foundation_wood',       name: 'Базовое основание: брус',         value: 0, unit: 'м2',    category: 'retail_install' },
    { slug: 'base_foundation_concrete',   name: 'Базовое основание: бетон',        value: 0, unit: 'м2',    category: 'retail_install' },
    { slug: 'base_foundation_brick',      name: 'Базовое основание: кирпич',       value: 0, unit: 'м2',    category: 'retail_install' },
    { slug: 'base_foundation_metal',      name: 'Базовое основание: металл',       value: 0, unit: 'м2',    category: 'retail_install' },
    { slug: 'base_foundation_round_wood', name: 'Базовое основание: круглый брус', value: 0, unit: 'м2',    category: 'retail_install' },

    { slug: 'extra_foundation_wood',       name: 'Доп. основание: брус',         value: 0, unit: 'м.п.', category: 'retail_install' },
    { slug: 'extra_foundation_concrete',   name: 'Доп. основание: бетон',        value: 0, unit: 'м.п.', category: 'retail_install' },
    { slug: 'extra_foundation_brick',      name: 'Доп. основание: кирпич',       value: 0, unit: 'м.п.', category: 'retail_install' },
    { slug: 'extra_foundation_metal',      name: 'Доп. основание: металл',       value: 0, unit: 'м.п.', category: 'retail_install' },
    { slug: 'extra_foundation_round_wood', name: 'Доп. основание: круглый брус', value: 0, unit: 'м.п.', category: 'retail_install' },

    { slug: 'beam_wood_50x50',      name: 'Брусок обычный 50×50',      value: 0, unit: 'м.п.', category: 'retail_install' },
    { slug: 'beam_planed_wood_50x50', name: 'Брусок строганный 50×50', value: 0, unit: 'м.п.', category: 'retail_install' },
    { slug: 'beam_timber_100x100',  name: 'Брус обычный 10×10',        value: 0, unit: 'м.п.', category: 'retail_install' },
    { slug: 'beam_timber_150x150',  name: 'Брус обычный 15×15',        value: 0, unit: 'м.п.', category: 'retail_install' },

    { slug: 'height_stairs',   name: 'Высотные работы: лестница',         value: 0, unit: 'день', category: 'retail_install' },
    { slug: 'height_scaffold',  name: 'Высотные работы: леса',            value: 0, unit: 'день', category: 'retail_install' },
    { slug: 'height_both',      name: 'Высотные работы: лестница + леса', value: 0, unit: 'день', category: 'retail_install' },

    { slug: 'km_retail',          name: 'ГСМ розница',                     value: 16,   unit: 'км',     category: 'retail_install' },
    { slug: 'min_retail_mounting', name: 'Минимальная стоимость монтажа',  value: 7500, unit: 'заказ',  category: 'retail_install' },

    { slug: 'inst_1', name: 'Монтаж по дереву',               value: 650,   unit: 'м2',     category: 'retail_install' },
    { slug: 'inst_2', name: 'Монтаж по кирпичу',              value: 950,   unit: 'м2',     category: 'retail_install' },
    { slug: 'inst_3', name: 'Монтаж по бетону',               value: 850,   unit: 'м2',     category: 'retail_install' },
    { slug: 'inst_4', name: 'Монтаж по металлу',              value: 1200,  unit: 'м2',     category: 'retail_install' },
    { slug: 'inst_5', name: 'Монтаж по круглому брусу',       value: 1000,  unit: 'м2',     category: 'retail_install' },
    { slug: 'inst_6', name: 'ГСМ монтажника',                 value: 25,    unit: 'Км',     category: 'retail_install' },
    { slug: 'inst_7', name: 'Минимальная стоимость монтажа',  value: 7500,  unit: 'Шт',     category: 'retail_install' },
    { slug: 'inst_8', name: 'Строительные леса',              value: 20000, unit: 'день',   category: 'retail_install' },
    { slug: 'inst_9', name: 'Установка базы из бруса',        value: 450,   unit: 'Пог.м.', category: 'retail_install' },

    // ── PVC_700 ──────────────────────────────────────────────────────────────
    { slug: 'prod_1',  name: 'Окно Глухое ПВХ',                 value: 1600, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_11', name: 'Окно без люверсов ПВХ',           value: 1300, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_2',  name: 'Окно на ремешках ПВХ',            value: 2000, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_3',  name: 'Окно на полиамидной скобе ПВХ',   value: 2400, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_4',  name: 'Окно на металлической скоба ПВХ', value: 2800, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_5',  name: 'Окно на французской скобе ПВХ',   value: 3000, unit: 'м2', category: 'retail_products' },

    // ── TPU ──────────────────────────────────────────────────────────────────
    { slug: 'prod_12', name: 'Окно без люверсов ТПУ',              value: 2200, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_6',  name: 'Окно Глухое ТПУ',                    value: 2500, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_7',  name: 'Окно на ремешках ТПУ',               value: 3000, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_8',  name: 'Окно на полиамидной скобе ТПУ',      value: 3400, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_9',  name: 'Окно на металлической скоба ТПУ',    value: 3800, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_10', name: 'Окно на французской скобе ТПУ',      value: 4000, unit: 'м2', category: 'retail_products' },

    // ── CORE-3B: TINTED — отдельная розница (TINTED = PVC + 200 ₽/м²) ──────
    // none→prod_18, eyelet_10→prod_13, strap→prod_14,
    // staple_pa→prod_15, staple_metal→prod_16, french_lock→prod_17
    { slug: 'prod_18', name: 'Окно без люверсов Тонировка',           value: 1500, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_13', name: 'Окно Глухое Тонировка',                 value: 1800, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_14', name: 'Окно на ремешках Тонировка',            value: 2200, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_15', name: 'Окно на полиамидной скобе Тонировка',   value: 2600, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_16', name: 'Окно на металлической скобе Тонировка', value: 3000, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_17', name: 'Окно на французской скобе Тонировка',   value: 3200, unit: 'м2', category: 'retail_products' },

    // ── CORE-3C: MOSQUITO — отдельная розница ──────────────────────────────
    // none→prod_19, eyelet_10→prod_20, strap→prod_21,
    // staple_pa→prod_22, staple_metal→prod_23, french_lock→prod_24
    // Ограничение: max 197×197 см внутренний размер (проверяется в ItemsStep).
    { slug: 'prod_19', name: 'Москитка без крепежа',          value: 1600, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_20', name: 'Москитка люверс 10мм',          value: 1600, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_21', name: 'Москитка на ремешках',          value: 1980, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_22', name: 'Москитка полиамидная скоба',    value: 2400, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_23', name: 'Москитка металлическая скоба',  value: 2600, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_24', name: 'Москитка французская скоба',    value: 2840, unit: 'м2', category: 'retail_products' },
];