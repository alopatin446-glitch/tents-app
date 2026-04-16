'use client';

import { useState } from 'react';
import styles from './calculation.module.css';
import ClientStep from '@/components/calculation/ClientStep';

// Мы сохраняем структуру заказа, чтобы ничего не упало
const initialWindow = (id: number) => ({
  id,
  name: `Окно ${id}`,
  width: 200,
  height: 200,
  material: 'ПВХ 700 мкм (Прозрачная)',
  kantColor: 'Коричневый',
  fastenerType: 'Поворотная скоба',
  fastenerStep: 40,
});

export default function NewCalculation() {
  const [activeTab, setActiveTab] = useState('Клиент');
  
  // СОСТОЯНИЕ КЛИЕНТА (Родительский мозг)
  const [clientData, setClientData] = useState({
    fio: '',
    phone: '',
    address: '',
    source: '',
    comment: '',
    status: 'Новый',
  });

  const [windows, setWindows] = useState([initialWindow(1)]);

  const menuItems = [
    'Клиент', 'Изделия', 'Крепежи', 'Дополнения', 
    'Каркас', 'Расчёт', 'Цены', 'Для производства'
  ];

  // ТОТ САМЫЙ ВЫКЛЮЧАТЕЛЬ
  const handleSaveClient = (updatedData: any) => {
    setClientData(updatedData);
    console.log("ДАННЫЕ КЛИЕНТА ЗАФИКСИРОВАНЫ. Запускаю общий алгоритм...");
    // Здесь позже будет вызов глобальной функции расчета
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
        {/* РАЗДЕЛ: КЛИЕНТ (ПОДКЛЮЧАЕМ МОДУЛЬ) */}
        {activeTab === 'Клиент' && (
          <ClientStep 
            initialData={clientData} 
            onSave={handleSaveClient} 
          />
        )}

        {/* ЗАГЛУШКИ ДЛЯ ОСТАЛЬНЫХ (ЧТОБЫ НЕ ПУСТОТА) */}
        {activeTab !== 'Клиент' && (
          <div className={styles.placeholder}>
            <h2>Раздел "{activeTab}"</h2>
            <p>В процессе переноса в модульную систему...</p>
          </div>
        )}
      </section>
    </main>
  );
}