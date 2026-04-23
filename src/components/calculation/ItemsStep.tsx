'use client';

/**
 * Шаг настройки изделий (окон/полотен) внутри заказа.
 *
 * Архитектурные изменения (ШАГ 2.2):
 *   - WindowItem импортируется из @/types/window (закрыт долг D-02)
 *   - Формула площади перенесена в calculateWindowGeometry (закрыт долг D-03)
 *   - Локальный тип WindowItemDraft разделяет «черновое» состояние при вводе
 *     (number | string) от канонического типа WindowItem (только number)
 *
 * @module src/components/steps/ItemsStep.tsx
 */

import { type MouseEvent, useEffect, useMemo, useState } from 'react';
import DrawingCanvas from './DrawingCanvas';
import styles from './ItemsStep.module.css';

// ---------------------------------------------------------------------------
// Ядро: типы изделия (D-02)
// ---------------------------------------------------------------------------
import {
  type WindowItem,
  type WindowNumericField,
  type WindowTextField,
  type WindowBooleanField,
  type WindowEditableField,
  type KantColor,
  type WindowMaterial,
  createDefaultWindowItem,
} from '@/types';

// ---------------------------------------------------------------------------
// Ядро: расчёты геометрии (D-03)
// ---------------------------------------------------------------------------
import {
  calculateWindowGeometry,
  formatArea,
  type WindowGeometry,
} from '@/lib/logic/windowCalculations';

// ---------------------------------------------------------------------------
// Re-export для обратной совместимости
//
// DrawingCanvas импортирует WindowItem из этого файла.
// Перенаправляем его в @/types/window без изменений в DrawingCanvas.tsx.
// ---------------------------------------------------------------------------
export type { WindowItem };

// ---------------------------------------------------------------------------
// Черновой тип для локального состояния редактирования
//
// Проблема: инпут типа `text` естественно производит строки.
// Пользователь может набирать «200.» или «,5» — промежуточные состояния,
// которые не являются валидными числами, но нужны для плавного UX.
//
// Решение: внутри компонента числовые поля хранятся как `number | string`.
// Конвертация в строгий WindowItem происходит ТОЛЬКО при:
//   - передаче в onSave / onDraftChange (на выход из компонента)
//   - передаче в DrawingCanvas (на рендер SVG)
//   - передаче в calculateWindowGeometry (на расчёт площади)
// ---------------------------------------------------------------------------
type WindowItemDraft = Omit<WindowItem, WindowNumericField> & {
  [K in WindowNumericField]: number | string;
};

// ---------------------------------------------------------------------------
// Вспомогательные функции (UI-слой, не дублируют ядро)
// ---------------------------------------------------------------------------

/**
 * Приводит черновое строковое значение к числу.
 * Используется только при «выходе» из чернового состояния.
 */
function resolveNumericField(value: number | string): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Конвертирует черновик редактирования в строгий WindowItem.
 * Вызывается при сохранении и перед расчётами.
 */
function resolveDraftToWindowItem(draft: WindowItemDraft): WindowItem {
  return {
    id: draft.id,
    name: draft.name,
    kantColor: draft.kantColor,
    material: draft.material,
    isTrapezoid: draft.isTrapezoid,
    widthTop: resolveNumericField(draft.widthTop),
    heightRight: resolveNumericField(draft.heightRight),
    widthBottom: resolveNumericField(draft.widthBottom),
    heightLeft: resolveNumericField(draft.heightLeft),
    kantTop: resolveNumericField(draft.kantTop),
    kantRight: resolveNumericField(draft.kantRight),
    kantBottom: resolveNumericField(draft.kantBottom),
    kantLeft: resolveNumericField(draft.kantLeft),
    diagonalLeft: resolveNumericField(draft.diagonalLeft),
    diagonalRight: resolveNumericField(draft.diagonalRight),
    crossbar: resolveNumericField(draft.crossbar),
  };
}

/**
 * Преобразует WindowItem в WindowItemDraft.
 * WindowItem (только number) структурно совместим с WindowItemDraft (number | string),
 * поэтому это безопасное приведение.
 */
function toWindowItemDraft(item: WindowItem): WindowItemDraft {
  return item as WindowItemDraft;
}

