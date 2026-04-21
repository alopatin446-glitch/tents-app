'use client';

import { useEffect, useState } from 'react';
import styles from './ItemsStep.module.css';
import DrawingCanvas from './DrawingCanvas';

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
  onDraftChange?: (items: WindowItem[]) => void; // Добавили для живого обновления
  clientId?: string;
  isReadOnly?: boolean;
}

export default function ItemsStep({
  windows,
  onSave,
  onDraftChange,
  isReadOnly = false,
}: ItemsStepProps) {
  const [localWindows, setLocalWindows] = useState<WindowItem[]>(windows);
  const [activeWindowId, setActiveWindowId] = useState<number>(
    windows[0]?.id || Date.now()
  );

  useEffect(() => {
    if (windows && windows.length > 0) {
      setLocalWindows(windows);
      if (!activeWindowId) setActiveWindowId(windows[0].id);
    }
  }, [windows]);

  const activeItem =
    localWindows.find((w) => w.id === activeWindowId) || localWindows[0];

  const updateAll = (updated: WindowItem[]) => {
    setLocalWindows(updated);
    onDraftChange?.(updated); // Синхронизируем с page.tsx сразу
  };

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
    updateAll([...localWindows, newWindow]);
    setActiveWindowId(newId);
  };

  const removeWindow = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReadOnly) return;
    if (localWindows.length <= 1) return;
    const updatedWindows = localWindows.filter((win) => win.id !== id);
    updateAll(updatedWindows);
    if (activeWindowId === id) setActiveWindowId(updatedWindows[0].id);
  };

  const handleChange = (id: number, field: keyof WindowItem, value: any) => {
    if (isReadOnly) return;
    const updated = localWindows.map((item) => 
      item.id === id ? { ...item, [field]: value } : item
    );
    updateAll(updated);
  };

  const handleNumberInputChange = (id: number, field: keyof WindowItem, rawValue: string) => {
    if (isReadOnly) return;
    let val = rawValue.replace(',', '.').replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
    handleChange(id, field, val);
  };

  const getNumericItem = (item: WindowItem) => ({
    ...item,
    widthTop: parseFloat(item.widthTop) || 0,
    heightRight: parseFloat(item.heightRight) || 0,
    widthBottom: parseFloat(item.widthBottom) || 0,
    heightLeft: parseFloat(item.heightLeft) || 0,
    kantTop: parseFloat(item.kantTop) || 0,
    kantRight: parseFloat(item.kantRight) || 0,
    kantBottom: parseFloat(item.kantBottom) || 0,
    kantLeft: parseFloat(item.kantLeft) || 0,
    diagonalLeft: parseFloat(item.diagonalLeft) || 0,
    diagonalRight: parseFloat(item.diagonalRight) || 0,
    crossbar: parseFloat(item.crossbar) || 0,
  });

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
          <div className={styles.itemCard} style={{ border: 'none', background: 'none', padding: 0 }}>
            {/* МАТЕРИАЛ */}
            <div className={styles.formSection}>
              <h4>Материал полотна</h4>
              <div className={styles.inputGroup} style={{ position: 'relative' }}>
                <select
                  className={styles.selectInput}
                  value={activeItem.material}
                  onChange={(e) => handleChange(activeItem.id, 'material', e.target.value)}
                  disabled={isReadOnly}
                >
                  <option value="ПВХ 700 мкм (Прозрачная)">ПВХ Прозрачная</option>
                  <option value="ПВХ 700 мкм (Тонированная)">ПВХ Тонированная</option>
                  <option value="ТПУ Полиуретан">ТПУ Полиуретан</option>
                  <option value="Москитная сетка">Москитная сетка</option>
                </select>
                <div className={styles.selectArrow}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
              </div>
            </div>

            {/* ГЕОМЕТРИЯ */}
            <div className={styles.formSection}>
              <h4>Геометрия (см)</h4>
              <div className={styles.geometryGrid}>
                {[
                  { label: 'Верх', field: 'widthTop' },
                  { label: 'Право', field: 'heightRight' },
                  { label: 'Низ', field: 'widthBottom' },
                  { label: 'Лево', field: 'heightLeft' }
                ].map((input) => (
                  <div key={input.field} className={styles.inputGroup}>
                    <label>{input.label}</label>
                    <input
                      type="text"
                      value={activeItem[input.field as keyof WindowItem]}
                      onChange={(e) => handleNumberInputChange(activeItem.id, input.field as any, e.target.value)}
                      disabled={isReadOnly}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* КАНТ */}
            <div className={styles.formSection}>
              <h4>Кант (см)</h4>
              <div className={styles.geometryGrid}>
                {['Top', 'Right', 'Bottom', 'Left'].map((dir) => (
                  <div key={dir} className={styles.inputGroup}>
                    <label>{dir === 'Top' ? 'Верх' : dir === 'Right' ? 'Право' : dir === 'Bottom' ? 'Низ' : 'Лево'}</label>
                    <input
                      type="text"
                      value={activeItem[`kant${dir}` as keyof WindowItem]}
                      onChange={(e) => handleNumberInputChange(activeItem.id, `kant${dir}` as any, e.target.value)}
                      disabled={isReadOnly}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* ЦВЕТ КАНТА */}
            <div className={styles.formSection} style={{ marginBottom: '20px' }}>
              <h4>Цвет канта</h4>
              <div className={styles.inputGroup} style={{ position: 'relative' }}>
                <select
                  className={styles.selectInput}
                  value={activeItem.kantColor}
                  onChange={(e) => handleChange(activeItem.id, 'kantColor', e.target.value)}
                  disabled={isReadOnly}
                >
                  {['Белый', 'Светло-серый', 'Серый', 'Графит', 'Черный', 'Коричневый', 'Бежевый', 'Синий'].map(color => (
                    <option key={color} value={color}>{color}</option>
                  ))}
                </select>
                <div className={styles.selectArrow}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
              </div>
            </div>

            {/* ТРАПЕЦИЯ */}
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
                    <input
                      type="text"
                      value={activeItem.diagonalRight === 0 ? '' : activeItem.diagonalRight}
                      placeholder="0"
                      onChange={(e) => handleNumberInputChange(activeItem.id, 'diagonalRight', e.target.value)}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>ДИАГОНАЛЬ B-D (см)</label>
                    <input
                      type="text"
                      value={activeItem.diagonalLeft === 0 ? '' : activeItem.diagonalLeft}
                      placeholder="0"
                      onChange={(e) => handleNumberInputChange(activeItem.id, 'diagonalLeft', e.target.value)}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>ПАРАЛЛЕЛЬ (см)</label>
                    <input
                      type="text"
                      value={activeItem.crossbar === 0 ? '' : activeItem.crossbar}
                      placeholder="0"
                      onChange={(e) => handleNumberInputChange(activeItem.id, 'crossbar', e.target.value)}
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
            onClick={() => onSave(localWindows)}
            style={{ marginTop: 'auto' }}
          >
            СОХРАНИТЬ ВСЕ ИЗДЕЛИЯ
          </button>
        )}
      </div>

      <div className={styles.rightColumn}>
        <div className={styles.tabsRow}>
          {localWindows.map((win, index) => (
            <div
              key={win.id}
              className={`${styles.tabItem} ${activeWindowId === win.id ? styles.activeTab : ''}`}
              onClick={() => setActiveWindowId(win.id)}
            >
              Окно {index + 1}
              {!isReadOnly && localWindows.length > 1 && (
                <span className={styles.closeTab} onClick={(e) => removeWindow(win.id, e)}>×</span>
              )}
            </div>
          ))}
          {!isReadOnly && <button className={styles.addTabButton} onClick={addWindow}>+</button>}
        </div>

        {activeItem && (
          <>
            <div className={styles.drawingWrapper}>
              <DrawingCanvas item={getNumericItem(activeItem)} />
            </div>
            <div className={styles.bottomInfoBar}>
              <div className={styles.statLabel}>Выбрано: <span>{activeItem.name}</span></div>
              <div className={styles.statLabel}>
                Площадь: <span>{((parseFloat(activeItem.widthTop || 0) * parseFloat(activeItem.heightLeft || 0)) / 10000).toFixed(2)} м²</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}