'use client';

/**
 * ExtrasStep — редактор дополнительных элементов.
 * * Особенности:
 * - Интерфейс в стиле аккордеона для Ремешков / Молний / Разделителей / Вырезов / Сварки / Юбки.
 * - Вкладки окон (как в FastenersStep); кнопка "Добавить окно" отключена.
 * - Вызывает onExtrasChange (обновляет только additionalElements).
 */

import { type MouseEvent, useState, useCallback, useMemo } from 'react';
import DrawingCanvas from './DrawingCanvas';
import styles from './ExtrasStep.module.css';

import type {
  WindowItem,
  AdditionalElements,
  ZipperItem,
  DividerItem,
  CutoutItem,
  WeldingItem,
  ElementOrientation,
  StrapType,
} from '@/types';
import {
  deriveStrapCount,
  getOuterTopCm,
  validateExtras,
  detectExtrasCollisions,
} from '@/lib/logic/extrasCalculations';

// ─────────────────────────────────────────────────────────────────────────────
// Генератор ID
// ─────────────────────────────────────────────────────────────────────────────

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

interface ExtrasStepProps {
  windows: WindowItem[];
  activeWindowId: number;
  onActiveWindowChange: (id: number) => void;
  onExtrasChange: (windowId: number, extras: AdditionalElements) => void;
  onSave: (windows: WindowItem[]) => void;
  isReadOnly?: boolean;
}

type SectionKey = 'straps' | 'zippers' | 'dividers' | 'cutouts' | 'welding' | 'skirt';

type CutoutPosition =
  | 'tl'
  | 'tc'
  | 'tr'
  | 'lc'
  | 'rc'
  | 'bl'
  | 'bc'
  | 'br';

const CUTOUT_POSITIONS: Array<Array<{ value: CutoutPosition | null; label: string }>> = [
  [
    { value: 'tl', label: '↖' },
    { value: 'tc', label: '↑' },
    { value: 'tr', label: '↗' },
  ],
  [
    { value: 'lc', label: '←' },
    { value: null, label: '' },
    { value: 'rc', label: '→' },
  ],
  [
    { value: 'bl', label: '↙' },
    { value: 'bc', label: '↓' },
    { value: 'br', label: '↘' },
  ],
];

function getInnerSize(item: WindowItem): { width: number; height: number } {
  return {
    width: Math.max(item.widthTop, item.widthBottom),
    height: Math.max(item.heightLeft, item.heightRight),
  };
}

function getCutoutPosition(cutout: CutoutItem, item: WindowItem): CutoutPosition {
  const { width, height } = getInnerSize(item);
  const epsilon = 0.01;

  const touchesLeft = Math.abs(cutout.x) <= epsilon;
  const touchesTop = Math.abs(cutout.y) <= epsilon;
  const touchesRight = Math.abs(cutout.x + cutout.width - width) <= epsilon;
  const touchesBottom = Math.abs(cutout.y + cutout.height - height) <= epsilon;

  if (touchesTop && touchesLeft) return 'tl';
  if (touchesTop && touchesRight) return 'tr';
  if (touchesBottom && touchesLeft) return 'bl';
  if (touchesBottom && touchesRight) return 'br';
  if (touchesTop) return 'tc';
  if (touchesBottom) return 'bc';
  if (touchesLeft) return 'lc';
  if (touchesRight) return 'rc';

  return 'tc';
}

function getCutoutOffset(cutout: CutoutItem, item: WindowItem): number {
  const position = getCutoutPosition(cutout, item);

  if (position === 'lc' || position === 'rc') {
    return cutout.y;
  }

  return cutout.x;
}

function getDefaultCutoutOffsetForPosition(
  cutout: CutoutItem,
  item: WindowItem,
  position: CutoutPosition,
): number {
  const { width: itemWidth, height: itemHeight } = getInnerSize(item);

  if (position === 'tc' || position === 'bc') {
    return Math.max(0, (itemWidth - cutout.width) / 2);
  }

  if (position === 'lc' || position === 'rc') {
    return Math.max(0, (itemHeight - cutout.height) / 2);
  }

  return 0;
}

