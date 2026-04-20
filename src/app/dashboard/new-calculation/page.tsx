'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  createClientDeal,
  updateClientDeal,
  getClientById,
} from '@/app/lib/actions';
import styles from './calculation.module.css';
import ClientStep from '@/components/calculation/ClientStep';
import ItemsStep from '@/components/calculation/ItemsStep';
import FastenersStep from '@/components/calculation/FastenersStep';

interface WindowItem {
  id: number;
  name: string;
  widthTop: number | string;
  heightRight: number | string;
  widthBottom: number | string;
  heightLeft: number | string;
  kantTop: number | string;
  kantRight: number | string;
  kantBottom: number | string;
  kantLeft: number | string;
  kantColor: string;
  material: string;
  isTrapezoid: boolean;
  diagonalLeft: number | string;
  diagonalRight: number | string;
  crossbar: number | string;
}

interface ClientData {
  fio: string;
  phone: string;
  address: string;
  source: string;
  status: string;

  totalPrice: number;
  advance: number;
  balance: number;
  paymentType: string;

  measurementDate: string;
  installDate: string;

  items: WindowItem[];

  managerComment: string;
  engineerComment: string;
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

const initialClientData: ClientData = {
  fio: '',
  phone: '',
  address: '',
  source: '',
  status: 'special_case',

  totalPrice: 0,
  advance: 0,
  balance: 0,
  paymentType: '',

  measurementDate: '',
  installDate: '',

  items: [initialWindow(1)],

  managerComment: '',
  engineerComment: '',
};

function normalizeNumber(value: unknown, fallback = 0): number {
  if (value === undefined || value === null || value === '') return fallback;

  const normalized =
    typeof value === 'string' ? value.replace(',', '.').trim() : value;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeDateForInput(value: unknown): string {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

function normalizeWindows(items: unknown): WindowItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    return [initialWindow(1)];
  }

  return items.map((item: any, index: number) => ({
    id: Number(item?.id) || index + 1,
    name: item?.name || `Окно ${index + 1}`,

    widthTop: item?.widthTop ?? 0,
    heightRight: item?.heightRight ?? 0,
    widthBottom: item?.widthBottom ?? 0,
    heightLeft: item?.heightLeft ?? 0,

    kantTop: item?.kantTop ?? 0,
    kantRight: item?.kantRight ?? 0,
    kantBottom: item?.kantBottom ?? 0,
    kantLeft: item?.kantLeft ?? 0,

    kantColor: item?.kantColor || 'Коричневый',
    material: item?.material || 'ПВХ 700 мкм (Прозрачная)',

    isTrapezoid: Boolean(item?.isTrapezoid),

    diagonalLeft: item?.diagonalLeft ?? 0,
    diagonalRight: item?.diagonalRight ?? 0,
    crossbar: item?.crossbar ?? 0,
  }));
}

function CalculationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const initialQueryClientId = searchParams.get('id');
  const [clientId, setClientId] = useState<string | null>(initialQueryClientId);

  const [activeTab, setActiveTab] = useState('Клиент');
  const [clientData, setClientData] = useState<ClientData>(initialClientData);
  const [windows, setWindows] = useState<WindowItem[]>(initialClientData.items);
  const [isLoadingClient, setIsLoadingClient] = useState(false);

  useEffect(() => {
    setClientId(initialQueryClientId);
  }, [initialQueryClientId]);

