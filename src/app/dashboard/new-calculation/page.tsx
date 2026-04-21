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
import ItemsStep, { WindowItem } from '@/components/calculation/ItemsStep';
import FastenersStep from '@/components/calculation/FastenersStep';

// Описываем типы так, чтобы они принимали только конкретные значения (без null)
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

// Хелпер для очистки данных от null/undefined
const safeStr = (v: any) => v ?? '';

function normalizeNumber(value: unknown, fallback = 0): number {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = typeof value === 'string' ? value.replace(',', '.').trim() : value;
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
  if (!Array.isArray(items) || items.length === 0) return [initialWindow(1)];
  return items.map((item: any, index: number) => ({
    id: Number(item?.id) || index + 1,
    name: safeStr(item?.name) || `Окно ${index + 1}`,
    widthTop: item?.widthTop ?? 0,
    heightRight: item?.heightRight ?? 0,
    widthBottom: item?.widthBottom ?? 0,
    heightLeft: item?.heightLeft ?? 0,
    kantTop: item?.kantTop ?? 0,
    kantRight: item?.kantRight ?? 0,
    kantBottom: item?.kantBottom ?? 0,
    kantLeft: item?.kantLeft ?? 0,
    kantColor: safeStr(item?.kantColor) || 'Коричневый',
    material: safeStr(item?.material) || 'ПВХ 700 мкм (Прозрачная)',
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

  // Основные стейты
  const [clientDraft, setClientDraft] = useState<ClientData>(initialClientData);
  const [windowsDraft, setWindowsDraft] = useState<WindowItem[]>(initialClientData.items);
  const [isLoadingClient, setIsLoadingClient] = useState(false);

  useEffect(() => {
    async function fetchClient() {
      if (!clientId) return;
      setIsLoadingClient(true);
      try {
        const result = await getClientById(clientId);
        if (result.success && result.data) {
          const db = result.data;
          const normalizedItems = normalizeWindows(db.items);

          const mapped: ClientData = {
            fio: safeStr(db.fio),
            phone: safeStr(db.phone),
            address: safeStr(db.address),
            source: safeStr(db.source),
            status: safeStr(db.status) || 'special_case',
            totalPrice: normalizeNumber(db.totalPrice),
            advance: normalizeNumber(db.advance),
            balance: normalizeNumber(db.balance),
            paymentType: safeStr(db.paymentType),
            measurementDate: normalizeDateForInput(db.measurementDate),
            installDate: normalizeDateForInput(db.installDate),
            items: normalizedItems,
            managerComment: safeStr(db.managerComment),
            engineerComment: safeStr(db.engineerComment),
          };
          setClientDraft(mapped);
          setWindowsDraft(normalizedItems);
        }
      } finally {
        setIsLoadingClient(false);
      }
    }
    fetchClient();
  }, [clientId]);

  const handleTabChange = async (nextTab: string) => {
    if (activeTab === nextTab) return;
    if (!isReadOnly && clientId) {
      // Сохраняем черновик при переходе
      await updateClientDeal(clientId, { ...clientDraft, items: windowsDraft });
    }
    setActiveTab(nextTab);
  };

  const handleSaveClient = async (updatedData: any) => {
    const nextTotalPrice = normalizeNumber(updatedData?.totalPrice ?? clientDraft.totalPrice, 0);
    const nextAdvance = normalizeNumber(updatedData?.advance ?? clientDraft.advance, 0);

    const normalizedData: ClientData = {
      ...clientDraft,
      ...updatedData,
      fio: safeStr(updatedData.fio ?? clientDraft.fio),
      totalPrice: nextTotalPrice,
      advance: nextAdvance,
      balance: nextTotalPrice - nextAdvance,
      items: windowsDraft,
    };

    setClientDraft(normalizedData);

    try {
      if (clientId) {
        await updateClientDeal(clientId, normalizedData);
        alert('Данные сохранены!');
      } else {
        const result = await createClientDeal(normalizedData);
        if (result.success && result.id) {
          setClientId(result.id);
          router.replace(`${pathname}?id=${result.id}`);
          alert('Клиент создан!');
        }
      }
    } catch { alert('Ошибка базы'); }
  };

  const handleSaveItems = async (updatedWindows: WindowItem[]) => {
    const normalized = normalizeWindows(updatedWindows);
    setWindowsDraft(normalized);
    setClientDraft(prev => ({ ...prev, items: normalized }));

    if (!clientId) return;
    try {
      await updateClientDeal(clientId, { ...clientDraft, items: normalized });
      alert('Изделия сохранены!');
    } catch (e) { console.error('Ошибка:', e); }
  };

  const menuItems = ['Клиент', 'Изделия', 'Крепежи', 'Дополнения', 'Каркас', 'Расчёт', 'Цены', 'Для производства'];

  return (
    <main className={styles.mainContainer}>
      <aside className={styles.sidebar}>
        <div className={styles.orderBadge}>
          {clientId ? `ID: ${clientId.slice(-4)}` : 'НОВЫЙ'}
        </div>
        <nav className={styles.navMenu}>
          {menuItems.map((item) => (
            <button
              key={item}
              className={`${styles.navButton} ${activeTab === item ? styles.active : ''}`}
              onClick={() => handleTabChange(item)}
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <section className={`${styles.contentArea} ${activeTab === 'Изделия' ? styles.wideContent : ''}`}>
        {activeTab === 'Клиент' && (
          <ClientStep
            key={clientId || 'new'}
            initialData={{ ...clientDraft, items: windowsDraft }}
            onDraftChange={(data: any) => setClientDraft(prev => ({
              ...prev,
              ...data,
              fio: safeStr(data.fio ?? prev.fio)
            }))}
            onSave={handleSaveClient}
            onClose={() => router.push('/dashboard')}
            isReadOnly={isReadOnly}
          />
        )}

        {activeTab === 'Изделия' && (
          <ItemsStep
            key={`items-${clientId || 'new'}-${windowsDraft.length}`} // Добавлен ключ для сброса стейта внутри компонента
            windows={windowsDraft.length > 0 ? windowsDraft : [initialWindow(1)]}
            onDraftChange={(items) => {
              setWindowsDraft(items);
              setClientDraft(prev => ({ ...prev, items }));
            }}
            onSave={handleSaveItems}
            clientId={clientId || undefined}
            isReadOnly={isReadOnly}
          />
        )}

        {activeTab === 'Крепежи' && <FastenersStep onSave={() => { }} isReadOnly={isReadOnly} />}

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
  return <Suspense fallback={<div>Загрузка...</div>}><CalculationContent /></Suspense>;
}