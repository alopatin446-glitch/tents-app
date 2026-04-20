'use client';

import { updateClientAction } from './actions';
import React from 'react';
import styles from './KanbanBoard.module.css'; 
import ClientStep from '@/components/calculation/ClientStep';

interface EditModalProps {
  client: any;
  onClose: () => void;
}

export default function EditModal({ client, onClose }: EditModalProps) {

  // Эта функция сработает, когда ты нажмешь "Сохранить" внутри ClientStep
  const handleUpdate = async (updatedData: any) => {
    
    // Формируем объект для базы, превращая пустые строки в null
    const dataToSave = {
      fio: updatedData.fio,
      phone: updatedData.phone,
      address: updatedData.address || null,
      source: updatedData.source || null,
      totalPrice: Number(updatedData.totalPrice) || 0,
      advance: Number(updatedData.advance) || 0,
      balance: (Number(updatedData.totalPrice) || 0) - (Number(updatedData.advance) || 0),
      managerComment: updatedData.managerComment || null,
      engineerComment: updatedData.engineerComment || null,
      paymentType: updatedData.paymentType || null,
      // Добавляем остальные поля из твоей Prisma, если они есть в ClientStep
    };

    const result = await updateClientAction(client.id, dataToSave);

    if (result.success) {
      onClose(); // Закрываем модалку, если всё ок
    } else {
      alert("Ошибка при сохранении в базу данных: " + result.error);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div 
        className={styles.editModal} 
        style={{ 
          width: '1200px', 
          maxWidth: '95vw', 
          height: '95vh', 
          overflowY: 'auto', 
          padding: '20px', 
          background: '#182234',
          borderRadius: '16px',
          position: 'relative'
        }}
      >
        <div style={{ 
          padding: '10px 0', 
          borderBottom: '1px solid rgba(123, 255, 0, 0.2)', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ color: '#7BFF00', margin: 0, fontSize: '1.2rem', textTransform: 'uppercase' }}>
            Редактирование: {client.fio || client.name}
          </h2>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '1.5rem' }}
          >
            ×
          </button>
        </div>

        {/* ClientStep сам управляет своими инпутами, мы просто ловим результат в handleUpdate */}
        <ClientStep
          initialData={client}
          onSave={handleUpdate} 
          onClose={onClose}
        />
      </div>
    </div>
  );
}