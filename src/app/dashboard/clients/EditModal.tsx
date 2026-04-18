'use client';

import React from 'react';
import styles from './KanbanBoard.module.css'; // Используем стили канбана для единообразия
import ClientStep from '@/components/calculation/ClientStep';
import { createClientDeal } from '@/app/lib/actions'; // Позже заменим на update, пока для теста сборки

interface EditModalProps {
  client: any;
  onClose: () => void;
}

export default function EditModal({ client, onClose }: EditModalProps) {
  
  const handleUpdate = async (updatedData: any) => {
    // Здесь позже будет вызов updateClientDeal, пока просто логируем и закрываем
    console.log('Данные для обновления:', updatedData);
    alert('Функция обновления будет подключена следующим шагом!');
    onClose();
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.editModal} style={{ width: '1200px', maxWidth: '95vw', height: '95vh', overflowY: 'auto', padding: '20', background: '#182234' }}>
        <div style={{ padding: '10px', borderBottom: '1px solid rgba(0,243,255,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ color: '#7BFF00', margin: 0, fontSize: '1.2rem' }}>РЕДАКТИРОВАНИЕ: {client.fio || client.name}</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '1.5rem' }}>×</button>
        </div>

        <ClientStep 
          initialData={client} 
          onSave={handleUpdate} 
          onClose={onClose} 
        />
      </div>
    </div>
  );
}