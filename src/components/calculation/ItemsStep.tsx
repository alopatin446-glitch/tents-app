'use client';

import { useEffect, useState } from 'react';
import styles from './ItemsStep.module.css';
import DrawingCanvas from './DrawingCanvas';

// Оставляем интерфейс WindowItem как был, но в стейте разрешим строковые значения для ввода
export interface WindowItem {
  id: number;
  name: string;
  widthTop: any; // Изменил на any, чтобы стейт не ругался на временные строки при вводе
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

  useEffect(() => {
    if (windows && windows.length > 0) {
      setLocalWindows(windows);
    }
  }, [windows]);

  const addWindow = () => {
    const newWindow: WindowItem = {
      id: Date.now(),
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
  };

  const handleChange = (id: number, field: keyof WindowItem, value: any) => {
    setLocalWindows((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // ФУНКЦИЯ-ФИЛЬТР: Самый важный штрих
  const handleNumberInputChange = (id: number, field: keyof WindowItem, rawValue: string) => {
    // 1. Заменяем запятую на точку сразу
    let val = rawValue.replace(',', '.');

    // 2. Разрешаем только цифры и одну точку
    val = val.replace(/[^0-9.]/g, '');

    // 3. Не даем поставить вторую точку
    const parts = val.split('.');
    if (parts.length > 2) {
      val = parts[0] + '.' + parts.slice(1).join('');
    }

    // Обновляем стейт именно СТРОКОЙ, чтобы точка не исчезала
    handleChange(id, field, val);
  };

  // Подготовка данных для чертежа (строки в числа)
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
          <h2 className={styles.sectionTitle}>ИЗДЕЛИЯ</h2>
          <button className={styles.addButton} onClick={addWindow}>+ ДОБАВИТЬ ОКНО</button>
        </div>

        <div className={styles.itemsList}>
          {localWindows.map((item) => (
            <div key={item.id} className={styles.itemCard}>
              <h3 className={styles.itemTitle}>{item.name}</h3>

              <div className={styles.formSection}>
                <h4>Геометрия (см)</h4>
                <div className={styles.geometryGrid}>
                  <div className={styles.inputGroup}><label>Верх</label><input type="text" value={item.widthTop} onChange={(e) => handleNumberInputChange(item.id, 'widthTop', e.target.value)} /></div>
                  <div className={styles.inputGroup}><label>Право</label><input type="text" value={item.heightRight} onChange={(e) => handleNumberInputChange(item.id, 'heightRight', e.target.value)} /></div>
                  <div className={styles.inputGroup}><label>Низ</label><input type="text" value={item.widthBottom} onChange={(e) => handleNumberInputChange(item.id, 'widthBottom', e.target.value)} /></div>
                  <div className={styles.inputGroup}><label>Лево</label><input type="text" value={item.heightLeft} onChange={(e) => handleNumberInputChange(item.id, 'heightLeft', e.target.value)} /></div>
                </div>
              </div>

              <div className={styles.formSection}>
                <h4>Кант (см)</h4>
                <div className={styles.geometryGrid}>
                  <div className={styles.inputGroup}><label>Верх</label><input type="text" value={item.kantTop} onChange={(e) => handleNumberInputChange(item.id, 'kantTop', e.target.value)} /></div>
                  <div className={styles.inputGroup}><label>Право</label><input type="text" value={item.kantRight} onChange={(e) => handleNumberInputChange(item.id, 'kantRight', e.target.value)} /></div>
                  <div className={styles.inputGroup}><label>Низ</label><input type="text" value={item.kantBottom} onChange={(e) => handleNumberInputChange(item.id, 'kantBottom', e.target.value)} /></div>
                  <div className={styles.inputGroup}><label>Лево</label><input type="text" value={item.kantLeft} onChange={(e) => handleNumberInputChange(item.id, 'kantLeft', e.target.value)} /></div>
                </div>
              </div>

              <div className={styles.formSection}>
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" checked={item.isTrapezoid} onChange={(e) => handleChange(item.id, 'isTrapezoid', e.target.checked)} />
                  Трапеция
                </label>

                {item.isTrapezoid && (
                  <div className={styles.trapezoidFields} style={{ backgroundColor: '#242D3E', borderRadius: '8px', padding: '12px', marginTop: '10px' }}>
                    <div className={styles.inputGroup}>
                      <label>ДИАГОНАЛЬ A-C (см)</label>
                      <input
                        type="text"
                        value={item.diagonalRight === 0 ? "" : item.diagonalRight}
                        placeholder="0"
                        onChange={(e) => handleNumberInputChange(item.id, 'diagonalRight', e.target.value)}
                      />
                    </div>
                    <div className={styles.inputGroup}>
                      <label>ДИАГОНАЛЬ B-D (см)</label>
                      <input
                        type="text"
                        value={item.diagonalLeft === 0 ? "" : item.diagonalLeft}
                        placeholder="0"
                        onChange={(e) => handleNumberInputChange(item.id, 'diagonalLeft', e.target.value)}
                      />
                    </div>
                    <div className={styles.inputGroup}>
                      <label>ПАРАЛЛЕЛЬ (см)</label>
                      <input
                        type="text"
                        value={item.crossbar === 0 ? "" : item.crossbar}
                        placeholder="0"
                        onChange={(e) => handleNumberInputChange(item.id, 'crossbar', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <button className={styles.saveButton} onClick={() => onSave(localWindows.map(getNumericItem))}>
          СОХРАНИТЬ ВСЕ ИЗДЕЛИЯ
        </button>
      </div>

      <div className={styles.rightColumn}>
        {localWindows.length > 0 ? (
          <div className={styles.drawingWrapper}>
            <h3 className={styles.previewTitle}>Предпросмотр изделия</h3>
            {/* Передаем на чертеж версию с числами через getNumericItem */}
            <DrawingCanvas item={getNumericItem(localWindows[0])} />
            <div className={styles.quickStats}>
              <p>Выбрано: <strong>{localWindows[0].name}</strong></p>
              <p>Площадь: <strong>{((parseFloat(localWindows[0].widthTop || 0) * parseFloat(localWindows[0].heightRight || 0)) / 10000).toFixed(2)} м²</strong></p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}