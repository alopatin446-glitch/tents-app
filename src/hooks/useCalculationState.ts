/**
 * Хук общего состояния расчёта.
 *
 * Решает D-11: связывает список изделий (ItemsStep) с финансовыми
 * показателями клиента (ClientStep) через реактивный расчёт площади.
 *
 * Принцип работы:
 *   1. Хук хранит `windows` и `clientData` раздельно.
 *   2. При каждом изменении `windows` пересчитывает `totalArea`
 *      через `calculateTotalArea` из ядра (единственное место расчёта).
 *   3. `totalArea` автоматически инжектируется в `clientData.area` —
 *      ClientStep получает актуальное значение без ручного ввода.
 *   4. Оба компонента (ClientStep, ItemsStep) получают только свою часть
 *      состояния — хук изолирует их от деталей друг друга.
 *
 * @module src/hooks/useCalculationState.ts
 */

import { useCallback, useMemo, useState } from 'react';

import { type WindowItem } from '@/types';
import { type ClientFormData } from '@/components/calculation/ClientStep';
import {
  calculateTotalArea,
  calculateTotalAreaWithKant,
} from '@/lib/logic/windowCalculations';

// ---------------------------------------------------------------------------
// Типы
// ---------------------------------------------------------------------------

export interface CalculationState {
  /** Актуальный список изделий. */
  windows: WindowItem[];

  /**
   * Данные клиента с инжектированной площадью.
   * `area` всегда равна `calculateTotalArea(windows)` — никогда не устаревает.
   */
  clientDataWithArea: ClientFormData;

  /** Суммарная площадь полотна (без канта) в м². */
  totalAreaMaterial: number;

  /** Суммарная площадь с кантом в м². */
  totalAreaWithKant: number;

  // --- Обработчики для передачи в дочерние компоненты ---

  /**
   * Вызывается из `ItemsStep.onDraftChange` или `ItemsStep.onSave`.
   * Обновляет список изделий → триггерит пересчёт площади.
   */
  handleWindowsChange: (updated: WindowItem[]) => void;

  /**
   * Вызывается из `ClientStep.onDraftChange`.
   * Обновляет поля клиента (не трогает `area` — она управляется хуком).
   */
  handleClientDataChange: (updated: ClientFormData) => void;
}

// ---------------------------------------------------------------------------
// Хук
// ---------------------------------------------------------------------------

/**
 * @param initialClientData - начальные данные клиента (из БД или пустые)
 * @param initialWindows    - начальный список изделий (из БД или пустой)
 */
export function useCalculationState(
  initialClientData: ClientFormData,
  initialWindows: WindowItem[]
): CalculationState {
  const [windows, setWindows] = useState<WindowItem[]>(initialWindows);
  const [clientData, setClientData] = useState<ClientFormData>(initialClientData);

  // ---------------------------------------------------------------------------
  // Реактивный расчёт площади (D-11)
  //
  // useMemo: пересчёт только при изменении массива windows.
  // Функции из ядра — единственный источник формул площади (D-03).
  // ---------------------------------------------------------------------------

  const totalAreaMaterial = useMemo(
    () => calculateTotalArea(windows),
    [windows]
  );

  const totalAreaWithKant = useMemo(
    () => calculateTotalAreaWithKant(windows),
    [windows]
  );

  /**
   * Данные клиента с актуальной площадью.
   *
   * `area` инжектируется автоматически — ClientStep никогда не получает
   * устаревшее значение. Поле `area` в форме становится read-only отображением,
   * а не ручным вводом.
   */
  const clientDataWithArea = useMemo<ClientFormData>(
    () => ({
      ...clientData,
      area: totalAreaMaterial,
    }),
    [clientData, totalAreaMaterial]
  );

  // ---------------------------------------------------------------------------
  // Обработчики
  // ---------------------------------------------------------------------------

  /**
   * Обновляет список изделий.
   * Вызывается из `ItemsStep.onDraftChange` (live) и `ItemsStep.onSave` (сохранение).
   * useCallback: стабильная ссылка — не вызывает лишних ре-рендеров ItemsStep.
   */
  const handleWindowsChange = useCallback((updated: WindowItem[]): void => {
    setWindows(updated);
  }, []);

  /**
   * Обновляет данные клиента.
   * НЕ перезаписывает `area` — она управляется хуком.
   * Вызывается из `ClientStep.onDraftChange`.
   */
  const handleClientDataChange = useCallback(
    (updated: ClientFormData): void => {
      setClientData((prev) => {
        // Исключаем area, так как она вычисляется автоматически в этом хуке
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { area: _ignored, ...rest } = updated;

        // ПРОВЕРКА: Сравниваем каждое поле. Если изменений нет — возвращаем старый объект.
        // Это предотвратит лишний рендер и остановит петлю в React.
        const hasChanges = Object.keys(rest).some((k) => {
          const key = k as keyof ClientFormData;
          return prev[key] !== (rest as any)[key];
        });

        if (!hasChanges) {
          return prev;
        }

        return { ...prev, ...rest };
      });
    },
    []
  );

  return {
    windows,
    clientDataWithArea,
    totalAreaMaterial,
    totalAreaWithKant,
    handleWindowsChange,
    handleClientDataChange,
  };
}