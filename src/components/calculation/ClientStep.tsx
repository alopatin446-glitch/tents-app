'use client';
import { useState } from 'react';
import styles from './ClientStep.module.css';

interface ClientData {
  fio: string;
  phone: string;
  address: string;
  source: string;
  comment: string;
  status: string;
}

export default function ClientStep({ initialData, onSave }: { initialData: ClientData, onSave: (data: ClientData) => void }) {
  // ЛОКАЛЬНОЕ СОСТОЯНИЕ (Свет выключен, пока не нажмем Сохранить)
  const [localData, setLocalData] = useState(initialData);

  return (
    <div className={styles.clientGrid}>
      <div className={styles.leftColumn}>
        <h2 className={styles.sectionTitle}>Данные клиента</h2>
        
        <div className={styles.inputGroup}>
          <label>ФИО клиента</label>
          <input 
            type="text" 
            value={localData.fio} 
            onChange={(e) => setLocalData({...localData, fio: e.target.value})}
            className={styles.neonInput} 
          />
        </div>

        <div className={styles.inputGroup}>
          <label>Телефон</label>
          <input 
            type="tel" 
            value={localData.phone}
            onChange={(e) => setLocalData({...localData, phone: e.target.value})}
            className={styles.neonInput} 
          />
        </div>

        <div className={styles.inputGroup}>
          <label>Адрес объекта</label>
          <input 
            type="text" 
            value={localData.address}
            onChange={(e) => setLocalData({...localData, address: e.target.value})}
            className={styles.neonInput} 
          />
        </div>

        {/* Блок ФОТО (заглушки) */}
        <div className={styles.photoGrid}>
          <div className={styles.photoBox}><strong>Фото объекта</strong></div>
          <div className={styles.photoBox}><strong>Фото замера</strong></div>
        </div>

        {/* ТА САМАЯ КНОПКА "ВЫКЛЮЧАТЕЛЬ" */}
        <button 
          className={styles.saveButton} 
          onClick={() => onSave(localData)}
        >
          СОХРАНИТЬ ДАННЫЕ КЛИЕНТА
        </button>
      </div>

      <div className={styles.rightColumn}>
        <div className={styles.infoCard}>
          <h3>Служебная информация</h3>
          <p>Менеджер: <span>Админ</span></p>
        </div>
        <div className={styles.infoCard} style={{border: '1px solid #7BFF00'}}>
          <h3>Итог заказа</h3>
          <p>Сумма: 0 ₽</p>
        </div>
      </div>
    </div>
  );
}