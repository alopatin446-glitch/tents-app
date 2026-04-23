/**
 * Центральный логгер (D-10).
 *
 * Принцип «Тихого города» (Протокол БАЛАНС):
 *   - Dev-режим: логируется всё (info, warn, error).
 *   - Prod-режим: только критические ошибки (error).
 *     Система летает, но «чёрный ящик» всегда пишет при аварии.
 *
 * Правила использования в проекте:
 *   - Запрещено: `console.error(...)` или `console.log(...)` напрямую.
 *   - Обязательно: `logger.error(...)` / `logger.info(...)` / `logger.warn(...)`.
 *   - В catch-блоках: всегда `logger.error`, никогда тихое гашение ошибок.
 *
 * @example
 * import { logger } from '@/lib/logger';
 *
 * // Информационное событие
 * logger.info('[ClientStep] Данные сохранены', { clientId, totalPrice });
 *
 * // Предупреждение
 * logger.warn('[parseWindowItems] Пропущена невалидная запись', item);
 *
 * // Ошибка (пишется всегда, даже в prod)
 * logger.error('[updateClientAction] Ошибка БД', error);
 *
 * @module src/lib/logger.ts
 */

// ---------------------------------------------------------------------------
// Определение режима
// ---------------------------------------------------------------------------

/**
 * true = разработка (NODE_ENV !== 'production').
 * Используется только для переключения уровней логирования.
 */
const IS_DEV = process.env.NODE_ENV !== 'production';

// ---------------------------------------------------------------------------
// Форматирование
// ---------------------------------------------------------------------------

/**
 * Формирует префикс временной метки для лога.
 * В dev — с временем до миллисекунд для отладки.
 * В prod — ISO-строка для совместимости с системами сбора логов.
 */
function buildTimestamp(): string {
  const now = new Date();
  if (IS_DEV) {
    return `${now.toTimeString().split(' ')[0]}.${String(now.getMilliseconds()).padStart(3, '0')}`;
  }
  return now.toISOString();
}

/**
 * Сериализует дополнительный контекст для вывода.
 * Объекты раскрываются через JSON, примитивы — как есть.
 */
function serializeContext(context: unknown): string {
  if (context === undefined) return '';
  try {
    return ' | ' + JSON.stringify(context, null, IS_DEV ? 2 : 0);
  } catch {
    return ' | [non-serializable]';
  }
}

// ---------------------------------------------------------------------------
// Типы уровней логирования
// ---------------------------------------------------------------------------

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

// ---------------------------------------------------------------------------
// Ядро логгера
// ---------------------------------------------------------------------------

function log(level: LogLevel, message: string, context?: unknown): void {
  const timestamp = buildTimestamp();
  const ctx = serializeContext(context);
  const formatted = `[${timestamp}] [${level}] ${message}${ctx}`;

  switch (level) {
    case 'INFO':
      // INFO: только в dev
      if (IS_DEV) {
        console.log(formatted);
      }
      break;

    case 'WARN':
      // WARN: только в dev
      if (IS_DEV) {
        console.warn(formatted);
      }
      break;

    case 'ERROR':
      // ERROR: всегда — это «чёрный ящик» для аварий в prod
      console.error(formatted);

      // Расширение: здесь можно подключить внешний сервис сбора ошибок.
      // Например: Sentry.captureException(context) или fetch('/api/log', ...)
      // В текущей версии — только console.error (достаточно для MVP).
      break;
  }
}

// ---------------------------------------------------------------------------
// Публичный API
// ---------------------------------------------------------------------------

export const logger = {
  /**
   * Информационное событие.
   * Выводится только в dev-режиме.
   *
   * Используй для: успешного сохранения, смены шага, навигации.
   *
   * @param message - краткое описание события
   * @param context - любые дополнительные данные (объект, число, строка)
   */
  info(message: string, context?: unknown): void {
    log('INFO', message, context);
  },

  /**
   * Предупреждение — что-то неожиданное, но не критическое.
   * Выводится только в dev-режиме.
   *
   * Используй для: невалидных данных из БД, fallback-расчётов,
   * пропущенных необязательных полей.
   *
   * @param message - краткое описание проблемы
   * @param context - контекст (что именно было получено)
   */
  warn(message: string, context?: unknown): void {
    log('WARN', message, context);
  },

  /**
   * Критическая ошибка — пишется ВСЕГДА (включая prod).
   * Это «чёрный ящик» системы.
   *
   * Используй для: catch-блоков, ошибок БД, ошибок сети,
   * невозможных состояний (invariant violations).
   *
   * @param message - краткое описание ошибки
   * @param context - объект ошибки или любой контекст
   */
  error(message: string, context?: unknown): void {
    log('ERROR', message, context);
  },
} as const;

// ---------------------------------------------------------------------------
// Типовые сообщения (опциональный каталог)
//
// Позволяет стандартизировать тексты сообщений по всему проекту.
// Использование: logger.error(LOG_MESSAGES.DB_UPDATE_FAILED, { clientId })
// ---------------------------------------------------------------------------

export const LOG_MESSAGES = {
  // БД
  DB_UPDATE_FAILED: '[DB] Ошибка обновления клиента',
  DB_DELETE_FAILED: '[DB] Ошибка удаления клиента',
  DB_CREATE_FAILED: '[DB] Ошибка создания клиента',

  // Парсинг данных
  WINDOW_ITEM_INVALID: '[parseWindowItems] Невалидная запись изделия',
  JSON_ITEMS_EMPTY: '[toJsonItems] Массив изделий пустой после валидации',

  // Геометрия
  TRAPEZOID_IMPOSSIBLE:
    '[windowCalculations] Геометрия трапеции невозможна, используется fallback',

  // Сохранение
  SAVE_SUCCESS: '[CalculationClient] Данные сохранены',
  SAVE_FAILED: '[CalculationClient] Ошибка сохранения',
  WINDOWS_SAVED: '[CalculationClient] Изделия сохранены',
} as const;