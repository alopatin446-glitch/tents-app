'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createQuickOrderAction } from './quickCalcAction';
import styles from './QuickCalcModal.module.css';

interface QuickCalcModalProps {
  priceMap: Record<string, number>;
  onClose: () => void;
}

export default function QuickCalcModal({ priceMap, onClose }: QuickCalcModalProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [windows, setWindows] = useState<Array<{
    id: number;
    width: number | string;
    height: number | string;
    material: string;
    fastener: string;
    zippers: number;
    weight: boolean;
  }>>([
    { id: 1, width: 200, height: 200, material: 'PVC_700', fastener: 'french_lock', zippers: 0, weight: false }
  ]);

  // ── МАТЕМАТИКА РОЗНИЦЫ (SSOT) ──────────────────────────────────────────────
  const calcWindow = (w: typeof windows[0], overrideFastener: string | null = null) => {
    const fast = overrideFastener || w.fastener;
    const numWidth = Number(w.width) || 0;
    const numHeight = Number(w.height) || 0;

    const mapPVC: Record<string, string> = { none: 'prod_11', eyelet_10: 'prod_1', strap: 'prod_2', staple_pa: 'prod_3', staple_metal: 'prod_4', french_lock: 'prod_5' };
    const mapTPU: Record<string, string> = { none: 'prod_12', eyelet_10: 'prod_6', strap: 'prod_7', staple_pa: 'prod_8', staple_metal: 'prod_9', french_lock: 'prod_10' };
    const mapTINTED: Record<string, string> = { none: 'prod_18', eyelet_10: 'prod_13', strap: 'prod_14', staple_pa: 'prod_15', staple_metal: 'prod_16', french_lock: 'prod_17' };
    const mapMOSQUITO: Record<string, string> = { none: 'prod_19', eyelet_10: 'prod_20', strap: 'prod_21', staple_pa: 'prod_22', staple_metal: 'prod_23', french_lock: 'prod_24' };

    let slug = mapPVC[fast] || 'prod_11';
    if (w.material === 'TPU') slug = mapTPU[fast] || 'prod_12';
    if (w.material === 'TINTED') slug = mapTINTED[fast] || 'prod_18';
    if (w.material === 'MOSQUITO') slug = mapMOSQUITO[fast] || 'prod_19';

    const priceM2 = priceMap[slug] || 0;
    const topFactor = fast !== 'none' ? (4 / 3) : 1;
    const retailArea = ((numWidth + 10) / 100) * ((numHeight + 10) / 100);
    
    let sum = retailArea * priceM2 * topFactor;

    const zipperPrice = priceMap['addo_zipper_retail'] || 0;
    const weightPrice = priceMap['addo_weight_retail'] || 0;

    if (w.zippers > 0) sum += w.zippers * ((numHeight + 10) / 100) * zipperPrice;
    if (w.weight) sum += ((numWidth + 10) / 100) * weightPrice;

    return Math.round(sum);
  };

  // ── УМНЫЕ ВИЛКИ ЦЕН ────────────────────────────────────────────────────────
  const getSmartForks = (baseFastener: string) => {
    if (baseFastener === 'french_lock') {
      return [{ type: 'staple_pa', name: 'Скоба (ПА)' }, { type: 'strap', name: 'Ремешок' }];
    }
    if (baseFastener === 'staple_pa' || baseFastener === 'staple_metal') {
      return [{ type: 'strap', name: 'Ремешок' }, { type: 'french_lock', name: 'Француз' }];
    }
    if (baseFastener === 'strap') {
      return [{ type: 'eyelet_10', name: 'Люверс' }, { type: 'french_lock', name: 'Француз' }];
    }
    return [{ type: 'strap', name: 'Ремешок' }, { type: 'french_lock', name: 'Француз' }];
  };

  const forks = getSmartForks(windows[0]?.fastener || 'none');
  
  const mainTotal = windows.reduce((acc, w) => acc + calcWindow(w), 0);
  const fork1Total = windows.reduce((acc, w) => acc + calcWindow(w, forks[0].type), 0);
  const fork2Total = windows.reduce((acc, w) => acc + calcWindow(w, forks[1].type), 0);

  // ── УПРАВЛЕНИЕ UI ──────────────────────────────────────────────────────────
  const updateWindow = (id: number, field: string, value: string | number | boolean) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, [field]: value } : w));
  };

  const handleNumberChange = (id: number, field: 'width' | 'height', rawVal: string) => {
    if (rawVal === '') {
      updateWindow(id, field, '');
    } else {
      updateWindow(id, field, Math.max(0, parseInt(rawVal, 10) || 0));
    }
  };

  const addWindow = () => {
    setWindows(prev => [
      ...prev,
      { id: Date.now(), width: 200, height: 200, material: 'PVC_700', fastener: 'french_lock', zippers: 0, weight: false }
    ]);
  };

  const removeWindow = (id: number) => {
    setWindows(prev => prev.filter(w => w.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Гарантируем, что ширины и высоты передаются как числа
      const sanitizedWindows = windows.map(w => ({
        ...w,
        width: Number(w.width) || 200,
        height: Number(w.height) || 200,
      }));

      const newId = await createQuickOrderAction({ totalPrice: mainTotal, windows: sanitizedWindows });
      if (newId) {
        onClose();
        router.push(`/dashboard/new-calculation?id=${newId}`);
      }
    } catch (error) {
      console.error('Ошибка создания заказа:', error);
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        
        <header className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>⚡ БЫСТРЫЙ РАСЧЁТ</h2>
          <button className={styles.closeBtn} onClick={onClose} disabled={isSaving}>×</button>
        </header>

        <div className={styles.modalBody}>
          <div className={styles.windowsList}>
            {windows.map((w, index) => (
              <div key={w.id} className={styles.windowCard}>
                <div className={styles.windowHeader}>
                  <span>ПРОЁМ #{index + 1}</span>
                  {windows.length > 1 && (
                    <button onClick={() => removeWindow(w.id)} className={styles.removeWindowBtn}>×</button>
                  )}
                </div>

                <div className={styles.row}>
                  <div className={styles.field}>
                    <label>Ширина (см)</label>
                    <input
                      type="number"
                      className={styles.input}
                      value={w.width}
                      onChange={e => handleNumberChange(w.id, 'width', e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <label>Высота (см)</label>
                    <input
                      type="number"
                      className={styles.input}
                      value={w.height}
                      onChange={e => handleNumberChange(w.id, 'height', e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.row}>
                  <div className={styles.field}>
                    <label>Материал</label>
                    <div className={styles.selectWrapper}>
                      <select className={styles.select} value={w.material} onChange={e => updateWindow(w.id, 'material', e.target.value)}>
                        <option value="PVC_700">ПВХ 700 мкм</option>
                        <option value="TINTED">Тонировка</option>
                        <option value="TPU">Полиуретан (ТПУ)</option>
                        <option value="MOSQUITO">Москитная сетка</option>
                      </select>
                      <div className={styles.selectArrow}>▼</div>
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label>Крепёж</label>
                    <div className={styles.selectWrapper}>
                      <select className={styles.select} value={w.fastener} onChange={e => updateWindow(w.id, 'fastener', e.target.value)}>
                        <option value="french_lock">Французский замок</option>
                        <option value="staple_pa">Поворотная скоба (ПА)</option>
                        <option value="staple_metal">Поворотная скоба (Металл)</option>
                        <option value="strap">Силиконовый ремешок</option>
                        <option value="eyelet_10">Глухой люверс</option>
                        <option value="none">Без крепежа</option>
                      </select>
                      <div className={styles.selectArrow}>▼</div>
                    </div>
                  </div>
                </div>

                <div className={styles.row}>
                  <div className={styles.field}>
                    <label>Дверь (Молнии)</label>
                    <div className={styles.selectWrapper}>
                      <select className={styles.select} value={w.zippers} onChange={e => updateWindow(w.id, 'zippers', Number(e.target.value))}>
                        <option value={0}>Нет</option>
                        <option value={1}>1 молния</option>
                        <option value={2}>2 молнии (Дверь)</option>
                      </select>
                      <div className={styles.selectArrow}>▼</div>
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label>Утяжелитель</label>
                    <div className={styles.selectWrapper}>
                      <select className={styles.select} value={w.weight ? 'yes' : 'no'} onChange={e => updateWindow(w.id, 'weight', e.target.value === 'yes')}>
                        <option value="no">Нет</option>
                        <option value="yes">Да (Вшит в низ)</option>
                      </select>
                      <div className={styles.selectArrow}>▼</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={addWindow} className={styles.addBtn}>+ Добавить проём</button>
        </div>

        <footer className={styles.modalFooter}>
          <div className={styles.priceDisplay}>
            <div className={styles.priceMain}>
              <span className={styles.priceLabel}>Ориентировочная розница:</span>
              <span className={styles.priceValue}>{mainTotal.toLocaleString('ru-RU')} ₽</span>
            </div>
            
            <div className={styles.priceForks}>
              <div className={styles.fork}>
                <small>{forks[0].name}</small>
                <b>{fork1Total.toLocaleString('ru-RU')} ₽</b>
              </div>
              <div className={styles.fork}>
                <small>{forks[1].name}</small>
                <b>{fork2Total.toLocaleString('ru-RU')} ₽</b>
              </div>
            </div>
          </div>

          <button onClick={handleSave} disabled={isSaving} className={styles.actionBtn}>
            {isSaving ? 'СОЗДАЁМ ЗАКАЗ...' : 'ВЗЯТЬ В РАБОТУ →'}
          </button>
        </footer>

      </div>
    </div>
  );
}