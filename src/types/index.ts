/**
 * ЕДИНЫЙ РЕЕСТР ТИПОВ ПРОЕКТА
 *
 * Содержит:
 * - Типы крепежа: FastenerType, FastenerFinish, FastenerConfig
 * - WindowItem с полем fasteners
 * - Client, Stage для UI-слоя
 *
 * @module src/types/index.ts
 */

import { type ClientStatus } from '@/lib/logic/statusDictionary';

// ─────────────────────────────────────────────────────────────────────────────
// Типы крепежа
// ─────────────────────────────────────────────────────────────────────────────

export type FastenerType =
  | 'eyelet_10'
  | 'strap'
  | 'staple_pa'
  | 'staple_metal'
  | 'french_lock'
  | 'none';

export type FastenerFinish = 'zinc' | 'black' | 'color' | null;

export type FastenerSideState = 'default' | boolean;

export interface FastenerSides {
  top: FastenerSideState;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

export interface FastenerConfig {
  type: FastenerType;
  sides: FastenerSides;
  finish: FastenerFinish;
}

/**
 * Инициализация конфига крепежа по умолчанию.
 * Название изменено на getInitialFastener для сброса кеша Turbopack.
 */
export function getInitialFastener(): FastenerConfig {
  return {
    type: 'none',
    sides: { top: false, right: false, bottom: false, left: false },
    finish: null,
  };
}

// Алиас для совместимости, если где-то остался старый импорт
export const getDefaultFastenerConfig = getInitialFastener;

// ─────────────────────────────────────────────────────────────────────────────
// WindowItem
// ─────────────────────────────────────────────────────────────────────────────

export type WindowMaterial =
  | 'ПВХ 700 мкм (Прозрачная)'
  | 'ПВХ 700 мкм (Тонированная)'
  | 'ТПУ Полиуретан'
  | 'Москитная сетка';

export type KantColor =
  | 'Белый'
  | 'Светло-серый'
  | 'Серый'
  | 'Графит'
  | 'Черный'
  | 'Коричневый'
  | 'Бежевый'
  | 'Синий';

export type WindowNumericField =
  | 'widthTop' | 'heightRight' | 'widthBottom' | 'heightLeft'
  | 'kantTop' | 'kantRight' | 'kantBottom' | 'kantLeft'
  | 'diagonalLeft' | 'diagonalRight' | 'crossbar';

export type WindowTextField = 'name' | 'kantColor' | 'material';
export type WindowBooleanField = 'isTrapezoid';
export type WindowEditableField = WindowNumericField | WindowTextField | WindowBooleanField;

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
  fasteners?: FastenerConfig;
}

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
    fasteners: getInitialFastener(),
  };
}

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

export function parseWindowItems(raw: unknown): WindowItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.reduce<WindowItem[]>((acc, item) => {
    if (!isWindowItem(item)) {
      console.warn('[parseWindowItems] Пропущена невалидная запись:', item);
      return acc;
    }
    acc.push({ 
      ...item, 
      fasteners: item.fasteners ?? getInitialFastener() 
    });
    return acc;
  }, []);
}

// ─────────────────────────────────────────────────────────────────────────────
// Client, Stage
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Используйте WindowItem */
export interface Product { id: string; name: string; quantity: number; price: number; }

export interface Client {
  id: string; fio: string; phone: string; address: string | null;
  source?: string | null; totalPrice: number; advance?: number;
  balance?: number; paymentType?: string | null; status: ClientStatus;
  createdAt: string | Date; measurementDate?: string | Date | null;
  installDate?: string | Date | null; items?: WindowItem[] | null;
  managerComment?: string | null; engineerComment?: string | null;
}

export interface Stage { id: ClientStatus; title: string; }