function placeCutoutAtPosition(
  cutout: CutoutItem,
  item: WindowItem,
  position: CutoutPosition,
  offsetInput?: number,
): CutoutItem {
  const { width: itemWidth, height: itemHeight } = getInnerSize(item);
  const width = Math.max(1, cutout.width);
  const height = Math.max(1, cutout.height);
  const maxX = Math.max(0, itemWidth - width);
  const maxY = Math.max(0, itemHeight - height);
  const offset = Math.max(0, offsetInput ?? getCutoutOffset(cutout, item));

  const clampX = (value: number) => Math.min(maxX, Math.max(0, value));
  const clampY = (value: number) => Math.min(maxY, Math.max(0, value));

  switch (position) {
    case 'tl':
      return { ...cutout, x: 0, y: 0, width, height };
    case 'tc':
      return { ...cutout, x: clampX(offset), y: 0, width, height };
    case 'tr':
      return { ...cutout, x: maxX, y: 0, width, height };
    case 'lc':
      return { ...cutout, x: 0, y: clampY(offset), width, height };
    case 'rc':
      return { ...cutout, x: maxX, y: clampY(offset), width, height };
    case 'bl':
      return { ...cutout, x: 0, y: maxY, width, height };
    case 'bc':
      return { ...cutout, x: clampX(offset), y: maxY, width, height };
    case 'br':
      return { ...cutout, x: maxX, y: maxY, width, height };
    default:
      return cutout;
  }
}