// ---------------------------------------------------------------------------
// Конфигурация полей (вынесена из JSX для читаемости)
// ---------------------------------------------------------------------------

const geometryFields: Array<{ label: string; field: WindowNumericField }> = [
  { label: 'Верх', field: 'widthTop' },
  { label: 'Право', field: 'heightRight' },
  { label: 'Низ', field: 'widthBottom' },
  { label: 'Лево', field: 'heightLeft' },
];

const kantFields: Array<{ label: string; field: WindowNumericField }> = [
  { label: 'Верх', field: 'kantTop' },
  { label: 'Право', field: 'kantRight' },
  { label: 'Низ', field: 'kantBottom' },
  { label: 'Лево', field: 'kantLeft' },
];

// ---------------------------------------------------------------------------
// Пропсы компонента
// ---------------------------------------------------------------------------

interface ItemsStepProps {
  /** Список изделий из родительского состояния (строгие числа). */
  windows: WindowItem[];
  /** Вызывается при нажатии «Сохранить» — отдаёт массив валидных WindowItem. */
  onSave: (items: WindowItem[]) => void;
  /**
   * Вызывается при каждом изменении поля — для live-обновления родителя.
   * Черновики разрешаются в WindowItem перед передачей.
   */
  onDraftChange?: (items: WindowItem[]) => void;
  clientId?: string;
  isReadOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Компонент
// ---------------------------------------------------------------------------

export default function ItemsStep({
  windows,
  onSave,
  onDraftChange,
  isReadOnly = false,
}: ItemsStepProps) {
  // Внутреннее состояние — черновики (number | string для числовых полей)
  const [localWindows, setLocalWindows] = useState<WindowItemDraft[]>(
    () => windows.map(toWindowItemDraft)
  );

  const [activeWindowId, setActiveWindowId] = useState<number>(
    windows[0]?.id ?? Date.now()
  );

  // Синхронизация с пропсами при внешнем обновлении (например, загрузка из БД)
  useEffect(() => {
    if (windows && windows.length > 0) {
      setLocalWindows(windows.map(toWindowItemDraft));
      if (!activeWindowId) setActiveWindowId(windows[0].id);
    }
  }, [activeWindowId, windows]);

  // Активное изделие из локального чернового массива
  const activeItem: WindowItemDraft | undefined =
    localWindows.find((w) => w.id === activeWindowId) ?? localWindows[0];

  // Геометрия активного изделия — вычисляется через ядро (D-03)
  // Мемоизирована: пересчитывается только при изменении activeItem
  const activeItemGeometry: WindowGeometry | null = useMemo(() => {
    if (!activeItem) return null;
    return calculateWindowGeometry(resolveDraftToWindowItem(activeItem));
  }, [activeItem]);

  // ---------------------------------------------------------------------------
  // Обновление состояния
  // ---------------------------------------------------------------------------

  /**
   * Обновляет локальный массив черновиков и уведомляет родителя.
   * Черновики резолвятся в WindowItem[] перед передачей в onDraftChange.
   */
  const updateAll = (updated: WindowItemDraft[]): void => {
    setLocalWindows(updated);
    onDraftChange?.(updated.map(resolveDraftToWindowItem));
  };

  // ---------------------------------------------------------------------------
  // Обработчики действий
  // ---------------------------------------------------------------------------

  const addWindow = (): void => {
    if (isReadOnly) return;
    const newId = Date.now();
    // createDefaultWindowItem из ядра — закрывает хардкод дефолтных значений
    const newWindow = createDefaultWindowItem(newId, localWindows.length + 1);
    updateAll([...localWindows, toWindowItemDraft(newWindow)]);
    setActiveWindowId(newId);
  };

  const removeWindow = (id: number, event: MouseEvent<HTMLSpanElement>): void => {
    event.stopPropagation();
    if (isReadOnly) return;
    if (localWindows.length <= 1) return;
    const updatedWindows = localWindows.filter((w) => w.id !== id);
    updateAll(updatedWindows);
    if (activeWindowId === id) setActiveWindowId(updatedWindows[0].id);
  };

  /**
   * Универсальный обработчик изменения любого поля изделия.
   * Тип value соответствует типу поля в WindowItemDraft.
   */
  const handleChange = (
    id: number,
    field: WindowEditableField,
    value: WindowItemDraft[WindowEditableField]
  ): void => {
    if (isReadOnly) return;
    const updated = localWindows.map((item) =>
      item.id === id ? { ...item, [field]: value } : item
    );
    updateAll(updated);
  };

  /**
   * Обработчик числового инпута.
   * Сохраняет строку в черновике (для поддержки промежуточных состояний «200.»).
   * Разрешение в number происходит в resolveDraftToWindowItem при сохранении.
   */
  const handleNumberInputChange = (
    id: number,
    field: WindowNumericField,
    rawValue: string
  ): void => {
    if (isReadOnly) return;
    // Нормализация: заменяем запятую на точку, убираем всё кроме цифр и точки
    let value = rawValue.replace(',', '.').replace(/[^0-9.]/g, '');
    // Убираем лишние точки (оставляем только первую)
    const parts = value.split('.');
    if (parts.length > 2) value = `${parts[0]}.${parts.slice(1).join('')}`;
    handleChange(id, field, value);
  };

  /**
   * Обработчик кнопки «Сохранить».
   * Черновики резолвятся в строгие WindowItem перед передачей в onSave.
   */
  const handleSaveClick = (): void => {
    onSave(localWindows.map(resolveDraftToWindowItem));
  };

  // ---------------------------------------------------------------------------
  // Рендер
  // ---------------------------------------------------------------------------

  return (
    <div className={styles.itemsGrid}>
      {/* ── Левая панель: форма параметров ─────────────────────────────── */}
      <div className={styles.inputPanelWrapper}>
        <div className={styles.headerRow}>
          <h2 className={styles.sectionTitle}>
            ПАРАМЕТРЫ {isReadOnly ? '(ARCHIVE)' : '(EDIT)'}
          </h2>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>
            {activeItem?.name}
          </span>
        </div>

        {activeItem && (
          <div className={styles.itemCard} style={{ border: 'none', background: 'none', padding: 0 }}>

            {/* Материал полотна */}
            <div className={styles.formSection}>
              <h4>Материал полотна</h4>
              <div className={styles.inputGroup} style={{ position: 'relative' }}>
                <select
                  className={styles.selectInput}
                  value={activeItem.material}
                  onChange={(event) =>
                    handleChange(activeItem.id, 'material', event.target.value as WindowMaterial)
                  }
                  disabled={isReadOnly}
                >
                  <option value="ПВХ 700 мкм (Прозрачная)">ПВХ Прозрачная</option>
                  <option value="ПВХ 700 мкм (Тонированная)">ПВХ Тонированная</option>
                  <option value="ТПУ Полиуретан">ТПУ Полиуретан</option>
                  <option value="Москитная сетка">Москитная сетка</option>
                </select>
                <div className={styles.selectArrow}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
            </div>

            {/* Геометрия */}
            <div className={styles.formSection}>
              <h4>Геометрия (см)</h4>
              <div className={styles.geometryGrid}>
                {geometryFields.map((input) => (
                  <div key={input.field} className={styles.inputGroup}>
                    <label>{input.label}</label>
                    <input
                      type="text"
                      value={activeItem[input.field]}
                      onChange={(event) =>
                        handleNumberInputChange(activeItem.id, input.field, event.target.value)
                      }
                      disabled={isReadOnly}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Кант */}
            <div className={styles.formSection}>
              <h4>Кант (см)</h4>
              <div className={styles.geometryGrid}>
                {kantFields.map((input) => (
                  <div key={input.field} className={styles.inputGroup}>
                    <label>{input.label}</label>
                    <input
                      type="text"
                      value={activeItem[input.field]}
                      onChange={(event) =>
                        handleNumberInputChange(activeItem.id, input.field, event.target.value)
                      }
                      disabled={isReadOnly}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Цвет канта */}
            <div className={styles.formSection} style={{ marginBottom: '20px' }}>
              <h4>Цвет канта</h4>
              <div className={styles.inputGroup} style={{ position: 'relative' }}>
                <select
                  className={styles.selectInput}
                  value={activeItem.kantColor}
                  onChange={(event) =>
                    handleChange(activeItem.id, 'kantColor', event.target.value as KantColor)
                  }
                  disabled={isReadOnly}
                >
                  {(
                    [
                      'Белый',
                      'Светло-серый',
                      'Серый',
                      'Графит',
                      'Черный',
                      'Коричневый',
                      'Бежевый',
                      'Синий',
                    ] as KantColor[]
                  ).map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
                <div className={styles.selectArrow}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
            </div>

            {/* Трапеция */}
            <div className={styles.formSection}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={activeItem.isTrapezoid}
                  onChange={(event) =>
                    handleChange(activeItem.id, 'isTrapezoid', event.target.checked)
                  }
                  disabled={isReadOnly}
                />
                Трапеция
              </label>

              {activeItem.isTrapezoid && (
                <div className={styles.trapezoidFields}>
                  <div className={styles.inputGroup}>
                    <label>ДИАГОНАЛЬ A-C (см)</label>
                    <input
                      type="text"
                      value={activeItem.diagonalRight === 0 ? '' : activeItem.diagonalRight}
                      placeholder="0"
                      onChange={(event) =>
                        handleNumberInputChange(activeItem.id, 'diagonalRight', event.target.value)
                      }
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>ДИАГОНАЛЬ B-D (см)</label>
                    <input
                      type="text"
                      value={activeItem.diagonalLeft === 0 ? '' : activeItem.diagonalLeft}
                      placeholder="0"
                      onChange={(event) =>
                        handleNumberInputChange(activeItem.id, 'diagonalLeft', event.target.value)
                      }
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>ПАРАЛЛЕЛЬ (см)</label>
                    <input
                      type="text"
                      value={activeItem.crossbar === 0 ? '' : activeItem.crossbar}
                      placeholder="0"
                      onChange={(event) =>
                        handleNumberInputChange(activeItem.id, 'crossbar', event.target.value)
                      }
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Кнопка сохранения */}
        {!isReadOnly && (
          <button
            className={styles.saveButton}
            onClick={handleSaveClick}
            style={{ marginTop: 'auto' }}
          >
            СОХРАНИТЬ ВСЕ ИЗДЕЛИЯ
          </button>
        )}
      </div>

      {/* ── Правая панель: вкладки + SVG + инфобар ──────────────────────── */}
      <div className={styles.rightColumn}>

        {/* Вкладки окон */}
        <div className={styles.tabsRow}>
          {localWindows.map((windowItem, index) => (
            <div
              key={windowItem.id}
              className={`${styles.tabItem} ${
                activeWindowId === windowItem.id ? styles.activeTab : ''
              }`}
              onClick={() => setActiveWindowId(windowItem.id)}
            >
              Окно {index + 1}
              {!isReadOnly && localWindows.length > 1 && (
                <span
                  className={styles.closeTab}
                  onClick={(event) => removeWindow(windowItem.id, event)}
                >
                  ×
                </span>
              )}
            </div>
          ))}
          {!isReadOnly && (
            <button className={styles.addTabButton} onClick={addWindow}>
              +
            </button>
          )}
        </div>

        {activeItem && activeItemGeometry && (
          <>
            {/* SVG-чертёж: получает строго числовой WindowItem */}
            <div className={styles.drawingWrapper}>
              <DrawingCanvas item={resolveDraftToWindowItem(activeItem)} />
            </div>

            {/* Инфобар: площадь через calculateWindowGeometry (D-03 закрыт) */}
            <div className={styles.bottomInfoBar}>
              <div className={styles.statLabel}>
                Выбрано: <span>{activeItem.name}</span>
              </div>

              <div className={styles.statLabel}>
                Полотно:{' '}
                <span>{formatArea(activeItemGeometry.areaMaterial)}</span>
              </div>

              <div className={styles.statLabel}>
                С кантом:{' '}
                <span>{formatArea(activeItemGeometry.areaWithKant)}</span>
              </div>

              {/*
               * Если геометрия трапеции оказалась математически невозможной
               * (стороны не замыкаются), ядро возвращает isExact=false.
               * Показываем предупреждение — не скрываем проблему от пользователя.
               */}
              {!activeItemGeometry.isExact && (
                <div
                  className={styles.statLabel}
                  style={{ color: '#ff9900', fontSize: '0.7rem' }}
                >
                  ⚠ Приближённый расчёт — проверьте размеры трапеции
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}