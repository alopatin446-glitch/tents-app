'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPrices, updatePrices } from '@/app/actions/prices';
import styles from './prices.module.css';
import { notifyError, notifySuccess } from '@/lib/notify';

const CATEGORIES = [
  { id: 'retail_products', label: '1) Розница изделий' },
  { id: 'retail_fasteners', label: '2) Розница крепежей' },
  { id: 'retail_addons', label: '3) Розница допов' },
  { id: 'retail_install', label: '4) Розница монтажа' },
  { id: 'cost_products', label: '5) Себес изделий' },
  { id: 'cost_fasteners', label: '6) Себес крепежей' },
  { id: 'cost_addons', label: '7) Себес допов' },
  { id: 'cost_install', label: '8) Себес монтажа' },
  { id: 'cost_production', label: '9) Себес изготовления' },
];

export default function PricesPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('retail_products');
  const [loading, setLoading] = useState(true);
  const [allPrices, setAllPrices] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const res = await getPrices();
        if (isMounted) {
          if (res.success) {
            setAllPrices(res.data ?? []);
          } else {
            notifyError(res.error || 'Ошибка загрузки');
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('Fetch error:', err);
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => { isMounted = false; }; // Чистим за собой
  }, []); // Строго пустой массив!

  const handleInputChange = (id: string, value: string) => {
    setAllPrices((prev) =>
      prev.map((item) => (item.id === id ? { ...item, value: value } : item)),
    );
  };

  const saveToDb = async () => {
    // ПОГРАНИЧНИК-ЛОГИКА: Берем данные только активной категории
    const categoryData = allPrices.filter((p) => p.category === activeTab);

    // ТАМОЖНЯ: Исправляем ошибку 2554. Передаем только один аргумент
    const res = await updatePrices(categoryData);

    if (res.success) {
      notifySuccess('Данные раздела успешно сохранены!');
      const updated = await getPrices();
      if (updated.success) {
        setAllPrices(updated.data ?? []);
      }
    } else {
      notifyError('Ошибка при сохранении: ' + res.error);
    }
  };

  const currentItems = allPrices.filter((p) => p.category === activeTab);

  if (loading) {
    return (
      <div
        className={styles.container}
        style={{ justifyContent: 'center', alignItems: 'center', display: 'flex', height: '100vh' }}
      >
        ЗАГРУЗКА ДАННЫХ ПРАЙСА...
      </div>
    );
  }

  return (
    <main className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTitle}>РАЗДЕЛЫ ПРАЙСА</div>

        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`${styles.tab} ${activeTab === cat.id ? styles.activeTab : ''}`}
            onClick={() => setActiveTab(cat.id)}
          >
            {cat.label}
          </button>
        ))}

        <button
          onClick={() => router.push('/dashboard')}
          className={styles.backButton}
          style={{ marginTop: 'auto' }}
        >
          ← В ПАНЕЛЬ УПРАВЛЕНИЯ
        </button>
      </aside>

      <section className={styles.mainArea}>
        <header className={styles.header}>
          <h1 className={styles.sectionTitle}>
            {CATEGORIES.find((c) => c.id === activeTab)?.label}
          </h1>

          <button className={styles.saveButton} onClick={saveToDb}>
            СОХРАНИТЬ ИЗМЕНЕНИЯ
          </button>
        </header>

        <div className={styles.priceGrid}>
          <div
            className={styles.gridHeader}
            style={{ gridTemplateColumns: '150px 2fr 1fr 100px' }}
          >
            <span>АРТИКУЛ</span>
            <span>Наименование позиции</span>
            <span style={{ textAlign: 'right', paddingRight: '20px' }}>Цена (₽)</span>
            <span style={{ textAlign: 'center' }}>Ед. изм.</span>
          </div>

          {currentItems.map((item) => (
            <div
              key={item.id}
              className={styles.priceRow}
              style={{ gridTemplateColumns: '150px 2fr 1fr 100px' }}
            >
              {/* Поля Slug, Name и Unit закрыты для редактирования согласно Конституции */}
              <div className={styles.inputName} style={{ opacity: 0.5, cursor: 'not-allowed', display: 'flex', alignItems: 'center', fontSize: '12px' }}>
                {item.slug}
              </div>

              <div className={styles.inputName} style={{ display: 'flex', alignItems: 'center' }}>
                {item.name}
              </div>

              <input
                type="number"
                value={item.value ?? 0}
                onChange={(e) => handleInputChange(item.id, e.target.value)}
                className={styles.inputPrice}
                placeholder="0.00"
              />

              <div className={styles.inputName} style={{ textAlign: 'center', opacity: 0.7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.unit}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(123, 255, 0, 0.05)', borderRadius: '8px', borderLeft: '4px solid #7BFF00', color: '#666', fontSize: '13px' }}>
          <strong>Статус системы:</strong> Структура прайса заблокирована. Изменение названий и артикулов производится только через файлы констант и миграции БД.
        </div>
      </section>
    </main>
  );
}