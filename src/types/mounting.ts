/**
 * Типы данных для модуля «Монтаж, Логистика и Глобальный Календарь»
 * @module src/types/mounting.ts
 *
 * Правило SSOT: все интерфейсы монтажа определены здесь и только здесь.
 * Компоненты и сервисы импортируют типы отсюда.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Примитивы / Перечисления
// ─────────────────────────────────────────────────────────────────────────────

/** Категория бригады: про / стандарт / эконом */
export type TeamCategory = 'pro' | 'mid' | 'junior';

/** Тип высотных работ */
export type HeightWorkType = 'stairs' | 'scaffold' | 'both';

/** Статус монтажа в заказе */
export type MountingStatus = 'pending' | 'confirmed' | 'completed';

/** Тип основания для базового и дополнительного монтажа */
export type FoundationType =
  | 'wood'
  | 'concrete'
  | 'brick'
  | 'metal'
  | 'round_wood'
  | 'siding';

/** Тип дополнительного основания */
export type ExtraFoundationType = FoundationType;

/** Тип монтажной балки */
export type BeamType =
  | 'custom_wood'
  | 'wood_50x50'
  | 'planed_wood_50x50'
  | 'timber_100x100'
  | 'timber_150x150'
  | 'custom_metal';

// ─────────────────────────────────────────────────────────────────────────────
// Составные объекты
// ─────────────────────────────────────────────────────────────────────────────

/** Дополнительное основание с длиной */
export interface ExtraFoundation {
  /** Тип доп. основания */
  type: ExtraFoundationType;

  /** Длина в м.п. */
  length: number;

  /**
   * Ручная цена за м.п. (₽).
   * Используется для сайдинга.
   */
  customPrice?: number;
}

/** Монтажная балка */
export interface MountingBeam {
  /** Тип балки */
  type: BeamType;

  /**
   * Габариты для нестандартного бруска (мм).
   * Используются при type === 'custom_wood'.
   */
  dimensions?: { width: number; height: number };

  /** Длина в м.п. */
  length: number;

  /** Признак покраски балки */
  isPainted: boolean;

  /**
   * Ручная цена за м.п. (₽).
   * Используется при type === 'custom_wood' или type === 'custom_metal'.
   */
  customPrice?: number;
}

/** Высотные работы */
export interface HeightWork {
  /** Тип высотных работ */
  type: HeightWorkType;
  /** Активны ли высотные работы на данном объекте */
  active: boolean;
}

/** Назначение бригады на заказ */
export interface TeamAssignment {
  /** Категория бригады */
  category: TeamCategory;
  /** ID члена бригады из TEAM_MEMBERS */
  memberId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Аудит и снимок прайса
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Запись аудита ценового изменения.
 * Добавляется в priceAuditLog при каждом ручном изменении или обновлении цен.
 */
export interface MountingPriceAuditEntry {
  /** ID пользователя (менеджера), внёсшего изменение */
  userId: string;
  /** Цена до изменения (₽) */
  oldPrice: number;
  /** Цена после изменения (₽) */
  newPrice: number;
  /**
   * Причина изменения.
   * Обязательна при убыточном заказе (retail < cost).
   */
  reason?: string;
  /** Временна́я метка в формате ISO 8601 */
  timestamp: string;
}

/**
 * Снимок прайса на момент бронирования даты.
 * Фиксируется из pricing.ts при первом назначении mountingDate.
 * Защищает заказ от изменений прайса после бронирования.
 */
export interface MountingPriceSnapshot {
  /** Время фиксации снимка */
  capturedAt: string;
  /** Розничная ставка бригады на момент бронирования (₽/м²) */
  teamRetailRate: number;
  /** Себестоимостная ставка бригады (₽/м²) */
  teamCostRate: number;
  /** ГСМ себестоимость (₽/км) */
  fuelCostPerKm: number;
  /** ГСМ розница (₽/км) */
  kmTariffRetail: number;
  /** Прайс доп. оснований (тип → ₽/м.п.) */
  extraFoundationPrices: Record<string, number>;
  /** Прайс балок (тип → ₽/м.п.) */
  beamPrices: Record<string, number>;
  /** Прайс высотных работ (тип → ₽/день) */
  heightWorkPrices: Record<string, number>;
  /** Минимальная стоимость монтажа (₽) */
  minRetailPrice: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Главный конфиг монтажа
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Конфигурация монтажа заказа.
 * Хранится в поле Client.mountingConfig (JSON) в БД.
 *
 * Инвариант: если enabled === false, все остальные поля игнорируются
 * при расчёте итогов заказа.
 */
export interface MountingConfig {
  /** Флаг: подключён ли монтаж к заказу */
  enabled: boolean;

