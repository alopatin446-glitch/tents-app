'use client';

import { updateClientAction } from './actions';
import React from 'react';
import styles from './KanbanBoard.module.css';
import ClientStep from '@/components/calculation/ClientStep';

interface EditModalProps {
  client: any;
  onClose: () => void;
}

function normalizeStatus(status: unknown) {
  const raw = String(status || '').trim();

  const statusMap: Record<string, string> = {
    negotiation: 'negotiation',
    waiting_measure: 'waiting_measure',
    promised_pay: 'promised_pay',
    waiting_production: 'waiting_production',
    waiting_install: 'waiting_install',
    special_case: 'special_case',
    completed: 'completed',
    rejected: 'rejected',

    'Общение с клиентом': 'negotiation',
    'Ожидает замер': 'waiting_measure',
    'Обещал заплатить': 'promised_pay',
    'Ожидает изделия': 'waiting_production',
    'Ожидает монтаж': 'waiting_install',
    'Особые случаи': 'special_case',
    'Сделка успешна': 'completed',
    'Успешно': 'completed',
    'Отказ': 'rejected',
    'Провалено': 'rejected',
  };

  return statusMap[raw] || 'special_case';
}

export default function EditModal({ client, onClose }: EditModalProps) {
  const handleUpdate = async (updatedData: any) => {
    const nextTotalPrice = Number(updatedData.totalPrice) || 0;
    const nextAdvance = Number(updatedData.advance) || 0;

    const dataToSave = {
      fio: updatedData.fio,
      phone: updatedData.phone,
      address: updatedData.address || null,
      source: updatedData.source || null,

      status: normalizeStatus(updatedData.status ?? client.status),

      totalPrice: nextTotalPrice,
      advance: nextAdvance,
      balance:
        updatedData.balance !== undefined &&
        updatedData.balance !== null &&
        String(updatedData.balance).trim() !== ''
          ? Number(updatedData.balance) || 0
          : nextTotalPrice - nextAdvance,

      managerComment: updatedData.managerComment || null,
      engineerComment: updatedData.engineerComment || null,
      paymentType: updatedData.paymentType || null,

      measurementDate: updatedData.measurementDate || null,
      installDate: updatedData.installDate || null,

      items: updatedData.items ?? client.items ?? null,
    };

    const result = await updateClientAction(client.id, dataToSave);

    if (result.success) {
      onClose();
    } else {
      alert('Ошибка при сохранении в базу данных: ' + result.error);
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
          position: 'relative',
        }}
      >
        <div
          style={{
            padding: '10px 0',
            borderBottom: '1px solid rgba(123, 255, 0, 0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <h2
            style={{
              color: '#7BFF00',
              margin: 0,
              fontSize: '1.2rem',
              textTransform: 'uppercase',
            }}
          >
            Редактирование: {client.fio || client.name}
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
          initialData={client}
          onSave={handleUpdate}
          onClose={onClose}
        />
      </div>
    </div>
  );
}