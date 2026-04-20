'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  createClientDeal,
  getClientById,
  updateClientDeal,
} from '@/app/lib/actions';
import styles from './calculation.module.css';
import ClientStep, {
  ClientFormData,
} from '@/components/calculation/ClientStep';
import ItemsStep, {
  WindowItem,
} from '@/components/calculation/ItemsStep';
import FastenersStep from '@/components/calculation/FastenersStep';

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
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized =
    typeof value === 'string' ? value.replace(',', '.').trim() : value;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeDateForInput(value: unknown): string {
  if (!value) {
    return '';
  }

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return '';
  }

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
  const mode = searchParams.get('mode');
  const isReadOnly = mode === 'archive';

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

  const buildClientSnapshot = (
    baseData: ClientData,
    overrides: Partial<ClientData> = {},
    forcedWindows?: WindowItem[]
  ): ClientData => {
    const nextTotalPrice = normalizeNumber(
      overrides.totalPrice ?? baseData.totalPrice,
      0
    );

    const nextAdvance = normalizeNumber(
      overrides.advance ?? baseData.advance,
      0
    );

    const hasExplicitBalance =
      overrides.balance !== undefined &&
      overrides.balance !== null &&
      String(overrides.balance).trim() !== '';

    const nextBalance = hasExplicitBalance
      ? normalizeNumber(overrides.balance, 0)
      : nextTotalPrice - nextAdvance;

    const syncedItems =
      Array.isArray(forcedWindows) && forcedWindows.length > 0
        ? forcedWindows
        : Array.isArray(overrides.items) && overrides.items.length > 0
          ? overrides.items
          : Array.isArray(baseData.items) && baseData.items.length > 0
            ? baseData.items
            : [initialWindow(1)];

    return {
      ...baseData,
      ...overrides,
      totalPrice: nextTotalPrice,
      advance: nextAdvance,
      balance: nextBalance,
      items: syncedItems,
      managerComment: overrides.managerComment ?? baseData.managerComment ?? '',
      engineerComment:
        overrides.engineerComment ?? baseData.engineerComment ?? '',
    };
  };

  const handleSaveClient = async (updatedData: Partial<ClientFormData>) => {
    const normalizedItems = Array.isArray(updatedData.items)
      ? normalizeWindows(updatedData.items)
      : windows;

    const normalizedData = buildClientSnapshot(
      clientData,
      {
        fio: updatedData.fio ?? clientData.fio,
        phone: updatedData.phone ?? clientData.phone,
        address: updatedData.address ?? clientData.address,
        source: updatedData.source ?? clientData.source,
        status: updatedData.status ?? clientData.status,
        totalPrice:
          updatedData.totalPrice !== undefined
            ? normalizeNumber(updatedData.totalPrice, 0)
            : clientData.totalPrice,
        advance:
          updatedData.advance !== undefined
            ? normalizeNumber(updatedData.advance, 0)
            : clientData.advance,
        balance:
          updatedData.balance !== undefined
            ? normalizeNumber(updatedData.balance, 0)
            : clientData.balance,
        paymentType: updatedData.paymentType ?? clientData.paymentType,
        measurementDate:
          updatedData.measurementDate ?? clientData.measurementDate,
        installDate: updatedData.installDate ?? clientData.installDate,
        items: normalizedItems,
        managerComment: updatedData.managerComment ?? clientData.managerComment,
        engineerComment:
          updatedData.engineerComment ?? clientData.engineerComment,
      },
      normalizedItems
    );

    setClientData(normalizedData);
    setWindows(normalizedData.items);

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
    } catch (error) {
      alert('Ошибка базы');
    }
  };

  const handleExit = () => {
    router.push('/dashboard');
  };

  const handleSaveItems = async (updatedWindows: WindowItem[]) => {
    const normalizedWindows = normalizeWindows(updatedWindows);
    const nextClientData = buildClientSnapshot(
      clientData,
      { items: normalizedWindows },
      normalizedWindows
    );

    setWindows(normalizedWindows);
    setClientData(nextClientData);

    if (!clientId) {
      return;
    }

    try {
      await updateClientDeal(clientId, nextClientData);
    } catch (error) {
      console.error('Ошибка сохранения изделий:', error);
    }
  };

  const handleSaveFasteners = () => {
    console.log('SAVE');
  };

  return (
    <main className={styles.mainContainer}>
      <aside className={styles.sidebar}>
        <div className={styles.orderBadge}>
          {isReadOnly
            ? `АРХИВ ID: ${clientId?.slice(-4) || '----'}`
            : clientId
              ? `РЕДАКТИРОВАНИЕ ID: ${clientId.slice(-4)}`
              : 'ЗАКАЗ: НОВЫЙ'}
        </div>

        <nav className={styles.navMenu}>
          {menuItems.map((item) => (
            <button
              key={item}
              className={`${styles.navButton} ${
                activeTab === item ? styles.active : ''
              }`}
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
              key={`${clientId || 'new'}-${isReadOnly ? 'archive' : 'edit'}`}
              initialData={{
                ...clientData,
                items: windows,
              }}
              onSave={handleSaveClient}
              onClose={handleExit}
              isReadOnly={isReadOnly}
            />
          ))}

        {activeTab === 'Изделия' && (
          <ItemsStep
            windows={windows}
            onSave={handleSaveItems}
            clientId={clientId || undefined}
            isReadOnly={isReadOnly}
          />
        )}

        {activeTab === 'Крепежи' && (
          <FastenersStep
            onSave={handleSaveFasteners}
            isReadOnly={isReadOnly}
          />
        )}

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