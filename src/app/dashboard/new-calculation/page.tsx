'use client';

import { useState } from 'react';
import styles from './calculation.module.css';
import ClientStep from '@/components/calculation/ClientStep';
import ItemsStep from '@/components/calculation/ItemsStep';
import FastenersStep from '@/components/calculation/FastenersStep';
import OrderManagement from '@/components/calculation/OrderManagement';

interface ClientData {
  fio: string;
  phone: string;
  address: string;
  source: string;
  comment: string;
  status: string;
}

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

const initialWindow = (id: number): WindowItem => ({
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

  const [clientData, setClientData] = useState<ClientData>({
    fio: '',
    phone: '',
    address: '',
    source: '',
    comment: '',
    status: 'Новый',
  });

  const [windows, setWindows] = useState<WindowItem[]>([initialWindow(1)]);

  const menuItems = [
    'Клиент',
    'Изделия',
    'Крепежи',
    'Дополнения',
    'Каркас',
    'Расчёт',
    'Цены',
    'Для производства',
  ];

  const handleSaveClient = (updatedData: ClientData) => {
    setClientData(updatedData);
    console.log('ДАННЫЕ КЛИЕНТА ЗАФИКСИРОВАНЫ. Запускаю общий алгоритм...');
  };

  const handleSaveItems = (updatedWindows: WindowItem[]) => {
    setWindows(updatedWindows);
    console.log('ИЗДЕЛИЯ ЗАФИКСИРОВАНЫ. Запускаю общий алгоритм...');
  };

  const handleSaveFasteners = () => {
    console.log('КРЕПЕЖИ ЗАФИКСИРОВАНЫ. Запускаю общий алгоритм...');
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
        {/* ВЕРХНЯЯ ЧАСТЬ: КОНТЕНТ ВКЛАДОК */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px' }}>
          {activeTab === 'Клиент' && (
            <ClientStep
              initialData={clientData}
              onSave={handleSaveClient}
            />
          )}

          {activeTab === 'Изделия' && (
            <ItemsStep
              windows={windows}
              onSave={handleSaveItems}
            />
          )}

          {activeTab === 'Крепежи' && (
            <FastenersStep
              onSave={handleSaveFasteners}
            />
          )}

          {/* Автоматическая заглушка для еще не созданных модулей */}
          {!['Клиент', 'Изделия', 'Крепежи'].includes(activeTab) && (
            <div className={styles.placeholder}>
              <h2>Раздел "{activeTab}"</h2>
              <p>В процессе переноса в модульную систему...</p>
            </div>
          )}
        </div>

        {/* НИЖНЯЯ ЧАСТЬ: ПУЛЬТ УПРАВЛЕНИЯ (ВСЕГДА ВИДЕН) */}
        <OrderManagement />
      </section>
    </main>
  );
}