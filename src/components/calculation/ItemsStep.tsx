'use client';

/**
 * Шаг настройки геометрии изделий.
 *
 * Изменения для модуля крепежа:
 *   - activeWindowId и onActiveWindowChange вынесены в пропсы
 *     (lifted state) — чтобы вкладка КРЕПЁЖ помнила выбранное окно.
 *   - resolveDraftToWindowItem теперь сохраняет поле fasteners.
 *   - Внутренний useState для activeWindowId удалён.
 *
 * @module src/components/calculation/ItemsStep.tsx
 */

import { type MouseEvent, useEffect, useMemo, useState } from 'react';
import DrawingCanvas from './DrawingCanvas';
import styles from './ItemsStep.module.css';

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

import {
  calculateWindowGeometry,
  formatArea,
  type WindowGeometry,
} from '@/lib/logic/windowCalculations';

export type { WindowItem };

// ─────────────────────────────────────────────────────────────────────────────
// Черновой тип (строки для числовых полей во время ввода)
// ─────────────────────────────────────────────────────────────────────────────

type WindowItemDraft = Omit<WindowItem, WindowNumericField> & {
  [K in WindowNumericField]: number | string;
};

function resolveNumericField(value: number | string): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveDraftToWindowItem(draft: WindowItemDraft): WindowItem {
  return {
    id: draft.id,
    name: draft.name,
    kantColor: draft.kantColor,
    material: draft.material,
    isTrapezoid: draft.isTrapezoid,
    // Сохраняем fasteners как есть — они не редактируются в ItemsStep
    fasteners: draft.fasteners,
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

function toWindowItemDraft(item: WindowItem): WindowItemDraft {
  return item as WindowItemDraft;
}

// ─────────────────────────────────────────────────────────────────────────────
// Конфигурация полей
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Пропсы
// ─────────────────────────────────────────────────────────────────────────────

interface ItemsStepProps {
  windows: WindowItem[];
  onSave: (items: WindowItem[]) => void | Promise<void>;
  onDraftChange?: (items: WindowItem[]) => void;
  clientId?: string;
  isReadOnly?: boolean;
  /** Lifted state: выбранное окно хранится в CalculationClient */
  activeWindowId: number;
  onActiveWindowChange: (id: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Компонент
// ─────────────────────────────────────────────────────────────────────────────

export default function ItemsStep({
  windows,
  onSave,
  onDraftChange,
  isReadOnly = false,
  activeWindowId,
  onActiveWindowChange,
}: ItemsStepProps) {
  const [localWindows, setLocalWindows] = useState<WindowItemDraft[]>(
    () => windows.map(toWindowItemDraft),
  );

  // Синхронизация при внешнем обновлении windows (например, после сохранения)
  useEffect(() => {
    if (windows && windows.length > 0) {
      setLocalWindows(windows.map(toWindowItemDraft));
    }
  }, [windows]);

  const activeItem: WindowItemDraft | undefined =
    localWindows.find((w) => w.id === activeWindowId) ?? localWindows[0];

  const activeItemGeometry: WindowGeometry | null = useMemo(() => {
    if (!activeItem) return null;
    return calculateWindowGeometry(resolveDraftToWindowItem(activeItem));
  }, [activeItem]);

  // ─── Обновление состояния ────────────────────────────────────────────────

  const updateAll = (updated: WindowItemDraft[]): void => {
    setLocalWindows(updated);
    onDraftChange?.(updated.map(resolveDraftToWindowItem));
  };

  // ─── Обработчики ─────────────────────────────────────────────────────────

  const addWindow = (): void => {
    if (isReadOnly) return;
    const newId = Date.now();
    const newWindow = createDefaultWindowItem(newId, localWindows.length + 1);
    updateAll([...localWindows, toWindowItemDraft(newWindow)]);
    onActiveWindowChange(newId);
  };

  const removeWindow = (id: number, event: MouseEvent<HTMLSpanElement>): void => {
    event.stopPropagation();
    if (isReadOnly) return;
    if (localWindows.length <= 1) return;
    const updatedWindows = localWindows.filter((w) => w.id !== id);
    updateAll(updatedWindows);
    if (activeWindowId === id) onActiveWindowChange(updatedWindows[0].id);
  };

  const handleChange = (
    id: number,
    field: WindowEditableField,
    value: WindowItemDraft[WindowEditableField],
  ): void => {
    if (isReadOnly) return;
    const updated = localWindows.map((item) =>
      item.id === id ? { ...item, [field]: value } : item,
    );
    updateAll(updated);
  };

  const handleNumberInputChange = (id: number, field: WindowNumericField, rawValue: string): void => {
    if (isReadOnly) return;
    let value = rawValue.replace(',', '.').replace(/[^0-9.]/g, '');
    const parts = value.split('.');
    if (parts.length > 2) value = `${parts[0]}.${parts.slice(1).join('')}`;
    handleChange(id, field, value);
  };

  const handleSaveClick = (): void => {
    onSave(localWindows.map(resolveDraftToWindowItem));
  };

  // ─── Рендер ──────────────────────────────────────────────────────────────

  return (
    <div className={styles.itemsGrid}>
      {/* Левая панель: параметры */}
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

            {/* Материал */}
            <div className={styles.formSection}>
              <h4>Материал полотна</h4>
              <div className={styles.inputGroup} style={{ position: 'relative' }}>
                <select
                  className={styles.selectInput}
                  value={activeItem.material}
                  onChange={(e) => handleChange(activeItem.id, 'material', e.target.value as WindowMaterial)}
                  disabled={isReadOnly}
                >
                  <option value="ПВХ 700 мкм (Прозрачная)">ПВХ Прозрачная</option>
                  <option value="ПВХ 700 мкм (Тонированная)">ПВХ Тонированная</option>
                  <option value="ТПУ Полиуретан">ТПУ Полиуретан</option>
                  <option value="Москитная сетка">Москитная сетка</option>
                </select>
                <div className={styles.selectArrow}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
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
                      onChange={(e) => handleNumberInputChange(activeItem.id, input.field, e.target.value)}
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
                      onChange={(e) => handleNumberInputChange(activeItem.id, input.field, e.target.value)}
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
                  onChange={(e) => handleChange(activeItem.id, 'kantColor', e.target.value as KantColor)}
                  disabled={isReadOnly}
                >
                  {(['Белый', 'Светло-серый', 'Серый', 'Графит', 'Черный', 'Коричневый', 'Бежевый', 'Синий'] as KantColor[]).map((color) => (
                    <option key={color} value={color}>{color}</option>
                  ))}
                </select>
                <div className={styles.selectArrow}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
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
                  onChange={(e) => handleChange(activeItem.id, 'isTrapezoid', e.target.checked)}
                  disabled={isReadOnly}
                />
                Трапеция
              </label>
              {activeItem.isTrapezoid && (
                <div className={styles.trapezoidFields}>
                  <div className={styles.inputGroup}>
                    <label>ДИАГОНАЛЬ A-C (см)</label>
                    <input type="text" value={activeItem.diagonalRight === 0 ? '' : activeItem.diagonalRight} placeholder="0" onChange={(e) => handleNumberInputChange(activeItem.id, 'diagonalRight', e.target.value)} disabled={isReadOnly} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>ДИАГОНАЛЬ B-D (см)</label>
                    <input type="text" value={activeItem.diagonalLeft === 0 ? '' : activeItem.diagonalLeft} placeholder="0" onChange={(e) => handleNumberInputChange(activeItem.id, 'diagonalLeft', e.target.value)} disabled={isReadOnly} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>ПАРАЛЛЕЛЬ (см)</label>
                    <input type="text" value={activeItem.crossbar === 0 ? '' : activeItem.crossbar} placeholder="0" onChange={(e) => handleNumberInputChange(activeItem.id, 'crossbar', e.target.value)} disabled={isReadOnly} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!isReadOnly && (
          <button className={styles.saveButton} onClick={handleSaveClick} style={{ marginTop: 'auto' }}>
            СОХРАНИТЬ ВСЕ ИЗДЕЛИЯ
          </button>
        )}
      </div>

      {/* Правая панель: вкладки + чертёж */}
      <div className={styles.rightColumn}>
        <div className={styles.tabsRow}>
          {localWindows.map((windowItem, index) => (
            <div
              key={windowItem.id}
              className={`${styles.tabItem} ${activeWindowId === windowItem.id ? styles.activeTab : ''}`}
              onClick={() => onActiveWindowChange(windowItem.id)}
            >
              Окно {index + 1}
              {!isReadOnly && localWindows.length > 1 && (
                <span className={styles.closeTab} onClick={(e) => removeWindow(windowItem.id, e)}>×</span>
              )}
            </div>
          ))}
          {!isReadOnly && (
            <button className={styles.addTabButton} onClick={addWindow}>+</button>
          )}
        </div>

        {activeItem && activeItemGeometry && (
          <>
            <div className={styles.drawingWrapper}>
              <DrawingCanvas item={resolveDraftToWindowItem(activeItem)} showFasteners={false} />
            </div>
            <div className={styles.bottomInfoBar}>
              <div className={styles.statLabel}>Выбрано: <span>{activeItem.name}</span></div>
              <div className={styles.statLabel}>Полотно: <span>{formatArea(activeItemGeometry.areaMaterial)}</span></div>
              <div className={styles.statLabel}>С кантом: <span>{formatArea(activeItemGeometry.areaWithKant)}</span></div>
              {!activeItemGeometry.isExact && (
                <div className={styles.statLabel} style={{ color: '#ff9900', fontSize: '0.7rem' }}>
                  ⚠ Приближённый расчёт
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}