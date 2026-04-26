/**
 * Группы разрешений — единый источник правды для UI отображения.
 * Используется как в клиентских компонентах, так и на сервере.
 * @module src/lib/permissionGroups.ts
 */

export interface PermissionDef {
  key: string;
  label: string;
}

export interface PermissionGroup {
  group: string;
  permissions: PermissionDef[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    group: 'Заказы',
    permissions: [
      { key: 'orders:read',  label: 'Просмотр заказов' },
      { key: 'orders:write', label: 'Управление заказами' },
    ],
  },
  {
    group: 'Клиенты',
    permissions: [
      { key: 'clients:read',  label: 'Просмотр клиентов' },
      { key: 'clients:write', label: 'Создание и редактирование клиентов' },
    ],
  },
  {
    group: 'Расчёты',
    permissions: [
      { key: 'calculations:read',  label: 'Просмотр расчётов' },
      { key: 'calculations:write', label: 'Создание и редактирование расчётов' },
    ],
  },
  {
    group: 'Монтаж',
    permissions: [
      { key: 'mounting:read',  label: 'Просмотр монтажа' },
      { key: 'mounting:write', label: 'Управление монтажом' },
    ],
  },
  {
    group: 'Календарь',
    permissions: [
      { key: 'calendar:read',  label: 'Просмотр календаря' },
      { key: 'calendar:write', label: 'Управление календарём' },
    ],
  },
  {
    group: 'Спецификация',
    permissions: [
      { key: 'specification:read',  label: 'Просмотр спецификации' },
      { key: 'specification:write', label: 'Редактирование спецификации' },
    ],
  },
  {
    group: 'Цены',
    permissions: [
      { key: 'prices:read',  label: 'Просмотр цен' },
      { key: 'prices:write', label: 'Редактирование цен' },
    ],
  },
  {
    group: 'Архив',
    permissions: [
      { key: 'archive:read', label: 'Просмотр архива' },
    ],
  },
  {
    group: 'Настройки',
    permissions: [
      { key: 'team:manage', label: 'Управление командой монтажников' },
    ],
  },
];

/** Плоский список всех ключей разрешений */
export const ALL_PERMISSION_KEYS: string[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key)
);