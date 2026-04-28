'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPrices, updatePrices } from '@/app/actions/prices';
import styles from './prices.module.css';

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
    async function load() {
      const res = await getPrices();

      if (res.success) {
        setAllPrices(res.data ?? []);
      }

      setLoading(false);
    }

    load();
  }, []);

  const handleInputChange = (id: string, field: string, value: string) => {
    setAllPrices((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const addNewPrice = () => {
    const categoryItems = allPrices.filter((p) => p.category === activeTab);
    const nextNumber = categoryItems.length + 1;

    const prefix = activeTab.replace('retail_', '').replace('cost_', 'c_').slice(0, 8);
    const newSlug = `${prefix}_${nextNumber}`;

    const newItem = {
      id: `new-${Date.now()}`,
      slug: newSlug,
      name: '',
      value: 0,
      unit: 'м2',
      category: activeTab,
    };

    setAllPrices((prev) => [...prev, newItem]);
  };

  const deleteRow = (id: string) => {
    setAllPrices((prev) => prev.filter((item) => item.id !== id));
  };

  const saveToDb = async () => {
    const categoryData = allPrices.filter((p) => p.category === activeTab);
    const res = await updatePrices(categoryData, activeTab);

    if (res.success) {
      alert('Данные раздела успешно сохранены!');

      const updated = await getPrices();

      if (updated.success) {
        setAllPrices(updated.data ?? []);
      }
    } else {
      alert('Ошибка при сохранении: ' + res.error);
    }
  };

  const currentItems = allPrices.filter((p) => p.category === activeTab);

  if (loading) {
    return (
      <div
        className={styles.container}
        style={{ justifyContent: 'center', alignItems: 'center' }}
      >
        ЗАГРУЗКА ДАННЫХ...
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
            style={{ gridTemplateColumns: '150px 2fr 1fr 100px 40px' }}
          >
            <span>АРТИКУЛ</span>
            <span>Наименование позиции</span>
            <span style={{ textAlign: 'right', paddingRight: '20px' }}>Цена</span>
            <span style={{ textAlign: 'center' }}>Ед. изм.</span>
            <span></span>
          </div>

          {currentItems.map((item) => (
            <div
              key={item.id}
              className={styles.priceRow}
              style={{ gridTemplateColumns: '150px 2fr 1fr 100px 40px' }}
            >
              <input
                type="text"
                value={item.slug ?? ''}
                onChange={(e) => handleInputChange(item.id, 'slug', e.target.value)}
                className={styles.inputName}
                placeholder="ID / артикул"
                disabled={!item.id.toString().startsWith('new-')}
                title={
                  item.id.toString().startsWith('new-')
                    ? 'Можно изменить только при создании'
                    : 'Системный ID менять нельзя'
                }
                style={{
                  opacity: item.id.toString().startsWith('new-') ? 1 : 0.5,
                  cursor: item.id.toString().startsWith('new-') ? 'text' : 'not-allowed',
                  width: '150px',
                }}
              />

              <input
                type="text"
                value={item.name ?? ''}
                onChange={(e) => handleInputChange(item.id, 'name', e.target.value)}
                className={styles.inputName}
                placeholder="Введите название..."
              />

              <input
                type="number"
                value={item.value ?? 0}
                onChange={(e) => handleInputChange(item.id, 'value', e.target.value)}
                className={styles.inputPrice}
              />

              <input
                type="text"
                value={item.unit ?? 'м2'}
                onChange={(e) => handleInputChange(item.id, 'unit', e.target.value)}
                className={styles.inputName}
                style={{ textAlign: 'center' }}
              />

              <button
                onClick={() => deleteRow(item.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ff4444',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                }}
                title="Удалить строку"
              >
                ×
              </button>
            </div>
          ))}

          <button
            className={styles.tab}
            style={{
              marginTop: '20px',
              borderStyle: 'dashed',
              textAlign: 'center',
              background: 'rgba(123, 255, 0, 0.02)',
            }}
            onClick={addNewPrice}
          >
            + ДОБАВИТЬ НОВУЮ СТРОКУ
          </button>
        </div>
      </section>
    </main>
  );
}