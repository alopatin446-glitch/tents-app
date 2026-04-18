'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClientDeal } from '@/app/lib/actions'; 
import styles from './calculation.module.css';
import ClientStep from '@/components/calculation/ClientStep';
import ItemsStep from '@/components/calculation/ItemsStep';
import FastenersStep from '@/components/calculation/FastenersStep';

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

// Основной контент страницы вынесен в отдельный компонент для работы с useSearchParams
function CalculationContent() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('id'); // Получаем ?id=... из ссылки

  const [activeTab, setActiveTab] = useState('Клиент');
  const [clientData, setClientData] = useState<ClientData>({
    fio: '',
    phone: '',
    address: '',
    source: '',
    comment: '',
    status: 'special_case',
  });

  const [windows, setWindows] = useState<WindowItem[]>([initialWindow(1)]);

  // ЭФФЕКТ: Если в ссылке есть ID, страница переходит в режим редактирования
  useEffect(() => {
    if (clientId) {
      console.log('Режим редактирования клиента:', clientId);
      // В будущем здесь будет вызов fetchClientById(clientId)
      // Чтобы автоматически заполнить поля fio, phone и т.д.
    }
  }, [clientId]);

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

  const handleSaveClient = async (updatedData: any) => {
    setClientData(updatedData);
    
    try {
      if (clientId) {
        console.log('ОБНОВЛЕНИЕ клиента в БД (ID):', clientId, updatedData);
        // Здесь будет вызов updateClientDeal(clientId, updatedData)
        alert('Данные обновлены (режим редактирования)');
      } else {
        console.log('СОЗДАНИЕ нового клиента в БД...', updatedData);
        const result = await createClientDeal(updatedData);
        if (result.success) {
          alert('Клиент успешно создан в базе!');
        } else {
          alert('Ошибка при сохранении: ' + result.error);
        }
      }
    } catch (error) {
      console.error(error);
      alert('Произошла критическая ошибка');
    }
  };

  const handleSaveItems = (updatedWindows: WindowItem[]) => {
    setWindows(updatedWindows);
    console.log('ИЗДЕЛИЯ ЗАФИКСИРОВАНЫ');
  };

  const handleSaveFasteners = () => {
    console.log('КРЕПЕЖИ ЗАФИКСИРОВАНЫ');
  };

  return (
    <main className={styles.mainContainer}>
      <aside className={styles.sidebar}>
        <div className={styles.orderBadge}>
          {clientId ? `РЕДАКТИРОВАНИЕ ID: ${clientId.slice(-4)}` : 'ЗАКАЗ: НОВЫЙ'}
        </div>
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
        {activeTab === 'Клиент' && (
          <ClientStep
            initialData={clientData}
            onSave={handleSaveClient}
            onClose={() => window.history.back()}
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

        {!['Клиент', 'Изделия', 'Крепежи'].includes(activeTab) && (
          <div className={styles.placeholder}>
            <h2>Раздел "{activeTab}"</h2>
            <p>В процессе переноса в модульную систему...</p>
          </div>
        )}
      </section>
    </main>
  );
}

// Обертка для корректной работы Next.js с поисковыми параметрами
export default function NewCalculation() {
  return (
    <Suspense fallback={<div>Загрузка...</div>}>
      <CalculationContent />
    </Suspense>
  );
}