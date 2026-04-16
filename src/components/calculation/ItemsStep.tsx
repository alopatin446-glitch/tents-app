'use client';

import { useEffect, useState } from 'react';
import styles from './ItemsStep.module.css';

interface WindowItem {
  id: number;
  name: string;
  width: number;
  height: number;
  material: string;
  kantColor: string;
  fastenerType: string;
  fastenerStep: number;
}

interface ItemsStepProps {
  windows: WindowItem[];
  onSave: (items: WindowItem[]) => void;
}

export default function ItemsStep({ windows, onSave }: ItemsStepProps) {
  const [localWindows, setLocalWindows] = useState<WindowItem[]>(windows);

  useEffect(() => {
    setLocalWindows(windows);
  }, [windows]);

  const handleChange = (
    id: number,
    field: keyof WindowItem,
    value: string | number
  ) => {
    setLocalWindows((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  };

  return (
    <div className={styles.itemsGrid}>
      <div className={styles.leftColumn}>
        <h2 className={styles.sectionTitle}>Изделия</h2>

        <div className={styles.itemsList}>
          {localWindows.map((item) => (
            <div key={item.id} className={styles.itemCard}>
              <div className={styles.itemHeader}>
                <h3 className={styles.itemTitle}>{item.name}</h3>
                <span className={styles.itemBadge}>ID: {item.id}</span>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.inputGroup}>
                  <label>Название</label>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) =>
                      handleChange(item.id, 'name', e.target.value)
                    }
                    className={styles.neonInput}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Ширина</label>
                  <input
                    type="number"
                    value={item.width}
                    onChange={(e) =>
                      handleChange(item.id, 'width', Number(e.target.value))
                    }
                    className={styles.neonInput}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Высота</label>
                  <input
                    type="number"
                    value={item.height}
                    onChange={(e) =>
                      handleChange(item.id, 'height', Number(e.target.value))
                    }
                    className={styles.neonInput}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Материал</label>
                  <input
                    type="text"
                    value={item.material}
                    onChange={(e) =>
                      handleChange(item.id, 'material', e.target.value)
                    }
                    className={styles.neonInput}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Цвет канта</label>
                  <input
                    type="text"
                    value={item.kantColor}
                    onChange={(e) =>
                      handleChange(item.id, 'kantColor', e.target.value)
                    }
                    className={styles.neonInput}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Тип крепежа</label>
                  <input
                    type="text"
                    value={item.fastenerType}
                    onChange={(e) =>
                      handleChange(item.id, 'fastenerType', e.target.value)
                    }
                    className={styles.neonInput}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Шаг крепежа</label>
                  <input
                    type="number"
                    value={item.fastenerStep}
                    onChange={(e) =>
                      handleChange(
                        item.id,
                        'fastenerStep',
                        Number(e.target.value)
                      )
                    }
                    className={styles.neonInput}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          className={styles.saveButton}
          onClick={() => onSave(localWindows)}
        >
          СОХРАНИТЬ ИЗДЕЛИЯ
        </button>
      </div>

      <div className={styles.rightColumn}>
        <div className={styles.infoCard}>
          <h3>Сводка</h3>
          <p>Количество изделий: {localWindows.length}</p>
        </div>

        <div className={styles.infoCard}>
          <h3>Статус</h3>
          <p>Изменения будут применены только после нажатия кнопки сохранения.</p>
        </div>
      </div>
    </div>
  );
}