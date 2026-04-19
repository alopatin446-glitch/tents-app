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
}

export default function ItemsStep({ windows, onSave }: ItemsStepProps) {
  const [localWindows, setLocalWindows] = useState<WindowItem[]>(windows);
  const [activeWindowId, setActiveWindowId] = useState<number>(windows[0]?.id || Date.now());

  useEffect(() => {
    if (windows && windows.length > 0) {
      setLocalWindows(windows);
      if (!activeWindowId) setActiveWindowId(windows[0].id);
    }
  }, [windows]);

  const activeItem = localWindows.find(w => w.id === activeWindowId) || localWindows[0];

  const addWindow = () => {
    const newId = Date.now();
    const newWindow: WindowItem = {
      id: newId,
      name: `Окно ${localWindows.length + 1}`,
      widthTop: "200",
      heightRight: "200",
      widthBottom: "200",
      heightLeft: "200",
      kantTop: "5",
      kantRight: "5",
      kantBottom: "5",
      kantLeft: "5",
      kantColor: 'Коричневый',
      material: 'ПВХ 700 мкм (Прозрачная)',
      isTrapezoid: false,
      diagonalLeft: "0",
      diagonalRight: "0",
      crossbar: "0",
    };
    setLocalWindows([...localWindows, newWindow]);
    setActiveWindowId(newId);
  };

  const removeWindow = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (localWindows.length <= 1) return;

    const updatedWindows = localWindows.filter(win => win.id !== id);
    setLocalWindows(updatedWindows);

    if (activeWindowId === id) {
      setActiveWindowId(updatedWindows[0].id);
    }
  };

  const handleChange = (id: number, field: keyof WindowItem, value: any) => {
    setLocalWindows((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleNumberInputChange = (id: number, field: keyof WindowItem, rawValue: string) => {
    let val = rawValue.replace(',', '.');
    val = val.replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) {
      val = parts[0] + '.' + parts.slice(1).join('');
    }
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
      {/* ЛЕВАЯ ПАНЕЛЬ: Параметры */}
      <div className={styles.inputPanelWrapper}>
        <div className={styles.headerRow}>
          <h2 className={styles.sectionTitle}>ПАРАМЕТРЫ</h2>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>{activeItem?.name}</span>
        </div>

        {activeItem && (
          <div className={styles.itemCard} style={{ border: 'none', background: 'none', padding: 0 }}>
            <div className={styles.formSection}>
              <h4>Материал полотна</h4>
              <div className={styles.inputGroup} style={{ position: 'relative' }}>
                <select
                  className={styles.selectInput}
                  value={activeItem.material}
                  onChange={(e) => handleChange(activeItem.id, 'material', e.target.value)}
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

            <div className={styles.formSection}>
              <h4>Геометрия (см)</h4>
              <div className={styles.geometryGrid}>
                <div className={styles.inputGroup}><label>Верх</label><input type="text" value={activeItem.widthTop} onChange={(e) => handleNumberInputChange(activeItem.id, 'widthTop', e.target.value)} /></div>
                <div className={styles.inputGroup}><label>Право</label><input type="text" value={activeItem.heightRight} onChange={(e) => handleNumberInputChange(activeItem.id, 'heightRight', e.target.value)} /></div>
                <div className={styles.inputGroup}><label>Низ</label><input type="text" value={activeItem.widthBottom} onChange={(e) => handleNumberInputChange(activeItem.id, 'widthBottom', e.target.value)} /></div>
                <div className={styles.inputGroup}><label>Лево</label><input type="text" value={activeItem.heightLeft} onChange={(e) => handleNumberInputChange(activeItem.id, 'heightLeft', e.target.value)} /></div>
              </div>
            </div>

            <div className={styles.formSection}>
              <h4>Кант (см)</h4>
              <div className={styles.geometryGrid}>
                <div className={styles.inputGroup}><label>Верх</label><input type="text" value={activeItem.kantTop} onChange={(e) => handleNumberInputChange(activeItem.id, 'kantTop', e.target.value)} /></div>
                <div className={styles.inputGroup}><label>Право</label><input type="text" value={activeItem.kantRight} onChange={(e) => handleNumberInputChange(activeItem.id, 'kantRight', e.target.value)} /></div>
                <div className={styles.inputGroup}><label>Низ</label><input type="text" value={activeItem.kantBottom} onChange={(e) => handleNumberInputChange(activeItem.id, 'kantBottom', e.target.value)} /></div>
                <div className={styles.inputGroup}><label>Лево</label><input type="text" value={activeItem.kantLeft} onChange={(e) => handleNumberInputChange(activeItem.id, 'kantLeft', e.target.value)} /></div>
              </div>
            </div>

            <div className={styles.formSection} style={{ marginBottom: '20px' }}>
              <h4>Цвет канта</h4>
              <div className={styles.inputGroup} style={{ position: 'relative' }}>
                <select
                  className={styles.selectInput}
                  value={activeItem.kantColor}
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
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              </div>
            </div>

            <div className={styles.formSection}>
              <label className={styles.checkboxLabel}>
                <input type="checkbox" checked={activeItem.isTrapezoid} onChange={(e) => handleChange(activeItem.id, 'isTrapezoid', e.target.checked)} />
                Трапеция
              </label>

              {activeItem.isTrapezoid && (
                <div className={styles.trapezoidFields}>
                  <div className={styles.inputGroup}>
                    <label>ДИАГОНАЛЬ A-C (см)</label>
                    <input type="text" value={activeItem.diagonalRight === 0 ? "" : activeItem.diagonalRight} placeholder="0" onChange={(e) => handleNumberInputChange(activeItem.id, 'diagonalRight', e.target.value)} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>ДИАГОНАЛЬ B-D (см)</label>
                    <input type="text" value={activeItem.diagonalLeft === 0 ? "" : activeItem.diagonalLeft} placeholder="0" onChange={(e) => handleNumberInputChange(activeItem.id, 'diagonalLeft', e.target.value)} />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>ПАРАЛЛЕЛЬ (см)</label>
                    <input type="text" value={activeItem.crossbar === 0 ? "" : activeItem.crossbar} placeholder="0" onChange={(e) => handleNumberInputChange(activeItem.id, 'crossbar', e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <button className={styles.saveButton} onClick={() => onSave(localWindows.map(getNumericItem))} style={{ marginTop: 'auto' }}>
          СОХРАНИТЬ ВСЕ ИЗДЕЛИЯ
        </button>
      </div>

      {/* ПРАВАЯ ПАНЕЛЬ: Табы и Чертеж */}
      <div className={styles.rightColumn}>
        <div className={styles.tabsRow}>
          {localWindows.map((win, index) => (
            <div 
              key={win.id} 
              className={`${styles.tabItem} ${activeWindowId === win.id ? styles.activeTab : ''}`}
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
          <button className={styles.addTabButton} onClick={addWindow}>+</button>
        </div>

        {activeItem ? (
          <>
            <div className={styles.drawingWrapper}>
              <DrawingCanvas item={getNumericItem(activeItem)} />
            </div>
            
            <div className={styles.bottomInfoBar}>
              <div className={styles.statLabel}>Выбрано: <span>{activeItem.name}</span></div>
              <div className={styles.statLabel}>Площадь: <span>{((parseFloat(activeItem.widthTop || 0) * parseFloat(activeItem.heightLeft || 0)) / 10000).toFixed(2)} м²</span></div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}