'use client';

import React, { useState } from 'react';
import { createClientDeal } from '@/app/lib/actions'; // Импортируем нашу функцию записи
import styles from './KanbanBoard.module.css';

export default function CreateClientModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    status: 'negotiation',
    totalPrice: 0,
    surveyDate: new Date().toISOString().split('T')[0], // Сегодня по умолчанию
    source: 'Сайт',
    managerComment: ''
  });

  const handleSave = async () => {
    if (!formData.name) return alert('Введите имя клиента');
    
    setLoading(true);
    try {
      const result = await createClientDeal(formData);
      
      if (result.success) {
        alert('Сделка сохранена в PostgreSQL!');
        onClose();
        window.location.reload(); // Обновим страницу, чтобы увидеть новую карточку
      } else {
        alert('Ошибка при сохранении в базу');
      }
    } catch (err) {
      console.error(err);
      alert('Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.editModal} style={{ width: '500px' }}>
        <h3>НОВЫЙ РАСЧЕТ / КЛИЕНТ</h3>
        
        <div className={styles.inputGroup}>
          <label>ФИО КЛИЕНТА</label>
          <input 
            className="neonInput" 
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
          />
        </div>

        <div className={styles.inputGroup}>
          <label>ТЕЛЕФОН</label>
          <input 
            className="neonInput" 
            value={formData.phone}
            onChange={e => setFormData({...formData, phone: e.target.value})}
          />
        </div>

        <div className={styles.inputGroup}>
          <label>АДРЕС</label>
          <input 
            className="neonInput" 
            value={formData.address}
            onChange={e => setFormData({...formData, address: e.target.value})}
          />
        </div>

        <div className={styles.inputGroup}>
          <label>ДАТА ЗАМЕРА</label>
          <input 
            type="date"
            className="neonInput" 
            value={formData.surveyDate}
            onChange={e => setFormData({...formData, surveyDate: e.target.value})}
          />
        </div>

        <div className={styles.inputGroup}>
          <label>ЭТАП (СТАТУС)</label>
          <select 
            className="neonInput"
            value={formData.status}
            onChange={e => setFormData({...formData, status: e.target.value})}
          >
            <option value="negotiation">Общение с клиентом</option>
            <option value="waiting_measure">Ожидает замер</option>
            <option value="promised_pay">Обещал заплатить</option>
            <option value="waiting_production">Ожидает изделия</option>
            <option value="waiting_install">Ожидает монтаж</option>
          </select>
        </div>

        <div className={styles.inputGroup}>
          <label>СУММА ЗАКАЗА (₽)</label>
          <input 
            type="number"
            className="neonInput" 
            value={formData.totalPrice}
            onChange={e => setFormData({...formData, totalPrice: Number(e.target.value)})}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button 
            onClick={handleSave} 
            disabled={loading}
            className="navButton active"
          >
            {loading ? 'СОХРАНЕНИЕ...' : 'СОХРАНИТЬ В БАЗУ'}
          </button>
          <button onClick={onClose} className={styles.filterBtn}>ОТМЕНА</button>
        </div>
      </div>
    </div>
  );
}