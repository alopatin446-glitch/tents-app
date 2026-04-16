'use client';

import { useState } from 'react';
import styles from './calculation.module.css';

// Структура нового окна
const initialWindow = (id: number) => ({
  id,
  name: `Окно ${id}`,
  width: 200,
  height: 200,
  material: 'ПВХ 700 мкм (Прозрачная)',
  kantColor: 'Коричневый'
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

  // Добавление нового окна
  const addWindow = () => {
    const newId = windows.length + 1;
    setWindows(prev => [...prev, initialWindow(newId)]);
    setActiveWindowIndex(windows.length);
  };

  // Универсальное обновление параметров (БЕЗ МУТАЦИИ)
  const updateWindow = (key: string, value: any) => {
    setWindows(prev => prev.map((win, index) => 
      index === activeWindowIndex ? { ...win, [key]: value } : win
    ));
  };

  return (
    <main className={styles.mainContainer}>
      {/* ЛЕВАЯ ПАНЕЛЬ НАВИГАЦИИ */}
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

      {/* ПРАВАЯ ЧАСТЬ - КОНТЕНТ */}
      <section className={styles.contentArea}>
        
        {/* РАЗДЕЛ: КЛИЕНТ */}
        {activeTab === 'Клиент' && (
          <div className={styles.formGrid}>
            <h2 className={styles.sectionTitle}>Данные клиента</h2>
            <div className={styles.inputGroup}><label>ФИО</label><input type="text" placeholder="Иванов Иван Иванович" className={styles.neonInput} /></div>
            <div className={styles.inputGroup}><label>Телефон</label><input type="tel" placeholder="+7 (999) 000-00-00" className={styles.neonInput} /></div>
            <div className={styles.inputGroup}><label>Адрес (Название в поиске)</label><input type="text" placeholder="ул. Ленина, д. 150" className={styles.neonInput} /></div>
            <div className={styles.row}>
              <div className={styles.inputGroup}>
                <label>Откуда узнали</label>
                <select className={styles.neonSelect}>
                  <option>Авито</option><option>Сарафанное радио</option><option>Сайт</option>
                </select>
              </div>
              <div className={styles.inputGroup}>
                <label>Статус заказа</label>
                <select className={styles.neonSelect}>
                  <option>Замер</option><option>Расчет</option><option>Производство</option>
                </select>
              </div>
            </div>
            <div className={styles.inputGroup}><label>Комментарий</label><textarea className={styles.neonTextarea}></textarea></div>
            <div className={styles.photoGrid}>
               <div className={styles.photoBox}><span>+ Фото объекта</span></div>
               <div className={styles.photoBox}><span>+ Фото замера</span></div>
               <div className={styles.photoBox}><span>+ Фото договора</span></div>
            </div>
            <div className={styles.statsCard}>
                <div className={styles.statLine}>Площадь: <span>0 м²</span></div>
                <div className={styles.statLineBold}>Прибыль: <span className={styles.neonText}>0 ₽</span></div>
            </div>
          </div>
        )}

        {/* РАЗДЕЛ: ИЗДЕЛИЯ (КОНСТРУКТОР) */}
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
                <div className={styles.inputGroup}>
                  <label>Ширина (см)</label>
                  <input type="number" value={currentWindow.width} onChange={(e) => updateWindow('width', Number(e.target.value))} className={styles.neonInput} />
                </div>
                <div className={styles.inputGroup}>
                  <label>Высота (см)</label>
                  <input type="number" value={currentWindow.height} onChange={(e) => updateWindow('height', Number(e.target.value))} className={styles.neonInput} />
                </div>
                <div className={styles.inputGroup}>
                  <label>Материал</label>
                  <select className={styles.neonSelect} value={currentWindow.material} onChange={(e) => updateWindow('material', e.target.value)}>
                    <option>ПВХ 700 мкм</option><option>ПВХ 500 мкм</option><option>Полиуретан</option>
                  </select>
                </div>
              </div>

              <div className={styles.visualPanel}>
                <div className={styles.blueprintContainer}>
                  <div 
                    className={styles.windowDrawing}
                    style={{ 
                      ['--draw-width' as any]: `${Math.min(currentWindow.width, 300)}px`, 
                      ['--draw-height' as any]: `${Math.min(currentWindow.height, 300)}px` 
                    }}
                  >
                    <span className={styles.dimW}>{currentWindow.width} см</span>
                    <span className={styles.dimH}>{currentWindow.height} см</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ЗАГЛУШКА ДЛЯ ОСТАЛЬНЫХ ТАБОВ */}
        {!['Клиент', 'Изделия'].includes(activeTab) && (
          <div className={styles.placeholder}>Раздел "{activeTab}" в разработке</div>
        )}
      </section>
    </main>
  );
}