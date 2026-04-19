'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation'; 
import { createClientDeal, updateClientDeal, getClientById } from '@/app/lib/actions';
import styles from './calculation.module.css';
import ClientStep from '@/components/calculation/ClientStep';
import ItemsStep from '@/components/calculation/ItemsStep';
import FastenersStep from '@/components/calculation/FastenersStep';

interface WindowItem {
  id: number;
  name: string;
  widthTop: number;
  heightRight: number;
  widthBottom: number;
  heightLeft: number;
  kantTop: number;
  kantRight: number;
  kantBottom: number;
  kantLeft: number;
  kantColor: string;
  material: string;
  isTrapezoid: boolean;
  diagonalLeft: number;  // Было просто diagonal, теперь так
  diagonalRight: number; // И так
  crossbar: number;
}

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
  widthTop: number;
  heightRight: number;
  widthBottom: number;
  heightLeft: number;
  kantTop: number;
  kantRight: number;
  kantBottom: number;
  kantLeft: number;
  kantColor: string;
  material: string;
  isTrapezoid: boolean;
  diagonalLeft: number;  // Добавили
  diagonalRight: number; // Добавили
  crossbar: number;
}

const initialWindow = (id: number): WindowItem => ({
  id,
  name: `Окно ${id}`,
  widthTop: 200,
  heightRight: 200,
  widthBottom: 200,
  heightLeft: 200,
  kantTop: 5,
  kantRight: 5,
  kantBottom: 5,
  kantLeft: 5,
  kantColor: 'Коричневый',
  material: 'ПВХ 700 мкм (Прозрачная)',
  isTrapezoid: false,
  diagonalLeft: 0,
  diagonalRight: 0,
  crossbar: 0,
});

function CalculationContent() {
  const searchParams = useSearchParams();
  const router = useRouter(); 
  const clientId = searchParams.get('id');

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

  useEffect(() => {
    async function fetchClient() {
      if (clientId) {
        const result = await getClientById(clientId);
        if (result.success && result.data) {
          setClientData({
            fio: result.data.fio || '',
            phone: result.data.phone || '',
            address: result.data.address || '',
            source: result.data.source || '',
            comment: result.data.managerComment || '',
            status: result.data.status || 'special_case',
          });
        }
      }
    }
    fetchClient();
  }, [clientId]);

  const menuItems = [
    'Клиент', 'Изделия', 'Крепежи', 'Дополнения',
    'Каркас', 'Расчёт', 'Цены', 'Для производства'
  ];

  const handleSaveClient = async (updatedData: any) => {
    setClientData(updatedData);
    try {
      if (clientId) {
        const result = await updateClientDeal(clientId, updatedData);
        if (result.success) alert('Данные сохранены!');
      } else {
        const result = await createClientDeal(updatedData);
        if (result.success) alert('Клиент создан!');
      }
    } catch (e) {
      alert('Ошибка базы');
    }
  };

  // ИЗМЕНЕНО: Теперь ведет в главное меню CRM
  const handleExit = () => {
    router.push('/dashboard'); 
  };

  const handleSaveItems = (updatedWindows: WindowItem[]) => setWindows(updatedWindows);
  const handleSaveFasteners = () => console.log('SAVE');

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
          clientId && !clientData.fio ? (
            <div style={{ padding: '40px', color: '#00f3ff', textAlign: 'center' }}>
              <h2>ЗАГРУЗКА ДАННЫХ ИЗ БАЗЫ...</h2>
            </div>
          ) : (
            <ClientStep
              key={clientId || 'new'}
              initialData={clientData}
              onSave={handleSaveClient}
              onClose={handleExit} 
            />
          )
        )}

        {activeTab === 'Изделия' && <ItemsStep windows={windows} onSave={handleSaveItems} />}
        {activeTab === 'Крепежи' && <FastenersStep onSave={handleSaveFasteners} />}

        {!['Клиент', 'Изделия', 'Крепежи'].includes(activeTab) && (
          <div className={styles.placeholder}>
            <h2>Раздел "{activeTab}"</h2>
            <p>В процессе разработки...</p>
          </div>
        )}
      </section>
    </main>
  );
}

export default function NewCalculation() {
  return (
    <Suspense fallback={<div>Загрузка...</div>}>
      <CalculationContent />
    </Suspense>
  );
}