export default function ExtrasStep({
  windows,
  activeWindowId,
  onActiveWindowChange,
  onExtrasChange,
  onSave,
  isReadOnly = false,
}: ExtrasStepProps) {
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(
    () => new Set(['straps']),
  );

  const [cutoutPositions, setCutoutPositions] = useState<Record<string, CutoutPosition>>({});

  const activeWindow = windows.find((w) => w.id === activeWindowId) ?? windows[0];
  const extras = activeWindow?.additionalElements;

  // ── Вычисляемые значения ───────────────────────────────────────────────────
  const derivedStrapCount = useMemo(
    () => (activeWindow ? deriveStrapCount(getOuterTopCm(activeWindow)) : 2),
    [activeWindow],
  );

  const validationResult = useMemo(
    () => (activeWindow ? validateExtras(activeWindow) : { isValid: true, errors: [] }),
    [activeWindow],
  );

  const collisionWarnings = useMemo(
    () => (activeWindow ? detectExtrasCollisions(activeWindow) : []),
    [activeWindow],
  );

  const toggleSection = useCallback((key: SectionKey) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const patch = useCallback(
    (update: Partial<AdditionalElements>) => {
      if (!activeWindow || !extras || isReadOnly) return;
      onExtrasChange(activeWindow.id, { ...extras, ...update });
    },
    [activeWindow, extras, isReadOnly, onExtrasChange],
  );

  if (!activeWindow || !extras) {
    return <div className={styles.empty}>Окно не выбрано</div>;
  }

  const renderSection = (key: SectionKey, title: string, badge?: number) => {
    const isOpen = openSections.has(key);
    return (
      <button
        type="button"
        className={`${styles.accordionHeader} ${isOpen ? styles.accordionHeaderOpen : ''}`}
        onClick={() => toggleSection(key)}
        aria-expanded={isOpen}
      >
        <span className={styles.accordionTitle}>{title}</span>
        {badge !== undefined && badge > 0 && (
          <span className={styles.badge}>{badge}</span>
        )}
        <span className={styles.accordionChevron}>{isOpen ? '▲' : '▼'}</span>
      </button>
    );
  };

  // ─── Секция: Ремешки ───────────────────────────────────────────────────────
  const strapsSection = (
    <div className={styles.accordionItem}>
      {renderSection('straps', 'Ремешки крепления')}
      {openSections.has('straps') && (
        <div className={styles.accordionBody}>
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Расчетное кол-во:</span>
            <span className={styles.fieldValue}>{derivedStrapCount}</span>
          </div>

          <div className={styles.fieldRow}>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={extras.straps.isManual}
                disabled={isReadOnly}
                onChange={(e) =>
                  patch({
                    straps: {
                      ...extras.straps,
                      isManual: e.target.checked,
                      count: e.target.checked ? extras.straps.count : derivedStrapCount,
                    },
                  })
                }
              />
              Ручной ввод
            </label>
          </div>

          {extras.straps.isManual && (
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Количество:</label>
              <input
                type="number"
                className={styles.numInput}
                min={1}
                value={extras.straps.count}
                disabled={isReadOnly}
                onChange={(e) =>
                  patch({
                    straps: {
                      ...extras.straps,
                      count: Math.max(1, parseInt(e.target.value, 10) || 1),
                    },
                  })
                }
              />
            </div>
          )}

          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Тип:</span>
            <div className={styles.segmentedControl}>
              {(['grommet', 'fastex'] as StrapType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`${styles.segBtn} ${extras.straps.type === t ? styles.segBtnActive : ''}`}
                  disabled={isReadOnly}
                  onClick={() => patch({ straps: { ...extras.straps, type: t } })}
                >
                  {t === 'grommet' ? 'Люверс' : 'Ремешок'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ─── Секция: Молнии ────────────────────────────────────────────────────────
  const addZipper = () => {
    patch({
      zippers: [
        ...extras.zippers,
        {
          id: newId(),
          orientation: 'vertical',
          positionFromStart: 10,
          offsetStart: 0,
          offsetEnd: 0,
          bandLeft: 3,
          bandRight: 3,
        } satisfies ZipperItem,
      ],
    });
  };

  const updateZipper = (id: string, update: Partial<ZipperItem>) => {
    patch({ zippers: extras.zippers.map((z) => (z.id === id ? { ...z, ...update } : z)) });
  };

  const removeZipper = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    patch({ zippers: extras.zippers.filter((z) => z.id !== id) });
  };

  const zippersSection = (
    <div className={styles.accordionItem}>
      {renderSection('zippers', 'Молнии', extras.zippers.length)}
      {openSections.has('zippers') && (
        <div className={styles.accordionBody}>
          {extras.zippers.map((z, idx) => (
            <div key={z.id} className={styles.listCard}>
              <div className={styles.listCardHeader}>
                <span>Молния #{idx + 1}</span>
                {!isReadOnly && (
                  <button type="button" className={styles.removeBtn} onClick={(e) => removeZipper(z.id, e)}>✕</button>
                )}
              </div>

              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Ориентация:</span>
                <div className={styles.segmentedControl}>
                  {(['horizontal', 'vertical'] as ElementOrientation[]).map((o) => (
                    <button key={o} type="button"
                      className={`${styles.segBtn} ${z.orientation === o ? styles.segBtnActive : ''}`}
                      disabled={isReadOnly}
                      onClick={() => updateZipper(z.id, { orientation: o })}
                    >{o === 'horizontal' ? 'Гор.' : 'Верт.'}</button>
                  ))}
                </div>
              </div>

              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>
                  {z.orientation === 'horizontal' ? 'Y от верха (см):' : 'X от края (см):'}
                </label>
                <input type="number" className={styles.numInput} min={0}
                  value={z.positionFromStart} disabled={isReadOnly}
                  onChange={(e) => updateZipper(z.id, { positionFromStart: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>Отступ в начале:</label>
                <input type="number" className={styles.numInput} min={0}
                  value={z.offsetStart} disabled={isReadOnly}
                  onChange={(e) => updateZipper(z.id, { offsetStart: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>Отступ в конце:</label>
                <input type="number" className={styles.numInput} min={0}
                  value={z.offsetEnd} disabled={isReadOnly}
                  onChange={(e) => updateZipper(z.id, { offsetEnd: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>Кант слева (см):</label>
                <input type="number" className={styles.numInput} min={0}
                  value={z.bandLeft} disabled={isReadOnly}
                  onChange={(e) => updateZipper(z.id, { bandLeft: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>Кант справа (см):</label>
                <input type="number" className={styles.numInput} min={0}
                  value={z.bandRight} disabled={isReadOnly}
                  onChange={(e) => updateZipper(z.id, { bandRight: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          ))}

          {!isReadOnly && (
            <button type="button" className={styles.addBtn} onClick={addZipper}>+ Добавить молнию</button>
          )}
        </div>
      )}
    </div>
  );

  // ─── Секция: Разделители ───────────────────────────────────────────────────
  const addDivider = () => {
    patch({
      dividers: [
        ...extras.dividers,
        {
          id: newId(),
          orientation: 'vertical',
          position: 10,
          offsetStart: 0,
          offsetEnd: 0,
          width: 5,
        } satisfies DividerItem,
      ],
    });
  };

  const updateDivider = (id: string, update: Partial<DividerItem>) => {
    patch({ dividers: extras.dividers.map((d) => (d.id === id ? { ...d, ...update } : d)) });
  };

  const removeDivider = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    patch({ dividers: extras.dividers.filter((d) => d.id !== id) });
  };

  const dividersSection = (
    <div className={styles.accordionItem}>
      {renderSection('dividers', 'Разделители', extras.dividers.length)}
      {openSections.has('dividers') && (
        <div className={styles.accordionBody}>
          {extras.dividers.map((d, idx) => (
            <div key={d.id} className={styles.listCard}>
              <div className={styles.listCardHeader}>
                <span>Разделитель #{idx + 1}</span>
                {!isReadOnly && (
                  <button type="button" className={styles.removeBtn} onClick={(e) => removeDivider(d.id, e)}>✕</button>
                )}
              </div>

              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Ориентация:</span>
                <div className={styles.segmentedControl}>
                  {(['horizontal', 'vertical'] as ElementOrientation[]).map((o) => (
                    <button key={o} type="button"
                      className={`${styles.segBtn} ${d.orientation === o ? styles.segBtnActive : ''}`}
                      disabled={isReadOnly}
                      onClick={() => updateDivider(d.id, { orientation: o })}
                    >{o === 'horizontal' ? 'Гор.' : 'Верт.'}</button>
                  ))}
                </div>
              </div>

              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>Позиция (см):</label>
                <input type="number" className={styles.numInput} min={0}
                  value={d.position} disabled={isReadOnly}
                  onChange={(e) => updateDivider(d.id, { position: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>Ширина канта (см):</label>
                <input type="number" className={styles.numInput} min={0.1}
                  value={d.width} disabled={isReadOnly}
                  onChange={(e) => updateDivider(d.id, { width: parseFloat(e.target.value) || 1 })}
                />
              </div>
            </div>
          ))}

          {!isReadOnly && (
            <button type="button" className={styles.addBtn} onClick={addDivider}>+ Добавить разделитель</button>
          )}
        </div>
      )}
    </div>
  );

  // ─── Секция: Вырезы и заплатки ──────────────────────────────────────────────
  const addCutout = (type: 'cut' | 'patch') => {
    const baseCutout = {
      id: newId(),
      type,
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    } satisfies CutoutItem;

    patch({
      cutouts: [
        ...extras.cutouts,
        placeCutoutAtPosition(baseCutout, activeWindow, 'tl'),
      ],
    });
  };

  const updateCutout = (
    id: string,
    update: Partial<CutoutItem>,
    positionOverride?: CutoutPosition,
    offsetOverride?: number,
  ) => {
    patch({
      cutouts: extras.cutouts.map((c) => {
        if (c.id !== id) return c;

        const previousPosition =
          cutoutPositions[id] ?? getCutoutPosition(c, activeWindow);

        const position = positionOverride ?? previousPosition;

        const merged = { ...c, ...update };

        const offset =
          offsetOverride ??
          (position === 'lc' || position === 'rc' ? c.y : c.x);

        return placeCutoutAtPosition(merged, activeWindow, position, offset);
      }),
    });

    if (positionOverride) {
      setCutoutPositions((prev) => ({
        ...prev,
        [id]: positionOverride,
      }));
    }
  };

  const removeCutout = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    patch({ cutouts: extras.cutouts.filter((c) => c.id !== id) });
    setCutoutPositions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const cutoutsSection = (
    <div className={styles.accordionItem}>
      {renderSection('cutouts', 'Вырезы и заплатки', extras.cutouts.length)}
      {openSections.has('cutouts') && (
        <div className={styles.accordionBody}>
          {extras.cutouts.map((c, idx) => {
            const currentPosition = cutoutPositions[c.id] ?? getCutoutPosition(c, activeWindow);

            return (
              <div
                key={c.id}
                className={`${styles.listCard} ${c.type === 'cut' ? styles.listCardCut : styles.listCardPatch
                  }`}
              >
                <div className={styles.listCardHeader}>
                  <span>{c.type === 'cut' ? 'Вырез' : 'Заплатка'} #{idx + 1}</span>
                  {!isReadOnly && (
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={(e) => removeCutout(c.id, e)}
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className={styles.fieldRow}>
                  <span className={styles.fieldLabel}>Тип:</span>
                  <div className={styles.segmentedControl}>
                    {(['cut', 'patch'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`${styles.segBtn} ${c.type === t ? styles.segBtnActive : ''
                          }`}
                        disabled={isReadOnly}
                        onClick={() => updateCutout(c.id, { type: t })}
                      >
                        {t === 'cut' ? 'Вырез' : 'Заплатка'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.positionBlock}>
                  <span className={styles.fieldLabel}>Позиция:</span>
                  <div className={styles.positionGrid}>
                    {CUTOUT_POSITIONS.map((row, rowIdx) => (
                      <div key={rowIdx} className={styles.positionGridRow}>
                        {row.map((cell, cellIdx) => {
                          if (!cell.value) {
                            return (
                              <span
                                key={`empty-${rowIdx}-${cellIdx}`}
                                className={styles.positionGridEmpty}
                              />
                            );
                          }

                          return (
                            <button
                              key={cell.value}
                              type="button"
                              className={`${styles.positionBtn} ${currentPosition === cell.value
                                ? styles.positionBtnActive
                                : ''
                                }`}
                              disabled={isReadOnly}
                              onClick={() => {
                                if (cell.value === null) return;

                                updateCutout(
                                  c.id,
                                  {},
                                  cell.value,
                                  getDefaultCutoutOffsetForPosition(c, activeWindow, cell.value),
                                );
                              }}
                            >
                              {cell.label}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>Смещение (см):</label>
                  <input
                    type="number"
                    className={styles.numInput}
                    min={0}
                    value={
                      ['tl', 'tr', 'bl', 'br'].includes(currentPosition)
                        ? 0
                        : getCutoutOffset(c, activeWindow)
                    }
                    disabled={isReadOnly}
                    onChange={(e) => {
                      if (['tl', 'tr', 'bl', 'br'].includes(currentPosition)) {
                        updateCutout(c.id, {}, currentPosition, 0);
                        return;
                      }

                      updateCutout(
                        c.id,
                        {},
                        currentPosition,
                        parseFloat(e.target.value) || 0,
                      );
                    }}
                  />
                </div>

                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>Длина (см):</label>
                  <input
                    type="number"
                    className={styles.numInput}
                    min={1}
                    value={c.width}
                    disabled={isReadOnly}
                    onChange={(e) =>
                      updateCutout(
                        c.id,
                        {
                          width: parseFloat(e.target.value) || 1,
                        },
                        currentPosition,
                      )
                    }
                  />
                </div>

                <div className={styles.fieldRow}>
                  <label className={styles.fieldLabel}>Глубина (см):</label>
                  <input
                    type="number"
                    className={styles.numInput}
                    min={1}
                    value={c.height}
                    disabled={isReadOnly}
                    onChange={(e) =>
                      updateCutout(
                        c.id,
                        {
                          height: parseFloat(e.target.value) || 1,
                        },
                        currentPosition,
                      )
                    }
                  />
                </div>
              </div>
            );
          })}

          {!isReadOnly && (
            <div className={styles.addGroup}>
              <button
                type="button"
                className={`${styles.addBtn} ${styles.addBtnCut}`}
                onClick={() => addCutout('cut')}
              >
                + Вырез
              </button>
              <button
                type="button"
                className={`${styles.addBtn} ${styles.addBtnPatch}`}
                onClick={() => addCutout('patch')}
              >
                + Заплатка
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ─── Секция: Техпайка ──────────────────────────────────────────────────────
  const addWelding = () => {
    patch({
      welding: [
        ...extras.welding,
        { id: newId(), orientation: 'horizontal', position: 50 } satisfies WeldingItem,
      ],
    });
  };

  const updateWelding = (id: string, update: Partial<WeldingItem>) => {
    patch({ welding: extras.welding.map((w) => (w.id === id ? { ...w, ...update } : w)) });
  };

  const weldingSection = (
    <div className={styles.accordionItem}>
      {renderSection('welding', 'Техпайка (швы)', extras.welding.length)}
      {openSections.has('welding') && (
        <div className={styles.accordionBody}>
          {extras.welding.map((w, idx) => (
            <div key={w.id} className={styles.listCard}>
              <div className={styles.listCardHeader}>
                <span>Шов #{idx + 1}</span>
                <button type="button" className={styles.removeBtn} onClick={(e) => {
                  e.stopPropagation();
                  patch({ welding: extras.welding.filter(item => item.id !== w.id) });
                }}>✕</button>
              </div>
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>Ориентация:</span>
                <div className={styles.segmentedControl}>
                  {(['horizontal', 'vertical'] as ElementOrientation[]).map((o) => (
                    <button key={o} type="button"
                      className={`${styles.segBtn} ${w.orientation === o ? styles.segBtnActive : ''}`}
                      onClick={() => updateWelding(w.id, { orientation: o })}
                    >{o === 'horizontal' ? 'Гор.' : 'Верт.'}</button>
                  ))}
                </div>
              </div>
              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>Позиция:</label>
                <input type="number" className={styles.numInput} value={w.position}
                  onChange={(e) => updateWelding(w.id, { position: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
          ))}
          <button type="button" className={styles.addBtn} onClick={addWelding}>+ Добавить шов</button>
        </div>
      )}
    </div>
  );

  // ─── Секция: Юбка и утяжелитель ─────────────────────────────────────────────
  const skirtSection = (
    <div className={styles.accordionItem}>
      {renderSection('skirt', 'Юбка и утяжелитель')}
      {openSections.has('skirt') && (
        <div className={styles.accordionBody}>
          <div className={styles.fieldRow}>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={extras.hasSkirt}
                onChange={(e) => patch({ hasSkirt: e.target.checked })} />
              Нижняя юбка
            </label>
          </div>
          {extras.hasSkirt && (
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Ширина юбки (см):</label>
              <input type="number" className={styles.numInput} min={1}
                value={extras.skirtWidth}
                onChange={(e) => patch({ skirtWidth: parseFloat(e.target.value) || 0 })} />
            </div>
          )}
          <div className={styles.fieldRow}>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={extras.hasWeight}
                onChange={(e) => patch({ hasWeight: e.target.checked })} />
              Утяжелитель снизу
            </label>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.layout}>
      <div className={styles.leftPanel}>
        <div className={styles.headerRow}>
          <h2 className={styles.sectionTitle}>Допы</h2>
          <span className={styles.windowName}>{activeWindow.name}</span>
        </div>

        {!validationResult.isValid && (
          <div className={styles.errorBlock}>
            <strong>ОШИБКИ:</strong>
            <ul className={styles.errorList}>
              {validationResult.errors.map((err) => {
                const translateError = (text: string): string => {
                  switch (text) {
                    case 'Skirt is enabled but skirtWidth is missing or zero':
                      return 'Включена юбка, но не задана её ширина';

                    case 'Invalid skirt width':
                      return 'Некорректная ширина юбки';

                    case 'Invalid input values':
                      return 'Некорректные значения параметров';

                    default:
                      return text;
                  }
                };

                return <li key={err}>{translateError(err)}</li>;
              })}
            </ul>
          </div>
        )}

        {collisionWarnings.length > 0 && (
          <div className={styles.warnBlock}>
            <strong>ПРЕДУПРЕЖДЕНИЯ ({collisionWarnings.length}):</strong>
            <ul className={styles.warnList}>
              {collisionWarnings.map((w, i) => {
                const translateWarning = (text: string): string => {
                  switch (text) {
                    case 'Skirt overlaps with bottom fasteners':
                      return 'Юбка пересекается с нижними креплениями';

                    case 'Zipper overlaps with fasteners':
                      return 'Молния пересекается с креплениями';

                    case 'Separator overlaps with fasteners':
                      return 'Разделитель пересекается с креплениями';

                    case 'Cutout overlaps with fasteners':
                      return 'Вырез пересекается с креплениями';

                    case 'Patch overlaps with fasteners':
                      return 'Заплатка пересекается с креплениями';

                    default:
                      return text;
                  }
                };

                return <li key={i}>{translateWarning(w.message)}</li>;
              })}
            </ul>
          </div>
        )}

        <div className={styles.accordion}>
          {strapsSection}
          {zippersSection}
          {dividersSection}
          {cutoutsSection}
          {weldingSection}
          {skirtSection}
        </div>

        <button
          type="button"
          className={styles.saveButton}
          onClick={() => onSave(windows)}
          disabled={isReadOnly || !validationResult.isValid}
        >
          СОХРАНИТЬ ДОПЫ
        </button>
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.tabsRow}>
          {windows.map((w) => (
            <div
              key={w.id}
              className={`${styles.tabItem} ${activeWindowId === w.id ? styles.tabItemActive : ''}`}
              onClick={() => onActiveWindowChange(w.id)}
            >
              {w.name}
            </div>
          ))}
          <div className={styles.tabItemDisabled} title="Добавление окон недоступно на этом шаге">
            + Окно
          </div>
        </div>

        <div className={styles.canvasWrapper}>
          <DrawingCanvas item={activeWindow} showFasteners showExtras />
        </div>
      </div>
    </div>
  );
}