  /** Тип базового основания */
  baseFoundation: FoundationType;
  /**
 * Ручная цена базового основания за м² (₽).
 * Используется при baseFoundation === 'siding'.
 */
  baseFoundationCustomPrice?: number;

  /** Список дополнительных оснований (может быть пустым) */
  extraFoundations: ExtraFoundation[];

  /** Список монтажных балок (может быть пустым) */
  mountingBeams: MountingBeam[];

  /** Высотные работы */
  heightWork: HeightWork;

  /** Расстояние до объекта в одну сторону (км) */
  distance: number;

  /** Назначенная бригада */
  team: TeamAssignment;

  /** Статус монтажа */
  status: MountingStatus;

  /** Дата монтажа в формате YYYY-MM-DD или null */
  mountingDate: string | null;

  /** Время начала работы (HH:mm, по умолчанию "09:00") */
  startTime: string;

  /** Время окончания работы (HH:mm, по умолчанию "18:00") */
  endTime: string;

  /** Количество дней монтажа (по умолчанию 1) */
  durationDays: number;

  /**
   * Ручная цена монтажа (₽).
   * null = не задана, используется системная.
   * Если задана и отличается от системной → подсветка оранжевым.
   */
  manualPrice: number | null;

  /**
   * Причина убыточности.
   * Обязательна при сохранении если retail < cost.
   */
  lossReason?: string;

  /**
   * Снимок прайса на момент бронирования.
   * null = дата ещё не назначена.
   */
  mountingSnapshot: MountingPriceSnapshot | null;

  /** Журнал аудита всех ценовых изменений */
  priceAuditLog: MountingPriceAuditEntry[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Результат расчёта монтажа
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Детализированный результат расчёта монтажного блока.
 * Возвращается из calculateMounting() и используется в UI для отображения.
 */
export interface MountingCalculationResult {
  // ── Розница: детализация ────────────────────────────────────────────────
  /** Площадь × тариф бригады (₽) */
  retailWindowsBase: number;
  /** Сумма всех доп. оснований (₽) */
  retailFoundations: number;
  /** Сумма всех балок (₽) */
  retailBeams: number;
  /** ГСМ розница (₽) */
  retailDistance: number;
  /** Надбавка за высотные работы (₽) */
  retailHeightWork: number;
  /** Подытог до минималки (₽) */
  retailSubtotal: number;
  /** После применения минималки (₽) */
  retailAfterMinimum: number;
  /** Итоговая розница монтажа (₽) */
  retailFinal: number;

  // ── Себестоимость: детализация ──────────────────────────────────────────
  /** База себестоимости: площадь × тариф (₽) */
  costBase: number;
  /** Себестоимость доп. работ (оснований + балок) (₽) */
  costExtra: number;
  /** ГСМ себестоимость: км × 2 × 8 ₽ */
  costDistance: number;
  /** Итоговая себестоимость (₽) */
  costTotal: number;

  // ── Итоги ───────────────────────────────────────────────────────────────
  /** Прибыль = effectiveRetail - costTotal (₽) */
  profit: number;
  /** Процент прибыли. null если розница = 0 */
  profitPercent: number | null;

  // ── Флаги ───────────────────────────────────────────────────────────────
  /** true = применена минимальная стоимость монтажа */
  isMinimumApplied: boolean;
  /** true = активна ручная цена (manualPrice !== null) */
  isManualOverride: boolean;
  /** true = заказ убыточный (profit < 0) */
  isLoss: boolean;
  /**
   * true = в задействованных полях есть значение 9999.
   * При hasPriceError === true кнопки «Сохранить» и «Создать договор» заблокированы.
   */
  hasPriceError: boolean;
  /** Список полей с ошибкой прайса (для Toast-уведомления) */
  priceErrorFields: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Событие в глобальном календаре
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Событие монтажа для отображения в глобальном календаре.
 * Создаётся на сервере из данных Client + MountingConfig.
 */
export interface CalendarEvent {
  /** ID клиента в БД */
  clientId: string;
  /** ФИО клиента */
  clientName: string;
  /** Адрес объекта */
  address: string;
  /** Дата начала монтажа (YYYY-MM-DD) */
  mountingDate: string;
  /** Количество дней (событие занимает несколько ячеек) */
  durationDays: number;
  /** Время начала (HH:mm) */
  startTime: string;
  /** Время окончания (HH:mm) */
  endTime: string;
  /** ID назначенного монтажника */
  memberId: string;
  /** Имя монтажника */
  memberName: string;
  /** Цвет карточки (из TEAM_MEMBERS[].color) */
  memberColor: string;
  /** Статус монтажа */
  status: MountingStatus;
  /** Итоговая розница монтажа (₽) */
  retailFinal: number;
  /** true = конфликт по расписанию у данного монтажника */
  isConflict: boolean;
}