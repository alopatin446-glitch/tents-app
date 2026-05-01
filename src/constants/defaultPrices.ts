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

    // ── Системные строки для алгоритма себестоимости монтажа ──
    { slug: 'team_cost_pro', name: 'Себес: бригада Про', value: 350, unit: 'м2', category: 'cost_install' },
    { slug: 'team_cost_mid', name: 'Себес: бригада Стандарт', value: 280, unit: 'м2', category: 'cost_install' },
    { slug: 'team_cost_junior', name: 'Себес: бригада Эконом', value: 200, unit: 'м2', category: 'cost_install' },
    { slug: 'fuel_cost_per_km', name: 'Себес: ГСМ за км', value: 8, unit: 'км', category: 'cost_install' },
    { slug: 'extra_works_cost_factor', name: 'Коэффициент себеса доп. работ', value: 0.6, unit: 'коэф.', category: 'cost_install' },

    { slug: 'c_in_1', name: 'ГСМ монтажника', value: 16, unit: 'Км.', category: 'cost_install' },
    { slug: 'c_in_2', name: 'Минимальная стоимость монтажа', value: 5000, unit: 'Шт.', category: 'cost_install' },
    { slug: 'c_in_3', name: 'Монтаж по бетону', value: 500, unit: 'м2', category: 'cost_install' },
    { slug: 'c_in_4', name: 'Монтаж по дереву', value: 350, unit: 'м2', category: 'cost_install' },
    { slug: 'c_in_5', name: 'Монтаж по кирпичу', value: 600, unit: 'м2', category: 'cost_install' },
    { slug: 'c_in_6', name: 'Монтаж по круглому брусу', value: 600, unit: 'м2', category: 'cost_install' },
    { slug: 'c_in_7', name: 'Монтаж по металлу', value: 600, unit: 'м2', category: 'cost_install' },
    { slug: 'c_in_8', name: 'Строительные леса', value: 15000, unit: 'День', category: 'cost_install' },
    { slug: 'c_in_9', name: 'Установка базы из бруса', value: 200, unit: 'Пог.м.', category: 'cost_install' },

    { slug: 'c_produc_1', name: 'Пайка канта к плёнке', value: 220, unit: 'м2.', category: 'cost_production' },
    { slug: 'c_produc_10', name: 'Припой разделительной полосы', value: 100, unit: 'М.', category: 'cost_production' },
    { slug: 'c_produc_11', name: 'Покраска бруса', value: 200, unit: 'М.', category: 'cost_production' },
    { slug: 'c_produc_12', name: 'Проверка и Упаковка для клиента и на монтаж', value: 500, unit: 'За заказ', category: 'cost_production' },
    { slug: 'c_produc_2', name: 'Пробивка и завальцоовка люверса', value: 80, unit: 'Шт.', category: 'cost_production' },
    { slug: 'c_produc_3', name: 'Прошивка и припой молнии', value: 220, unit: 'М.', category: 'cost_production' },
    { slug: 'c_produc_4', name: 'Изготовление ремешка фиксации', value: 15, unit: 'Шт.', category: 'cost_production' },
    { slug: 'c_produc_5', name: 'Вырез малый', value: 200, unit: 'Шт.', category: 'cost_production' },
    { slug: 'c_produc_6', name: 'Вырез большой', value: 400, unit: 'Шт.', category: 'cost_production' },
    { slug: 'c_produc_7', name: 'Техническая пайка', value: 200, unit: 'М.', category: 'cost_production' },
    { slug: 'c_produc_8', name: 'Изготовление и установка утяжелителя', value: 50, unit: 'М.', category: 'cost_production' },
    { slug: 'c_produc_9', name: 'Припой Юбки к изделию', value: 100, unit: 'М.', category: 'cost_production' },

    { slug: 'c_pr_1', name: 'Пвх 700 мкр. Crystal Window» прозрачный ', value: 350, unit: 'м2', category: 'cost_products' },
    { slug: 'c_pr_2', name: 'Тонировка ПВХ', value: 400, unit: 'м2', category: 'cost_products' },
    { slug: 'c_pr_3', name: 'Пленка ТПУ 700 мкр. Crystal Window LX TPU', value: 750, unit: 'м2', category: 'cost_products' },
    { slug: 'c_pr_4', name: 'Кант 650гр м2 «sealtex»', value: 300, unit: 'м2', category: 'cost_products' },

    { slug: 'addo_1', name: 'Молния витая Waterproof, влагостойка, с двух сторонним бегунком', value: 1600, unit: 'Пог.м.', category: 'retail_addons' },
    { slug: 'addo_10', name: 'Ремешок фиксации в скрученном положении на фастексе', value: 350, unit: 'Шт', category: 'retail_addons' },
    { slug: 'addo_2', name: 'Утяжелитель', value: 900, unit: 'Пог.м.', category: 'retail_addons' },
    { slug: 'addo_3', name: 'Разделитель', value: 1000, unit: 'Пог.м.', category: 'retail_addons' },
    { slug: 'addo_4', name: 'Техническая пайка', value: 500, unit: 'Пог.м.', category: 'retail_addons' },
    { slug: 'addo_5', name: 'Вырез малый', value: 500, unit: 'Шт', category: 'retail_addons' },
    { slug: 'addo_6', name: 'Вырез большой', value: 1000, unit: 'Шт', category: 'retail_addons' },
    { slug: 'addo_7', name: 'Заплатка', value: 500, unit: 'Шт', category: 'retail_addons' },
    { slug: 'addo_8', name: 'Юбка', value: 650, unit: 'Пог.м.', category: 'retail_addons' },
    { slug: 'addo_9', name: 'Ремешок фиксации в скрученном положении на люверсе', value: 250, unit: 'Шт', category: 'retail_addons' },

    { slug: 'fast_1', name: 'Люверс 10мм + шайба (цинк)', value: 4.8, unit: 'Шт', category: 'retail_fasteners' },
    { slug: 'fast_10', name: 'Люверс 18 + французская скоба (цветной)', value: 380, unit: 'Шт', category: 'retail_fasteners' },
    { slug: 'fast_2', name: 'Люверс 27+ скоба + ремень (цинк)', value: 105, unit: 'Шт', category: 'retail_fasteners' },
    { slug: 'fast_3', name: 'Люверс 37 + полиамидная скоба (цинк)', value: 120, unit: 'Шт', category: 'retail_fasteners' },
    { slug: 'fast_4', name: 'Люверс 37 + металл скоба (цинк)', value: 150, unit: 'Шт', category: 'retail_fasteners' },
    { slug: 'fast_5', name: 'Люверс 18 + французская скоба (цинк)', value: 190, unit: 'Шт', category: 'retail_fasteners' },
    { slug: 'fast_6', name: 'Люверс 10мм + шайба (черный)', value: 10, unit: 'Шт', category: 'retail_fasteners' },
    { slug: 'fast_7', name: 'Люверс 27+ скоба + ремень (цветной)', value: 210, unit: 'Шт', category: 'retail_fasteners' },
    { slug: 'fast_8', name: 'Люверс 37 + полиамидная скоба (цветной)', value: 240, unit: 'Шт', category: 'retail_fasteners' },
    { slug: 'fast_9', name: 'Люверс 37 + металл скоба (цветной)', value: 300, unit: 'Шт', category: 'retail_fasteners' },

    // ── Системные строки для алгоритма розничного монтажа ──
    { slug: 'team_retail_pro', name: 'Бригада Про', value: 850, unit: 'м2', category: 'retail_install' },
    { slug: 'team_retail_mid', name: 'Бригада Стандарт', value: 720, unit: 'м2', category: 'retail_install' },
    { slug: 'team_retail_junior', name: 'Бригада Эконом', value: 600, unit: 'м2', category: 'retail_install' },

    { slug: 'base_foundation_wood', name: 'Базовое основание: брус', value: 0, unit: 'м2', category: 'retail_install' },
    { slug: 'base_foundation_concrete', name: 'Базовое основание: бетон', value: 0, unit: 'м2', category: 'retail_install' },
    { slug: 'base_foundation_brick', name: 'Базовое основание: кирпич', value: 0, unit: 'м2', category: 'retail_install' },
    { slug: 'base_foundation_metal', name: 'Базовое основание: металл', value: 0, unit: 'м2', category: 'retail_install' },
    { slug: 'base_foundation_round_wood', name: 'Базовое основание: круглый брус', value: 0, unit: 'м2', category: 'retail_install' },

    { slug: 'extra_foundation_wood', name: 'Доп. основание: брус', value: 0, unit: 'м.п.', category: 'retail_install' },
    { slug: 'extra_foundation_concrete', name: 'Доп. основание: бетон', value: 0, unit: 'м.п.', category: 'retail_install' },
    { slug: 'extra_foundation_brick', name: 'Доп. основание: кирпич', value: 0, unit: 'м.п.', category: 'retail_install' },
    { slug: 'extra_foundation_metal', name: 'Доп. основание: металл', value: 0, unit: 'м.п.', category: 'retail_install' },
    { slug: 'extra_foundation_round_wood', name: 'Доп. основание: круглый брус', value: 0, unit: 'м.п.', category: 'retail_install' },

    { slug: 'beam_wood_50x50', name: 'Брусок обычный 50×50', value: 0, unit: 'м.п.', category: 'retail_install' },
    { slug: 'beam_planed_wood_50x50', name: 'Брусок строганный 50×50', value: 0, unit: 'м.п.', category: 'retail_install' },
    { slug: 'beam_timber_100x100', name: 'Брус обычный 10×10', value: 0, unit: 'м.п.', category: 'retail_install' },
    { slug: 'beam_timber_150x150', name: 'Брус обычный 15×15', value: 0, unit: 'м.п.', category: 'retail_install' },

    { slug: 'height_stairs', name: 'Высотные работы: лестница', value: 0, unit: 'день', category: 'retail_install' },
    { slug: 'height_scaffold', name: 'Высотные работы: леса', value: 0, unit: 'день', category: 'retail_install' },
    { slug: 'height_both', name: 'Высотные работы: лестница + леса', value: 0, unit: 'день', category: 'retail_install' },

    { slug: 'km_retail', name: 'ГСМ розница', value: 16, unit: 'км', category: 'retail_install' },
    { slug: 'min_retail_mounting', name: 'Минимальная стоимость монтажа', value: 7500, unit: 'заказ', category: 'retail_install' },

    { slug: 'inst_1', name: 'Монтаж по дереву', value: 650, unit: 'м2', category: 'retail_install' },
    { slug: 'inst_2', name: 'Монтаж по кирпичу', value: 950, unit: 'м2', category: 'retail_install' },
    { slug: 'inst_3', name: 'Монтаж по бетону', value: 850, unit: 'м2', category: 'retail_install' },
    { slug: 'inst_4', name: 'Монтаж по металлу', value: 1200, unit: 'м2', category: 'retail_install' },
    { slug: 'inst_5', name: 'Монтаж по круглому брусу', value: 1000, unit: 'м2', category: 'retail_install' },
    { slug: 'inst_6', name: 'ГСМ монтажника', value: 25, unit: 'Км', category: 'retail_install' },
    { slug: 'inst_7', name: 'Минимальная стоимость монтажа', value: 7500, unit: 'Шт', category: 'retail_install' },
    { slug: 'inst_8', name: 'Строительные леса', value: 20000, unit: 'день', category: 'retail_install' },
    { slug: 'inst_9', name: 'Установка базы из бруса', value: 450, unit: 'Пог.м.', category: 'retail_install' },

    { slug: 'prod_1', name: 'Окно Глухое ПВХ', value: 1600, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_10', name: 'Окно на французской скобе ТПУ', value: 4000, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_2', name: 'Окно на ремешках ПВХ', value: 2000, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_3', name: 'Окно на полиамидной скобе ПВХ', value: 2400, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_4', name: 'Окно на металлической скоба ПВХ', value: 2800, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_5', name: 'Окно на французской скобе ПВХ', value: 3000, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_6', name: 'Окно Глухое ТПУ', value: 2500, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_7', name: 'Окно на ремешках ТПУ', value: 3000, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_8', name: 'Окно на полиамидной скобе ТПУ', value: 3400, unit: 'м2', category: 'retail_products' },
    { slug: 'prod_9', name: 'Окно на металлической скоба ТПУ', value: 3800, unit: 'м2', category: 'retail_products' },
];