/**
 * ЕДИНЫЙ РЕЕСТР ТИПОВ ПРОЕКТА
 *
 * Содержит:
 *   - WindowItem и вспомогательные типы (бывший window.ts)
 *   - Client, Stage для UI-слоя
 *
 * Все импорты в проекте используют '@/types'
 *
 * @module src/types/index.ts
 */

import { type ClientStatus } from '@/lib/logic/statusDictionary';

// ─────────────────────────────────────────────────────────────────────────────
// WindowItem — типы изделий
// ─────────────────────────────────────────────────────────────────────────────

/** Допустимые материалы полотна. Расширять только здесь. */
export type WindowMaterial =
  | 'ПВХ 700 мкм (Прозрачная)'
  | 'ПВХ 700 мкм (Тонированная)'
  | 'ТПУ Полиуретан'
  | 'Москитная сетка';

/** Допустимые цвета канта. Расширять только здесь. */
export type KantColor =
  | 'Белый'
  | 'Светло-серый'
  | 'Серый'
  | 'Графит'
  | 'Черный'
  | 'Коричневый'
  | 'Бежевый'
  | 'Синий';

/** Числовые геометрические поля изделия. */
export type WindowNumericField =
  | 'widthTop'
  | 'heightRight'
  | 'widthBottom'
  | 'heightLeft'
  | 'kantTop'
  | 'kantRight'
  | 'kantBottom'
  | 'kantLeft'
  | 'diagonalLeft'
  | 'diagonalRight'
  | 'crossbar';

/** Строковые редактируемые поля изделия. */
export type WindowTextField = 'name' | 'kantColor' | 'material';

/** Булевые редактируемые поля изделия. */
export type WindowBooleanField = 'isTrapezoid';

/** Объединение всех редактируемых полей. */
export type WindowEditableField =
  | WindowNumericField
  | WindowTextField
  | WindowBooleanField;

/**
 * Полное описание одного изделия (окна/полотна).
 * Все числовые поля — строго number.
 */
export interface WindowItem {
  id: number;
  name: string;
  widthTop: number;
  heightRight: number;
  widthBottom: number;
  heightLeft: number;
  kantTop: number;
  kantRight: number;
  kantBottom: number;
  kantLeft: number;
  kantColor: KantColor;
  material: WindowMaterial;
  isTrapezoid: boolean;
  diagonalLeft: number;
  diagonalRight: number;
  crossbar: number;
}

/**
 * Возвращает новый WindowItem с безопасными дефолтами.
 */
export function createDefaultWindowItem(id: number, index: number): WindowItem {
  return {
    id,
    name: `Окно ${index}`,
    widthTop: 200,
    heightRight: 200,
    widthBottom: 200,
    heightLeft: 200,
    kantTop: 5,
    kantRight: 5,
    kantBottom: 5,
    kantLeft: 5,
    kantColor: 'Коричневый',
    material: 'ПВХ 700 мкм (Прозрачная)',
    isTrapezoid: false,
    diagonalLeft: 0,
    diagonalRight: 0,
    crossbar: 0,
  };
}

/**
 * Type guard: проверяет, является ли объект валидным WindowItem.
 */
export function isWindowItem(value: unknown): value is WindowItem {
  if (typeof value !== 'object' || value === null) return false;

  const obj = value as Record<string, unknown>;

  const numericFields: WindowNumericField[] = [
    'widthTop', 'heightRight', 'widthBottom', 'heightLeft',
    'kantTop', 'kantRight', 'kantBottom', 'kantLeft',
    'diagonalLeft', 'diagonalRight', 'crossbar',
  ];

  const allNumericValid = numericFields.every(
    (field) => typeof obj[field] === 'number' && Number.isFinite(obj[field] as number)
  );

  return (
    typeof obj['id'] === 'number' &&
    typeof obj['name'] === 'string' &&
    typeof obj['isTrapezoid'] === 'boolean' &&
    typeof obj['kantColor'] === 'string' &&
    typeof obj['material'] === 'string' &&
    allNumericValid
  );
}

/**
 * Парсит массив из JSON-поля БД в WindowItem[].
 * Невалидные записи отфильтровываются.
 */
export function parseWindowItems(raw: unknown): WindowItem[] {
  if (!Array.isArray(raw)) return [];

  return raw.filter((item): item is WindowItem => {
    const valid = isWindowItem(item);
    if (!valid) {
      console.warn('[parseWindowItems] Пропущена невалидная запись:', item);
    }
    return valid;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Client, Stage — типы UI-слоя
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Используйте WindowItem */
export interface Product {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Client {
  id: string;
  fio: string;
  phone: string;
  address: string | null;
  source?: string | null;
  totalPrice: number;
  advance?: number;
  balance?: number;
  paymentType?: string | null;
  status: ClientStatus;
  createdAt: string | Date;
  measurementDate?: string | Date | null;
  installDate?: string | Date | null;
  items?: WindowItem[] | null;
  managerComment?: string | null;
  engineerComment?: string | null;
}

export interface Stage {
  id: ClientStatus;
  title: string;
}