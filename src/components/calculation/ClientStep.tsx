'use client';

import { useState } from 'react';
import styles from './ClientStep.module.css';

const sourceOptions = [
  'VK', '2Гис', 'Макс', 'Сайт', 'Авито', 'Telegram', 'Яндекс бизнес', 
  'Яндекс Директ', 'Повторный клиент', 'По рекомендации', 'Проезжал мимо офиса', 
  'Проезжал мимо цеха', 'От председателя', 'Баннер в СНТ', 'Другое'
];

const statusOptions = [
  'Общение с клиентом', 'Ожидает замер', 'Обещал заплатить', 'Ожидает Монтаж', 
  'Ожидает изделия', 'Сделка успешна', 'Сделка провалена'
];

export default function ClientStep({ initialData, onSave }: { initialData: any, onSave: (data: any) => void }) {
  const [clientData, setClientData] = useState(initialData || {});
  const [isMeasurementSelf, setIsMeasurementSelf] = useState(false);
  const [isInstallationSelf, setIsInstallationSelf] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setClientData((prev: any) => ({ ...prev, [name]: value }));
  };

  return (
    <div className={styles.clientGrid}>
      {/* БЛОК 1: ДАННЫЕ КЛИЕНТА (На всю ширину) */}
      <div className={`${styles.card} ${styles.fullWidth}`}>
        <h2 className={styles.sectionTitle}>Данные клиента</h2>
        <div className={styles.inputRows}>
          <div className={styles.fullRow}>
            <label>ФИО КЛИЕНТА</label>
            <input type="text" name="fio" value={clientData.fio || ''} onChange={handleChange} className={styles.neonInput} placeholder="Иванов Иван Иванович" />
          </div>
          
          <div className={styles.twoCol}>
            <div className={styles.inputGroup}>
              <label>ТЕЛЕФОН</label>
              <input type="tel" name="phone" value={clientData.phone || ''} onChange={handleChange} className={styles.neonInput} placeholder="+7..." />
            </div>
            <div className={styles.inputGroup}>
              <label>ОТКУДА УЗНАЛ О НАС</label>
              <select name="source" value={clientData.source || ''} onChange={handleChange} className={styles.neonSelect}>
                <option value="">Выберите источник...</option>
                {sourceOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.fullRow}>
            <label>АДРЕС ОБЪЕКТА (КЛЮЧ ПОИСКА)</label>
            <input type="text" name="address" value={clientData.address || ''} onChange={handleChange} className={styles.neonInput} />
          </div>

          <div className={styles.twoCol}>
            <div className={styles.inputGroup}>
              <label>СТАТУС ЗАКАЗА</label>
              <select name="status" value={clientData.status || ''} onChange={handleChange} className={styles.neonSelect}>
                <option value="">Выберите статус...</option>
                {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div className={styles.inputGroup}>
              <label>ДАТА ЗАМЕРА</label>
              <div className={styles.dateWrapper}>
                <input type="date" name="measurementDate" value={clientData.measurementDate || ''} onChange={handleChange} className={styles.neonInput} disabled={isMeasurementSelf} />
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" checked={isMeasurementSelf} onChange={() => setIsMeasurementSelf(!isMeasurementSelf)} /> Самостоятельный
                </label>
              </div>
            </div>
          </div>

          <div className={styles.fullRow}>
            <label>КОММЕНТАРИЙ К ЗАКАЗУ</label>
            <textarea name="comment" value={clientData.comment || ''} onChange={handleChange} className={styles.neonTextarea} rows={3} />
          </div>
        </div>
      </div>

      {/* БЛОК 2: ФОТО И МАТЕРИАЛЫ */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Фото и материалы</h2>
        <div className={styles.inputRows}>
          <div className={styles.inputGroup}><label>Фото объекта</label><input type="file" className={styles.neonInput} /></div>
          <div className={styles.inputGroup}><label>Фото замера</label><input type="file" className={styles.neonInput} /></div>
          <div className={styles.inputGroup}><label>Фото договора</label><input type="file" className={styles.neonInput} /></div>
          <div className={styles.inputGroup}>
            <label>ДАТА МОНТАЖА</label>
            <div className={styles.dateWrapper}>
              <input type="date" name="installDate" className={styles.neonInput} disabled={isInstallationSelf} />
              <label className={styles.checkboxLabel}>
                <input type="checkbox" checked={isInstallationSelf} onChange={() => setIsInstallationSelf(!isInstallationSelf)} /> Самостоятельный
              </label>
            </div>
          </div>
          <div className={styles.fullRow}><label>Комментарий инженера</label><textarea className={styles.neonTextarea} rows={2} /></div>
        </div>
      </div>

      {/* БЛОК 3: ПЛАТЕЖ И ИТОГИ */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Финансы</h2>
        <div className={styles.inputRows}>
          <div className={styles.twoCol}>
            <div className={styles.inputGroup}><label>Стоимость</label><input type="number" name="agreedPrice" className={styles.neonInput} /></div>
            <div className={styles.inputGroup}><label>Аванс</label><input type="number" name="advance" className={styles.neonInput} /></div>
          </div>
          <div className={styles.inputGroup}>
            <label>Тип оплаты</label>
            <select name="payType" className={styles.neonSelect}>
              <option value="cash">Наличными</option>
              <option value="terminal">Терминал</option>
              <option value="rs">Расчетный счет</option>
            </select>
          </div>
          <hr className={styles.divider} />
          <div className={styles.stats}>
            <div className={styles.statLine}><span>Площадь:</span> <strong>0 м²</strong></div>
            <div className={styles.statLine}><span>Себестоимость:</span> <strong>0 ₽</strong></div>
            <div className={`${styles.statLine} ${styles.profit}`}><span>Прибыль:</span> <strong>0 ₽</strong></div>
          </div>
        </div>
      </div>

      <div className={styles.fullWidth}>
        <button className={styles.saveButton} onClick={() => onSave(clientData)}>СОХРАНИТЬ ДАННЫЕ КЛИЕНТА</button>
      </div>
    </div>
  );
}