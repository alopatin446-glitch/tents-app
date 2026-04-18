'use client';

import React from 'react';
import { createClientDeal } from '@/app/lib/actions';
import ClientStep from '@/components/calculation/ClientStep'; // ПРОВЕРЬ ЭТОТ ПУТЬ
import styles from './KanbanBoard.module.css';

export default function CreateClientModal({ onClose }: { onClose: () => void }) {
  
  const handleFinalSave = async (formData: any) => {
    // Проверка обязательного поля
    if (!formData.fio) return alert('Введите ФИО клиента');
    
    try {
      const result = await createClientDeal(formData);
      
      if (result.success) {
        alert('Сделка успешно сохранена в Neon PostgreSQL!');
        onClose();
        window.location.reload(); // Обновляем страницу, чтобы увидеть карточку
      } else {
        alert('Ошибка при сохранении: ' + result.error);
      }
    } catch (err) {
      console.error(err);
      alert('Произошла критическая ошибка при отправке');
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.editModal} style={{ width: '1000px', maxWidth: '95vw', height: '90vh', overflowY: 'auto', padding: '0', background: '#0a0a0a' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(0,243,255,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ color: '#00f3ff', margin: 0, fontSize: '1.2rem' }}>НОВЫЙ ЗАКАЗ / КЛИЕНТ</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
        </div>
        
        <ClientStep 
            initialData={{ status: 'negotiation' }} 
            onSave={handleFinalSave} 
            onClose={onClose} 
        />
      </div>
    </div>
  );
}