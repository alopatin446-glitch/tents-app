'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './ItemsStep.module.css';
import DrawingCanvas from './DrawingCanvas';
import { updateClientAction } from '@/app/dashboard/clients/actions';

export interface WindowItem {
  id: number;
  name: string;
  widthTop: any;
  heightRight: any;
  widthBottom: any;
  heightLeft: any;
  kantTop: any;
  kantRight: any;
  kantBottom: any;
  kantLeft: any;
  kantColor: string;
  material: string;
  isTrapezoid: boolean;
  diagonalLeft: any;
  diagonalRight: any;
  crossbar: any;
}

interface ItemsStepProps {
  windows: WindowItem[];
  onSave: (items: WindowItem[]) => void;
  clientId?: string;
}

const DEFAULT_WINDOW_VALUES = {
  widthTop: '200',
  heightRight: '200',
  widthBottom: '200',
  heightLeft: '200',
  kantTop: '5',
  kantRight: '5',
  kantBottom: '5',
  kantLeft: '5',
  kantColor: 'Коричневый',
  material: 'ПВХ 700 мкм (Прозрачная)',
  isTrapezoid: false,
  diagonalLeft: '0',
  diagonalRight: '0',
  crossbar: '0',
};

function toInputString(value: unknown, fallback = ''): string {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function toNumberValue(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0;

  const normalized =
    typeof value === 'string' ? value.replace(',', '.').trim() : value;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeWindowForForm(item: Partial<WindowItem> | null | undefined, index: number): WindowItem {
  return {
    id: Number(item?.id) || Date.now() + index,
    name: item?.name ? String(item.name) : `Окно ${index + 1}`,

    widthTop: toInputString(item?.widthTop, DEFAULT_WINDOW_VALUES.widthTop),
    heightRight: toInputString(item?.heightRight, DEFAULT_WINDOW_VALUES.heightRight),
    widthBottom: toInputString(item?.widthBottom, DEFAULT_WINDOW_VALUES.widthBottom),
    heightLeft: toInputString(item?.heightLeft, DEFAULT_WINDOW_VALUES.heightLeft),

    kantTop: toInputString(item?.kantTop, DEFAULT_WINDOW_VALUES.kantTop),
    kantRight: toInputString(item?.kantRight, DEFAULT_WINDOW_VALUES.kantRight),
    kantBottom: toInputString(item?.kantBottom, DEFAULT_WINDOW_VALUES.kantBottom),
    kantLeft: toInputString(item?.kantLeft, DEFAULT_WINDOW_VALUES.kantLeft),

    kantColor: item?.kantColor ? String(item.kantColor) : DEFAULT_WINDOW_VALUES.kantColor,
    material: item?.material ? String(item.material) : DEFAULT_WINDOW_VALUES.material,

    isTrapezoid: Boolean(item?.isTrapezoid),

    diagonalLeft: toInputString(item?.diagonalLeft, DEFAULT_WINDOW_VALUES.diagonalLeft),
    diagonalRight: toInputString(item?.diagonalRight, DEFAULT_WINDOW_VALUES.diagonalRight),
    crossbar: toInputString(item?.crossbar, DEFAULT_WINDOW_VALUES.crossbar),
  };
}

function createNewWindow(nextIndex: number): WindowItem {
  return {
    id: Date.now(),
    name: `Окно ${nextIndex}`,
    ...DEFAULT_WINDOW_VALUES,
  };
}

export default function ItemsStep({ windows, onSave, clientId }: ItemsStepProps) {
  const [localWindows, setLocalWindows] = useState<WindowItem[]>(
    Array.isArray(windows) && windows.length > 0
      ? windows.map((item, index) => normalizeWindowForForm(item, index))
      : [createNewWindow(1)]
  );

  const [activeWindowId, setActiveWindowId] = useState<number>(
    Array.isArray(windows) && windows.length > 0
      ? Number(windows[0]?.id) || Date.now()
      : Date.now()
  );

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!Array.isArray(windows) || windows.length === 0) {
      const fallbackWindow = createNewWindow(1);
      setLocalWindows([fallbackWindow]);
      setActiveWindowId(fallbackWindow.id);
      return;
    }

    const normalizedWindows = windows.map((item, index) =>
      normalizeWindowForForm(item, index)
    );

    setLocalWindows(normalizedWindows);

    const hasActiveWindow = normalizedWindows.some((item) => item.id === activeWindowId);
    if (!hasActiveWindow) {
      setActiveWindowId(normalizedWindows[0].id);
    }
  }, [windows, activeWindowId]);

  const activeItem = useMemo(
    () => localWindows.find((w) => w.id === activeWindowId) || localWindows[0],
    [localWindows, activeWindowId]
  );

  const addWindow = () => {
    const newWindow = createNewWindow(localWindows.length + 1);
    setLocalWindows((prev) => [...prev, newWindow]);
    setActiveWindowId(newWindow.id);
  };

  const removeWindow = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (localWindows.length <= 1) return;

    const updatedWindows = localWindows.filter((win) => win.id !== id);
    setLocalWindows(updatedWindows);

    if (activeWindowId === id && updatedWindows.length > 0) {
      setActiveWindowId(updatedWindows[0].id);
    }
  };

  const handleChange = (id: number, field: keyof WindowItem, value: any) => {
    setLocalWindows((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleNumberInputChange = (
    id: number,
    field: keyof WindowItem,
    rawValue: string
  ) => {
    let nextValue = rawValue.replace(/,/g, '.');
    nextValue = nextValue.replace(/[^0-9.]/g, '');

    const parts = nextValue.split('.');
    if (parts.length > 2) {
      nextValue = `${parts[0]}.${parts.slice(1).join('')}`;
    }

    handleChange(id, field, nextValue);
  };

  const getNumericItem = (item: WindowItem): WindowItem => ({
    id: Number(item.id) || 0,
    name: item.name ? String(item.name) : '',

    widthTop: toNumberValue(item.widthTop),
    heightRight: toNumberValue(item.heightRight),
    widthBottom: toNumberValue(item.widthBottom),
    heightLeft: toNumberValue(item.heightLeft),

    kantTop: toNumberValue(item.kantTop),
    kantRight: toNumberValue(item.kantRight),
    kantBottom: toNumberValue(item.kantBottom),
    kantLeft: toNumberValue(item.kantLeft),

    kantColor: item.kantColor ? String(item.kantColor) : '',
    material: item.material ? String(item.material) : '',

    isTrapezoid: Boolean(item.isTrapezoid),

    diagonalLeft: toNumberValue(item.diagonalLeft),
    diagonalRight: toNumberValue(item.diagonalRight),
    crossbar: toNumberValue(item.crossbar),
  });

  const handleFinalSave = async () => {
    setIsSaving(true);

    try {
      const numericItems = localWindows.map(getNumericItem);

      onSave(numericItems);

      if (clientId) {
        const result = await updateClientAction(clientId, {
          items: numericItems,
        });

        if (!result.success) {
          throw new Error(result.error || 'Ошибка при сохранении в базу');
        }

        alert('Все изделия успешно сохранены в базу');
      } else {
        console.log('Изделия сохранены локально:', numericItems);
      }
    } catch (err) {
      console.error('Ошибка сохранения изделий:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const activeItemArea =
    activeItem != null
      ? (
          (toNumberValue(activeItem.widthTop) * toNumberValue(activeItem.heightLeft)) /
          10000
        ).toFixed(2)
      : '0.00';

  return (
    <div className={styles.itemsGrid}>
      <div className={styles.inputPanelWrapper}>
        <div className={styles.headerRow}>
          <h2 className={styles.sectionTitle}>ПАРАМЕТРЫ</h2>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>
            {activeItem?.name}
          </span>
        </div>

        {activeItem && (
          <div
            className={styles.itemCard}
            style={{ border: 'none', background: 'none', padding: 0 }}
          >
            <div className={styles.formSection}>
              <h4>Материал полотна</h4>
              <div className={styles.inputGroup} style={{ position: 'relative' }}>
                <select
                  className={styles.selectInput}
                  value={activeItem.material || ''}
                  onChange={(e) => handleChange(activeItem.id, 'material', e.target.value)}
                >
                  <option value="ПВХ 700 мкм (Прозрачная)">ПВХ Прозрачная</option>
                  <option value="ПВХ 700 мкм (Тонированная)">ПВХ Тонированная</option>
                  <option value="ТПУ Полиуретан">ТПУ Полиуретан</option>
                  <option value="Москитная сетка">Москитная сетка</option>
                </select>
                <div className={styles.selectArrow}>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
            </div>

            <div className={styles.formSection}>
              <h4>Геометрия (см)</h4>
              <div className={styles.geometryGrid}>
                <div className={styles.inputGroup}>
                  <label>Верх</label>
                  <input
                    type="text"
                    value={activeItem.widthTop ?? ''}
                    onChange={(e) =>
                      handleNumberInputChange(activeItem.id, 'widthTop', e.target.value)
                    }
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Право</label>
                  <input
                    type="text"
                    value={activeItem.heightRight ?? ''}
                    onChange={(e) =>
                      handleNumberInputChange(activeItem.id, 'heightRight', e.target.value)
                    }
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Низ</label>
                  <input
                    type="text"
                    value={activeItem.widthBottom ?? ''}
                    onChange={(e) =>
                      handleNumberInputChange(activeItem.id, 'widthBottom', e.target.value)
                    }
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Лево</label>
                  <input
                    type="text"
                    value={activeItem.heightLeft ?? ''}
                    onChange={(e) =>
                      handleNumberInputChange(activeItem.id, 'heightLeft', e.target.value)
                    }
                  />
                </div>
              </div>
            </div>

            <div className={styles.formSection}>
              <h4>Кант (см)</h4>
              <div className={styles.geometryGrid}>
                <div className={styles.inputGroup}>
                  <label>Верх</label>
                  <input
                    type="text"
                    value={activeItem.kantTop ?? ''}
                    onChange={(e) =>
                      handleNumberInputChange(activeItem.id, 'kantTop', e.target.value)
                    }
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Право</label>
                  <input
                    type="text"
                    value={activeItem.kantRight ?? ''}
                    onChange={(e) =>
                      handleNumberInputChange(activeItem.id, 'kantRight', e.target.value)
                    }
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Низ</label>
                  <input
                    type="text"
                    value={activeItem.kantBottom ?? ''}
                    onChange={(e) =>
                      handleNumberInputChange(activeItem.id, 'kantBottom', e.target.value)
                    }
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Лево</label>
                  <input
                    type="text"
                    value={activeItem.kantLeft ?? ''}
                    onChange={(e) =>
                      handleNumberInputChange(activeItem.id, 'kantLeft', e.target.value)
                    }
                  />
                </div>
              </div>
            </div>

            <div className={styles.formSection} style={{ marginBottom: '20px' }}>
              <h4>Цвет канта</h4>
              <div className={styles.inputGroup} style={{ position: 'relative' }}>
                <select
                  className={styles.selectInput}
                  value={activeItem.kantColor || ''}
                  onChange={(e) => handleChange(activeItem.id, 'kantColor', e.target.value)}
                >
                  <option value="Белый">Белый</option>
                  <option value="Светло-серый">Светло-серый</option>
                  <option value="Серый">Серый</option>
                  <option value="Графит">Графит</option>
                  <option value="Черный">Черный</option>
                  <option value="Коричневый">Коричневый</option>
                  <option value="Бежевый">Бежевый</option>
                  <option value="Синий">Синий</option>
                </select>

                <div className={styles.selectArrow}>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
            </div>

            <div className={styles.formSection}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={Boolean(activeItem.isTrapezoid)}
                  onChange={(e) =>
                    handleChange(activeItem.id, 'isTrapezoid', e.target.checked)
                  }
                />
                Трапеция
              </label>

              {activeItem.isTrapezoid && (
                <div className={styles.trapezoidFields}>
                  <div className={styles.inputGroup}>
                    <label>ДИАГОНАЛЬ A-C (см)</label>
                    <input
                      type="text"
                      value={activeItem.diagonalRight ?? ''}
                      placeholder="0"
                      onChange={(e) =>
                        handleNumberInputChange(
                          activeItem.id,
                          'diagonalRight',
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>ДИАГОНАЛЬ B-D (см)</label>
                    <input
                      type="text"
                      value={activeItem.diagonalLeft ?? ''}
                      placeholder="0"
                      onChange={(e) =>
                        handleNumberInputChange(
                          activeItem.id,
                          'diagonalLeft',
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>ПАРАЛЛЕЛЬ (см)</label>
                    <input
                      type="text"
                      value={activeItem.crossbar ?? ''}
                      placeholder="0"
                      onChange={(e) =>
                        handleNumberInputChange(activeItem.id, 'crossbar', e.target.value)
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <button
          className={styles.saveButton}
          onClick={handleFinalSave}
          disabled={isSaving}
          style={{ marginTop: 'auto' }}
        >
          {isSaving ? 'СОХРАНЕНИЕ...' : 'СОХРАНИТЬ ВСЕ ИЗДЕЛИЯ'}
        </button>
      </div>

      <div className={styles.rightColumn}>
        <div className={styles.tabsRow}>
          {localWindows.map((win, index) => (
            <div
              key={win.id}
              className={`${styles.tabItem} ${
                activeWindowId === win.id ? styles.activeTab : ''
              }`}
              onClick={() => setActiveWindowId(win.id)}
            >
              Окно {index + 1}
              {localWindows.length > 1 && (
                <span
                  className={styles.closeTab}
                  onClick={(e) => removeWindow(win.id, e)}
                >
                  ×
                </span>
              )}
            </div>
          ))}
          <button className={styles.addTabButton} onClick={addWindow}>
            +
          </button>
        </div>

        {activeItem ? (
          <>
            <div className={styles.drawingWrapper}>
              <DrawingCanvas item={getNumericItem(activeItem)} />
            </div>

            <div className={styles.bottomInfoBar}>
              <div className={styles.statLabel}>
                Выбрано: <span>{activeItem.name}</span>
              </div>
              <div className={styles.statLabel}>
                Площадь: <span>{activeItemArea} м²</span>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}