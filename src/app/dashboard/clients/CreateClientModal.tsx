'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { createClientDeal } from '@/app/lib/actions';
import ClientStep from '@/components/calculation/ClientStep';
import styles from './KanbanBoard.module.css';

export default function CreateClientModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();

  const handleFinalSave = async (formData: any) => {
    try {
      const result = await createClientDeal(formData);

      if (result.success) {
        alert('Успешно сохранено!');
        onClose();
        router.refresh();
      } else {
        alert(result.error || 'Ошибка при сохранении карточки');
      }
    } catch (err) {
      console.error('Ошибка в CreateClientModal:', err);
      alert('Ошибка при сохранении карточки');
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div
        className={styles.editModal}
        style={{
          width: '1000px',
          maxWidth: '95vw',
          height: '90vh',
          overflowY: 'auto',
          padding: '0',
          background: '#0a0a0a',
        }}
      >
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid rgba(0,243,255,0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ color: '#00f3ff', margin: 0, fontSize: '1.2rem' }}>
            НОВЫЙ ЗАКАЗ / КЛИЕНТ
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              cursor: 'pointer',
              fontSize: '1.5rem',
            }}
          >
            ×
          </button>
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