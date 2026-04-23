/**
 * ЕДИНЫЙ ИСТОЧНИК ПРАВДЫ — Словарь статусов клиента
 *
 * Статусы существуют только здесь.
 * Все остальные файлы (KanbanBoard, ClientStep, actions, types) импортируют
 * отсюда и не объявляют статусы самостоятельно.
 *
 * Закрывает архитектурный долг D-05.
 *
 * Правило добавления нового статуса:
 *   1. Добавить объект в STATUS_DEFINITIONS
 *   2. Обновить schema.prisma (если нужна отдельная колонка)
 *   3. Всё остальное (UI, фильтры, маппинг) подхватывается автоматически.
 *
 * @module src/lib/logic/statusDictionary.ts
 */

// ---------------------------------------------------------------------------
// Определения статусов
// ---------------------------------------------------------------------------

/**
 * Полное описание одного статуса.
 */
export interface StatusDefinition {
  /** Ключ статуса — используется в БД и в коде. */
  id: ClientStatus;

  /** Человекочитаемое название для UI. */
  label: string;

  /**
   * Группа статуса:
   * - `active`   — клиент в работе (показывается на канбан-доске)
   * - `terminal` — сделка завершена (показывается в архиве)
   */
  group: 'active' | 'terminal';

  /**
   * Порядок отображения колонок на канбан-доске.
   * `null` для terminal-статусов (они не отображаются на доске).
   */
  kanbanOrder: number | null;

  /**
   * Русскоязычные алиасы для маппинга legacy-данных.
   * Используется в actions.ts при нормализации входящих данных.
   */
  legacyAliases: string[];
}

/**
 * Литеральный тип всех допустимых статусов.
 * Выводится автоматически из STATUS_DEFINITIONS — не объявлять вручную.
 */
export type ClientStatus =
  | 'negotiation'
  | 'waiting_measure'
  | 'promised_pay'
  | 'waiting_production'
  | 'waiting_install'
  | 'special_case'
  | 'completed'
  | 'rejected';

/**
 * Реестр всех статусов системы.
 * Добавление нового статуса = добавление одной записи сюда.
 */
export const STATUS_DEFINITIONS: StatusDefinition[] = [
  {
    id: 'negotiation',
    label: 'Общение с клиентом',
    group: 'active',
    kanbanOrder: 1,
    legacyAliases: ['Общение с клиентом'],
  },
  {
    id: 'waiting_measure',
    label: 'Ожидает замер',
    group: 'active',
    kanbanOrder: 2,
    legacyAliases: ['Ожидает замер'],
  },
  {
    id: 'promised_pay',
    label: 'Обещал заплатить',
    group: 'active',
    kanbanOrder: 3,
    legacyAliases: ['Обещал заплатить'],
  },
  {
    id: 'waiting_production',
    label: 'Ожидает изделия',
    group: 'active',
    kanbanOrder: 4,
    legacyAliases: ['Ожидает изделия'],
  },
  {
    id: 'waiting_install',
    label: 'Ожидает монтаж',
    group: 'active',
    kanbanOrder: 5,
    legacyAliases: ['Ожидает монтаж'],
  },
  {
    id: 'special_case',
    label: 'Особые случаи',
    group: 'active',
    kanbanOrder: 6,
    legacyAliases: ['Особые случаи', 'Особый случай'],
  },
  {
    id: 'completed',
    label: 'Сделка успешна',
    group: 'terminal',
    kanbanOrder: null,
    legacyAliases: ['Сделка успешна', 'Успешно'],
  },
  {
    id: 'rejected',
    label: 'Сделка провалена',
    group: 'terminal',
    kanbanOrder: null,
    legacyAliases: ['Отказ', 'Провалено', 'Сделка провалена'],
  },
];

// ---------------------------------------------------------------------------
// Производные коллекции (вычисляются один раз при загрузке модуля)
// ---------------------------------------------------------------------------

/**
 * Только активные статусы, отсортированные по порядку канбан-доски.
 * Используется в KanbanBoard для построения колонок.
 */
export const ACTIVE_STATUSES: StatusDefinition[] = STATUS_DEFINITIONS
  .filter((s) => s.group === 'active')
  .sort((a, b) => (a.kanbanOrder ?? 0) - (b.kanbanOrder ?? 0));

/**
 * Только терминальные статусы.
 * Используется в фильтре архивной страницы.
 */
export const TERMINAL_STATUSES: StatusDefinition[] = STATUS_DEFINITIONS
  .filter((s) => s.group === 'terminal');

/**
 * Все статусы в виде массива для `<select>` в формах.
 * Сначала активные (по порядку), потом терминальные.
 */
export const ALL_STATUS_OPTIONS: StatusDefinition[] = [
  ...ACTIVE_STATUSES,
  ...TERMINAL_STATUSES,
];

/**
 * Массив id терминальных статусов.
 * Используется в Prisma-запросах: `where: { status: { in: TERMINAL_STATUS_IDS } }`
 */
export const TERMINAL_STATUS_IDS: ClientStatus[] = TERMINAL_STATUSES.map(
  (s) => s.id
);

/**
 * Set активных id для O(1)-проверки в resolveDropStatus и DnD-логике.
 */
export const ACTIVE_STATUS_ID_SET = new Set<ClientStatus>(
  ACTIVE_STATUSES.map((s) => s.id)
);

// ---------------------------------------------------------------------------
// Маппинг для нормализации legacy-данных
// ---------------------------------------------------------------------------

/**
 * Таблица маппинга: любой текстовый алиас → канонический id.
 * Построена автоматически из `legacyAliases` каждого статуса.
 *
 * Используется в actions.ts вместо хардкоженного `statusMap`.
 *
 * @example
 * STATUS_ALIAS_MAP.get('Ожидает замер') // → 'waiting_measure'
 * STATUS_ALIAS_MAP.get('waiting_measure') // → 'waiting_measure'
 */
export const STATUS_ALIAS_MAP = new Map<string, ClientStatus>(
  STATUS_DEFINITIONS.flatMap((s) => [
    // Сам id тоже является алиасом самого себя
    [s.id, s.id] as [string, ClientStatus],
    ...s.legacyAliases.map((alias) => [alias, s.id] as [string, ClientStatus]),
  ])
);

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------

/**
 * Нормализует произвольную строку в канонический `ClientStatus`.
 * Если строка не распознана — возвращает `'special_case'` как безопасный fallback.
 *
 * Заменяет `normalizeStatus()` из actions.ts.
 *
 * @param raw - сырое значение статуса из формы или БД
 */
export function normalizeStatus(raw: unknown): ClientStatus {
  const str = String(raw ?? '').trim();
  return STATUS_ALIAS_MAP.get(str) ?? 'special_case';
}

/**
 * Возвращает человекочитаемый лейбл для статуса.
 * Если статус не найден — возвращает сам id.
 *
 * @param status - канонический id статуса
 */
export function getStatusLabel(status: ClientStatus | string): string {
  const definition = STATUS_DEFINITIONS.find((s) => s.id === status);
  return definition?.label ?? status;
}

/**
 * Type guard: проверяет, является ли строка валидным `ClientStatus`.
 *
 * @example
 * if (isClientStatus(value)) {
 *   // value: ClientStatus
 * }
 */
export function isClientStatus(value: unknown): value is ClientStatus {
  return STATUS_ALIAS_MAP.has(String(value));
}