  useEffect(() => {
    async function fetchClient() {
      if (!clientId) {
        setClientData(initialClientData);
        setWindows(initialClientData.items);
        return;
      }

      setIsLoadingClient(true);

      try {
        const result = await getClientById(clientId);

        if (result.success && result.data) {
          const dbClient = result.data;
          const normalizedItems = normalizeWindows(dbClient.items);

          setWindows(normalizedItems);

          setClientData({
            fio: dbClient.fio || '',
            phone: dbClient.phone || '',
            address: dbClient.address || '',
            source: dbClient.source || '',
            status: dbClient.status || 'special_case',

            totalPrice: normalizeNumber(dbClient.totalPrice, 0),
            advance: normalizeNumber(dbClient.advance, 0),
            balance: normalizeNumber(dbClient.balance, 0),
            paymentType: dbClient.paymentType || '',

            measurementDate: normalizeDateForInput(dbClient.measurementDate),
            installDate: normalizeDateForInput(dbClient.installDate),

            items: normalizedItems,

            managerComment: dbClient.managerComment || '',
            engineerComment: dbClient.engineerComment || '',
          });
        }
      } finally {
        setIsLoadingClient(false);
      }
    }

    fetchClient();
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

  const handleSaveClient = async (updatedData: Partial<ClientData>) => {
    const nextTotalPrice = normalizeNumber(
      updatedData?.totalPrice ?? clientData.totalPrice,
      0
    );
    const nextAdvance = normalizeNumber(
      updatedData?.advance ?? clientData.advance,
      0
    );

    const hasExplicitBalance =
      updatedData?.balance !== undefined &&
      updatedData?.balance !== null &&
      String(updatedData.balance).trim() !== '';

    const nextBalance = hasExplicitBalance
      ? normalizeNumber(updatedData.balance, 0)
      : nextTotalPrice - nextAdvance;

    const syncedItems = Array.isArray(windows) && windows.length > 0
      ? windows
      : Array.isArray(clientData.items) && clientData.items.length > 0
      ? clientData.items
      : [initialWindow(1)];

    const normalizedData: ClientData = {
      ...clientData,
      ...updatedData,

      totalPrice: nextTotalPrice,
      advance: nextAdvance,
      balance: nextBalance,

      items: syncedItems,

      managerComment:
        updatedData?.managerComment ?? clientData.managerComment ?? '',
      engineerComment:
        updatedData?.engineerComment ?? clientData.engineerComment ?? '',
    };

    setClientData(normalizedData);
    setWindows(syncedItems);

    try {
      if (clientId) {
        const result = await updateClientDeal(clientId, normalizedData);
        if (result.success) {
          alert('Данные сохранены!');
        }
      } else {
        const result = await createClientDeal(normalizedData);

        if (result.success && result.id) {
          const newId = result.id as string;

          setClientId(newId);
          router.replace(`${pathname}?id=${newId}`);

          alert('Клиент создан!');
        }
      }
    } catch (e) {
      alert('Ошибка базы');
    }
  };

  const handleExit = () => {
    router.push('/dashboard');
  };

  const handleSaveItems = async (updatedWindows: WindowItem[]) => {
    const normalizedWindows = normalizeWindows(updatedWindows);

    setWindows(normalizedWindows);
    setClientData((prev) => ({
      ...prev,
      items: normalizedWindows,
    }));

    if (!clientId) {
      return;
    }

    try {
      await updateClientDeal(clientId, {
        ...clientData,
        items: normalizedWindows,
      });
    } catch (e) {
      console.error('Ошибка сохранения изделий:', e);
    }
  };

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

      <section
        className={`${styles.contentArea} ${
          activeTab === 'Изделия' ? styles.wideContent : ''
        }`}
      >
        {activeTab === 'Клиент' &&
          (clientId && isLoadingClient ? (
            <div style={{ padding: '40px', color: '#00f3ff', textAlign: 'center' }}>
              <h2>ЗАГРУЗКА ДАННЫХ ИЗ БАЗЫ...</h2>
            </div>
          ) : (
            <ClientStep
              key={clientId || 'new'}
              initialData={{
                ...clientData,
                items: windows,
              }}
              onSave={handleSaveClient}
              onClose={handleExit}
            />
          ))}

        {activeTab === 'Изделия' && (
          <ItemsStep
            windows={windows}
            onSave={handleSaveItems}
            clientId={clientId || undefined}
          />
        )}

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