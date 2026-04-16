'use client';

import { useState } from 'react';
import styles from './calculation.module.css';

const initialWindow = (id: number) => ({
  id,
  name: `Окно ${id}`,
  width: 200,
  height: 200,
  material: 'ПВХ 700 мкм (Прозрачная)',
  kantColor: 'Коричневый',
  fastenerType: 'Поворотная скоба', // Тип крепления
  fastenerStep: 40,               // Шаг между креплениями в см
});

export default function NewCalculation() {
  const [activeTab, setActiveTab] = useState('Изделия');
  const [windows, setWindows] = useState([initialWindow(1)]);
  const [activeWindowIndex, setActiveWindowIndex] = useState(0);

  const menuItems = [
    'Клиент', 'Изделия', 'Крепежи', 'Дополнения', 
    'Каркас', 'Расчёт', 'Цены', 'Для производства'
  ];

  const currentWindow = windows[activeWindowIndex];

  const addWindow = () => {
    const newId = windows.length + 1;
    setWindows(prev => [...prev, initialWindow(newId)]);
    setActiveWindowIndex(windows.length);
  };

  const updateWindow = (key: string, value: any) => {
    setWindows(prev => prev.map((win, index) => 
      index === activeWindowIndex ? { ...win, [key]: value } : win
    ));
  };

  return (
    <main className={styles.mainContainer}>
      <aside className={styles.sidebar}>
        <div className={styles.orderBadge}>ЗАКАЗ: НОВЫЙ</div>
        <nav className={styles.navMenu}>
          {menuItems.map((item) => (
            <button
              key={item}
              className={`${styles.navButton} ${activeTab === item ? styles.active : ''}`}
              onClick={() => setActiveTab(item)}
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <section className={styles.contentArea}>
        
        {/* ВКЛАДКА ИЗДЕЛИЯ — ТОЛЬКО ГЕОМЕТРИЯ */}
        {activeTab === 'Изделия' && (
          <div className={styles.calcWrapper}>
            <div className={styles.windowTabs}>
              {windows.map((win, index) => (
                <button
                  key={win.id}
                  className={`${styles.winTab} ${activeWindowIndex === index ? styles.winActive : ''}`}
                  onClick={() => setActiveWindowIndex(index)}
                >
                  {win.name}
                </button>
              ))}
              <button className={styles.addWinBtn} onClick={addWindow}>+ Добавить</button>
            </div>
            <div className={styles.workspace}>
              <div className={styles.paramsPanel}>
                <h2 className={styles.sectionTitle}>Геометрия {currentWindow.name}</h2>
                <div className={styles.inputGroup}><label>Ширина (см)</label>
                  <input type="number" value={currentWindow.width} onChange={(e) => updateWindow('width', Number(e.target.value))} className={styles.neonInput} />
                </div>
                <div className={styles.inputGroup}><label>Высота (см)</label>
                  <input type="number" value={currentWindow.height} onChange={(e) => updateWindow('height', Number(e.target.value))} className={styles.neonInput} />
                </div>
                <div className={styles.inputGroup}><label>Материал</label>
                  <select className={styles.neonSelect} value={currentWindow.material} onChange={(e) => updateWindow('material', e.target.value)}>
                    <option>ПВХ 700 мкм</option><option>ПВХ 500 мкм</option><option>Полиуретан</option>
                  </select>
                </div>
              </div>
              <div className={styles.visualPanel}>
                <div className={styles.blueprintContainer}>
                  <div className={styles.windowDrawing} style={{ ['--draw-width' as any]: `${Math.min(currentWindow.width, 300)}px`, ['--draw-height' as any]: `${Math.min(currentWindow.height, 300)}px` }}>
                    <span className={styles.dimW}>{currentWindow.width} см</span>
                    <span className={styles.dimH}>{currentWindow.height} см</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ВКЛАДКА КРЕПЕЖИ — ОЖИВЛЯЕМ ЕЁ */}
        {activeTab === 'Крепежи' && (
          <div className={styles.formGrid}>
            <h2 className={styles.sectionTitle}>Фурнитура для {currentWindow.name}</h2>
            <div className={styles.inputGroup}>
              <label>Тип крепления (верх/бока)</label>
              <select 
                className={styles.neonSelect} 
                value={currentWindow.fastenerType} 
                onChange={(e) => updateWindow('fastenerType', e.target.value)}
              >
                <option>Поворотная скоба</option>
                <option>Люверс (кольцо)</option>
                <option>Французская скоба</option>
                <option>Ремешок</option>
              </select>
            </div>
            <div className={styles.inputGroup}>
              <label>Шаг крепления (см)</label>
              <input 
                type="range" min="20" max="60" step="5" 
                value={currentWindow.fastenerStep} 
                onChange={(e) => updateWindow('fastenerStep', Number(e.target.value))}
                className={styles.neonInput} 
              />
              <div style={{ textAlign: 'right', color: '#7BFF00', fontSize: '0.9rem' }}>{currentWindow.fastenerStep} см</div>
            </div>
            <div className={styles.statsCard}>
               <p>Расчетное кол-во фурнитуры: <span className={styles.neonText}>
                 {Math.ceil(((currentWindow.width + currentWindow.height) * 2) / currentWindow.fastenerStep)} шт.
               </span></p>
            </div>
          </div>
        )}

        {/* ОСТАЛЬНЫЕ ЗАГЛУШКИ */}
        {!['Клиент', 'Изделия', 'Крепежи'].includes(activeTab) && (
          <div className={styles.placeholder}>Раздел "{activeTab}" в разработке</div>
        )}
      </section>
    </main>
  );
}