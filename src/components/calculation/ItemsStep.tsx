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
  calculateOrderOptimization, // ← Добавь это
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
    fasteners: draft.fasteners,
    additionalElements: draft.additionalElements, // ← добавить эту строку
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

function getTrapezoidWarning(item: WindowItemDraft | undefined): string | null {
  if (!item) return null;

  const widthTop = resolveNumericField(item.widthTop);
  const widthBottom = resolveNumericField(item.widthBottom);
  const heightLeft = resolveNumericField(item.heightLeft);
  const heightRight = resolveNumericField(item.heightRight);

  const hasTrapezoidDifference =
    Math.abs(widthTop - widthBottom) >= 5 ||
    Math.abs(heightLeft - heightRight) >= 5;

  if (hasTrapezoidDifference && !item.isTrapezoid) {
    return '⚠ Разница сторон 5 см или больше. Похоже на трапецию. Если это действительно трапеция — включите режим «Трапеция» и заполните диагонали/параллель.';
  }

  if (item.isTrapezoid) {
    const diagonalLeft = resolveNumericField(item.diagonalLeft);
    const diagonalRight = resolveNumericField(item.diagonalRight);
    const crossbar = resolveNumericField(item.crossbar);

    if (diagonalLeft <= 0 || diagonalRight <= 0 || crossbar <= 0) {
      return '⚠ Для точного расчёта трапеции нужно заполнить: диагональ A-C, диагональ B-D и параллель.';
    }
  }

  return null;
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
// Диагностический вывод текущего расчёта
// ─────────────────────────────────────────────────────────────────────────────

interface WindowCalculationDebugRow {
  id: number;
  index: number;
  name: string;
  material: string;
  innerWidth: number;
  innerHeight: number;
  cutWidthRaw: number;
  cutHeightRaw: number;
  widthAcrossRoll: number;
  cutLength: number;
  chargedWidth: number;
  geometry: WindowGeometry;
}

function getMaterialLabel(material: string): string {
  switch (material) {
    case 'PVC_700':
      return 'ПВХ 700';
    case 'TINTED':
      return 'Тонировка';
    case 'TPU':
      return 'TPU';
    case 'MOSQUITO':
      return 'Москитка';
    default:
      return material || '—';
  }
}

function formatCm(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(0)} см`;
}

function formatM(valueCm: number): string {
  if (!Number.isFinite(valueCm)) return '—';
  return `${(valueCm / 100).toFixed(2)} м`;
}

function buildDebugRow(item: WindowItem, index: number): WindowCalculationDebugRow {
  const geometry = calculateWindowGeometry(item);
  const innerWidth = Math.max(Number(item.widthTop), Number(item.widthBottom));
  const innerHeight = Math.max(Number(item.heightLeft), Number(item.heightRight));
  const cutWidthRaw = innerWidth + 6;
  const cutHeightRaw = innerHeight + 6;
  const widthAcrossRoll = geometry.isRotated ? cutHeightRaw : cutWidthRaw;
  const cutLength = geometry.isRotated ? cutWidthRaw : cutHeightRaw;
  const chargedWidth = geometry.isOverSize
    ? widthAcrossRoll
    : Math.max(Number(geometry.rollWidth), widthAcrossRoll);

  return {
    id: item.id,
    index,
    name: item.name,
    material: item.material || 'PVC_700',
    innerWidth,
    innerHeight,
    cutWidthRaw,
    cutHeightRaw,
    widthAcrossRoll,
    cutLength,
    chargedWidth,
    geometry,
  };
}

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
  const [localWindows, setLocalWindows] = useState<WindowItemDraft[]>(() => {
    if (windows && windows.length > 0) {
      return windows.map(toWindowItemDraft);
    }

    if (isReadOnly) {
      return [];
    }

    return [toWindowItemDraft(createDefaultWindowItem(Date.now(), 1))];
  });

  // Синхронизация при внешнем обновлении windows (например, после сохранения)
  useEffect(() => {
    if (windows && windows.length > 0) {
      setLocalWindows(windows.map(toWindowItemDraft));
    }
  }, [windows]);

  useEffect(() => {
    if (localWindows.length === 0 || isReadOnly) return;

    const hasActiveWindow = localWindows.some((w) => w.id === activeWindowId);

    if (!hasActiveWindow) {
      onActiveWindowChange(localWindows[0].id);
    }
  }, [localWindows, activeWindowId, onActiveWindowChange, isReadOnly]);

  useEffect(() => {
    if (localWindows.length === 0 || isReadOnly) return;
    if (windows && windows.length > 0) return;

    onDraftChange?.(localWindows.map(resolveDraftToWindowItem));
  }, [localWindows.length, windows, onDraftChange, isReadOnly]);

  const activeItem: WindowItemDraft | undefined =
    localWindows.find((w) => w.id === activeWindowId) ?? localWindows[0];

  const activeItemGeometry: WindowGeometry | null = useMemo(() => {
    if (!activeItem) return null;
    return calculateWindowGeometry(resolveDraftToWindowItem(activeItem));
  }, [activeItem]);

  const resolvedWindows = useMemo(() => {
    return localWindows.map(resolveDraftToWindowItem);
  }, [localWindows]);

  // Глобальный расчет всего заказа для блока "Итого рулонов"
  const orderSummary = useMemo(() => {
    return calculateOrderOptimization(resolvedWindows);
  }, [resolvedWindows]);

  const debugRows = useMemo(() => {
    return resolvedWindows.map((item, index) => buildDebugRow(item, index));
  }, [resolvedWindows]);

  const trapezoidWarning = useMemo(
    () => getTrapezoidWarning(activeItem),
    [activeItem],
  );

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
            ПАРАМЕТРЫ {isReadOnly ? '(АРХИВ)' : '(РЕДАКТ.)'}
          </h2>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>
            {activeItem?.name}
          </span>
        </div>

        {activeItem && (
          <div className={styles.itemCard} style={{ border: 'none', background: 'none', padding: 0 }}>

            {/* Материал */}
            <div className={styles.formSection}>
              {trapezoidWarning && (
                <div
                  style={{
                    color: '#FFD600',
                    background: 'rgba(255, 214, 0, 0.08)',
                    border: '1px solid rgba(255, 214, 0, 0.35)',
                    borderRadius: 12,
                    padding: '10px 12px',
                    marginBottom: 12,
                    fontSize: 12,
                    lineHeight: 1.4,
                  }}
                >
                  {trapezoidWarning}
                </div>
              )}
              <h4>Материал полотна</h4>
              <div className={styles.inputGroup} style={{ position: 'relative' }}>
                <select
                  className={styles.selectInput}
                  value={activeItem.material}
                  onChange={(e) => handleChange(activeItem.id, 'material', e.target.value as WindowMaterial)}
                  disabled={isReadOnly}
                >
                  {/* ПВХ 500 УДАЛЕН ПО ПРИКАЗУ ВЛАДЕЛЬЦА */}
                  <option value="PVC_700">ПВХ Прозрачная (700 мкм)</option>
                  <option value="TINTED">ПВХ Тонированная</option>
                  <option value="TPU">ТПУ Полиуретан</option>
                  <option value="MOSQUITO">Москитная сетка</option>
                </select>
                <div className={styles.selectArrow}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Ширина рулона (списание) */}
            <div className={styles.formSection}>
              <h4>Ширина рулона (списание)</h4>
              <div className={styles.inputGroup} style={{ position: 'relative' }}>
                <input
                  className={styles.selectInput}
                  type="text"
                  value={activeItemGeometry ? `${activeItemGeometry.rollWidth} см` : '—'}
                  readOnly
                  style={{
                    cursor: 'default',
                    textAlign: 'left',
                    background: 'rgba(15, 23, 42, 0.6)',
                    // КРАСНЫЙ если оверзайс, ЗЕЛЕНЫЙ если норма
                    color: activeItemGeometry?.isOverSize ? '#ff4d4f' : '#7BFF00',
                    fontWeight: '700',
                    border: activeItemGeometry?.isOverSize ? '1px solid #ff4d4f' : 'none',
                    transition: 'all 0.3s ease'
                  }}
                />
                <div className={styles.selectArrow}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke={activeItemGeometry?.isOverSize ? '#ff4d4f' : 'currentColor'}
                    strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
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

              {/* Новая метрика для контроля перерасхода */}
              <div className={styles.statLabel}>
                Раскрой: <span style={{ color: activeItemGeometry.isOverSize ? '#ff4d4f' : '#7BFF00' }}>
                  {formatArea(activeItemGeometry.cutArea)}
                </span>
              </div>

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