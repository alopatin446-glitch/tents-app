'use client';

import { useEffect, useState } from 'react';
import styles from './ItemsStep.module.css';
import DrawingCanvas from './DrawingCanvas';

type NumericFieldValue = number | string;

export interface WindowItem {
  id: number;
  name: string;
  widthTop: NumericFieldValue;
  heightRight: NumericFieldValue;
  widthBottom: NumericFieldValue;
  heightLeft: NumericFieldValue;
  kantTop: NumericFieldValue;
  kantRight: NumericFieldValue;
  kantBottom: NumericFieldValue;
  kantLeft: NumericFieldValue;
  kantColor: string;
  material: string;
  isTrapezoid: boolean;
  diagonalLeft: NumericFieldValue;
  diagonalRight: NumericFieldValue;
  crossbar: NumericFieldValue;
}

interface ItemsStepProps {
  windows: WindowItem[];
  onSave: (items: WindowItem[]) => void;
  clientId?: string;
  isReadOnly?: boolean;
}

export default function ItemsStep({
  windows,
  onSave,
  clientId,
  isReadOnly = false,
}: ItemsStepProps) {
  const [localWindows, setLocalWindows] = useState<WindowItem[]>(windows);
  const [activeWindowId, setActiveWindowId] = useState<number>(
    windows[0]?.id || Date.now()
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (windows && windows.length > 0) {
      setLocalWindows(windows);

      if (!activeWindowId) {
        setActiveWindowId(windows[0].id);
      }
    }
  }, [windows, activeWindowId]);

  const activeItem =
    localWindows.find((w) => w.id === activeWindowId) || localWindows[0];

  const addWindow = () => {
    if (isReadOnly) return;

    const newId = Date.now();

    const newWindow: WindowItem = {
      id: newId,
      name: `Окно ${localWindows.length + 1}`,
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

    setLocalWindows((prev) => [...prev, newWindow]);
    setActiveWindowId(newId);
  };

  const removeWindow = (id: number, e: React.MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation();

    if (isReadOnly) return;
    if (localWindows.length <= 1) return;

    const updatedWindows = localWindows.filter((win) => win.id !== id);
    setLocalWindows(updatedWindows);

    if (activeWindowId === id && updatedWindows.length > 0) {
      setActiveWindowId(updatedWindows[0].id);
    }
  };

  const handleChange = (
    id: number,
    field: keyof WindowItem,
    value: string | number | boolean
  ) => {
    if (isReadOnly) return;

    setLocalWindows((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleNumberInputChange = (
    id: number,
    field: keyof WindowItem,
    rawValue: string
  ) => {
    if (isReadOnly) return;

    let val = rawValue.replace(',', '.');
    val = val.replace(/[^0-9.]/g, '');

    const parts = val.split('.');
    if (parts.length > 2) {
      val = parts[0] + '.' + parts.slice(1).join('');
    }

    handleChange(id, field, val);
  };

  const getNumericItem = (item: WindowItem): WindowItem => ({
    ...item,
    widthTop: parseFloat(String(item.widthTop)) || 0,
    heightRight: parseFloat(String(item.heightRight)) || 0,
    widthBottom: parseFloat(String(item.widthBottom)) || 0,
    heightLeft: parseFloat(String(item.heightLeft)) || 0,
    kantTop: parseFloat(String(item.kantTop)) || 0,
    kantRight: parseFloat(String(item.kantRight)) || 0,
    kantBottom: parseFloat(String(item.kantBottom)) || 0,
    kantLeft: parseFloat(String(item.kantLeft)) || 0,
    diagonalLeft: parseFloat(String(item.diagonalLeft)) || 0,
    diagonalRight: parseFloat(String(item.diagonalRight)) || 0,
    crossbar: parseFloat(String(item.crossbar)) || 0,
  });

  const handleFinalSave = async () => {
    if (isReadOnly) return;

    setIsSaving(true);

    try {
      const numericItems = localWindows.map(getNumericItem);
      onSave(numericItems);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.itemsGrid}>
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
          <div
            className={styles.itemCard}
            style={{ border: 'none', background: 'none', padding: 0 }}
          >
            <div className={styles.formSection}>
              <h4>Материал полотна</h4>
              <div className={styles.inputGroup} style={{ position: 'relative' }}>
                <select
                  className={styles.selectInput}
                  value={activeItem.material}
                  onChange={(e) =>
                    handleChange(activeItem.id, 'material', e.target.value)
                  }
                  disabled={isReadOnly}
                >
                  <option value="ПВХ 700 мкм (Прозрачная)">ПВХ Прозрачная</option>
                  <option value="ПВХ 700 мкм (Тонированная)">
                    ПВХ Тонированная
                  </option>
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
                    value={activeItem.widthTop}
                    onChange={(e) =>
                      handleNumberInputChange(
                        activeItem.id,
                        'widthTop',
                        e.target.value
                      )
                    }
                    disabled={isReadOnly}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Право</label>
                  <input
                    type="text"
                    value={activeItem.heightRight}
                    onChange={(e) =>
                      handleNumberInputChange(
                        activeItem.id,
                        'heightRight',
                        e.target.value
                      )
                    }
                    disabled={isReadOnly}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Низ</label>
                  <input
                    type="text"
                    value={activeItem.widthBottom}
                    onChange={(e) =>
                      handleNumberInputChange(
                        activeItem.id,
                        'widthBottom',
                        e.target.value
                      )
                    }
                    disabled={isReadOnly}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Лево</label>
                  <input
                    type="text"
                    value={activeItem.heightLeft}
                    onChange={(e) =>
                      handleNumberInputChange(
                        activeItem.id,
                        'heightLeft',
                        e.target.value
                      )
                    }
                    disabled={isReadOnly}
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
                    value={activeItem.kantTop}
                    onChange={(e) =>
                      handleNumberInputChange(
                        activeItem.id,
                        'kantTop',
                        e.target.value
                      )
                    }
                    disabled={isReadOnly}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Право</label>
                  <input
                    type="text"
                    value={activeItem.kantRight}
                    onChange={(e) =>
                      handleNumberInputChange(
                        activeItem.id,
                        'kantRight',
                        e.target.value
                      )
                    }
                    disabled={isReadOnly}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Низ</label>
                  <input
                    type="text"
                    value={activeItem.kantBottom}
                    onChange={(e) =>
                      handleNumberInputChange(
                        activeItem.id,
                        'kantBottom',
                        e.target.value
                      )
                    }
                    disabled={isReadOnly}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Лево</label>
                  <input
                    type="text"
                    value={activeItem.kantLeft}
                    onChange={(e) =>
                      handleNumberInputChange(
                        activeItem.id,
                        'kantLeft',
                        e.target.value
                      )
                    }
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            </div>

            <div className={styles.formSection} style={{ marginBottom: '20px' }}>
              <h4>Цвет канта</h4>
              <div className={styles.inputGroup} style={{ position: 'relative' }}>
                <select
                  className={styles.selectInput}
                  value={activeItem.kantColor}
                  onChange={(e) =>
                    handleChange(activeItem.id, 'kantColor', e.target.value)
                  }
                  disabled={isReadOnly}
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
                  checked={activeItem.isTrapezoid}
                  onChange={(e) =>
                    handleChange(activeItem.id, 'isTrapezoid', e.target.checked)
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
                      value={
                        Number(activeItem.diagonalRight) === 0
                          ? ''
                          : activeItem.diagonalRight
                      }
                      placeholder="0"
                      onChange={(e) =>
                        handleNumberInputChange(
                          activeItem.id,
                          'diagonalRight',
                          e.target.value
                        )
                      }
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>ДИАГОНАЛЬ B-D (см)</label>
                    <input
                      type="text"
                      value={
                        Number(activeItem.diagonalLeft) === 0
                          ? ''
                          : activeItem.diagonalLeft
                      }
                      placeholder="0"
                      onChange={(e) =>
                        handleNumberInputChange(
                          activeItem.id,
                          'diagonalLeft',
                          e.target.value
                        )
                      }
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>ПАРАЛЛЕЛЬ (см)</label>
                    <input
                      type="text"
                      value={Number(activeItem.crossbar) === 0 ? '' : activeItem.crossbar}
                      placeholder="0"
                      onChange={(e) =>
                        handleNumberInputChange(
                          activeItem.id,
                          'crossbar',
                          e.target.value
                        )
                      }
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!isReadOnly && (
          <button
            className={styles.saveButton}
            onClick={handleFinalSave}
            disabled={isSaving}
            style={{ marginTop: 'auto' }}
          >
            {isSaving ? 'СОХРАНЕНИЕ...' : 'СОХРАНИТЬ ВСЕ ИЗДЕЛИЯ'}
          </button>
        )}
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
              {!isReadOnly && localWindows.length > 1 && (
                <span
                  className={styles.closeTab}
                  onClick={(e) => removeWindow(win.id, e)}
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
                Площадь:{' '}
                <span>
                  {(
                    (parseFloat(String(activeItem.widthTop || 0)) *
                      parseFloat(String(activeItem.heightLeft || 0))) /
                    10000
                  ).toFixed(2)}{' '}
                  м²
                </span>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}