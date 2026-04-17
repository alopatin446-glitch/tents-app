'use client';

import React, { useState } from 'react';
import { useClients } from './ClientContext';
import { Client } from './types';
import styles from './KanbanBoard.module.css'; // Используем те же стили для модалки

export default function CreateClientModal({ onClose }: { onClose: () => void }) {
  const { addClient } = useClients();

  // Начальные данные как на твоих скринах
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    status: 'negotiation' as Client['status'],
    totalPrice: 0
  });

  const handleSave = () => {
    if (!formData.name) return alert('Введите имя клиента');

    const newClient: Client = {
      id: Date.now().toString(), // Временный ID
      companyId: 'my-company-1', // Задел на будущее
      ...formData,
      createdAt: new Date().toISOString(),
      products: [] // Пока пустой массив изделий
    };

    addClient(newClient);
    onClose();
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
          <label>ЭТАП (СТАТУС)</label>
          <select 
            className="neonInput"
            value={formData.status}
            onChange={e => setFormData({...formData, status: e.target.value as Client['status']})}
          >
            <option value="negotiation">Общение с клиентом</option>
            <option value="waiting_measure">Ожидает замер</option>
            <option value="promised_pay">Обещал заплатить</option>
            <option value="waiting_production">Ожидает изделия</option>
            <option value="waiting_install">Ожидает монтаж</option>
            <option value="special_case">Особые случаи</option>
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
          <button onClick={handleSave} className="navButton active">СОХРАНИТЬ</button>
          <button onClick={onClose} className={styles.filterBtn}>ОТМЕНА</button>
        </div>
      </div>
    </div>
  );
}