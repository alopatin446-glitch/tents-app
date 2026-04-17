'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import styles from './KanbanBoard.module.css';
import ClientCard from './ClientCard';
import { Client, Stage } from './types';

interface StageColumnProps {
  stage: Stage;
  clients: Client[];
  id: string;
  selectedIds: string[]; // Список всех выбранных ID
  onClientSelect: (id: string) => void; // Функция выбора (ЛКМ)
  onClientEdit: (client: Client) => void; // Функция редактирования (ПКМ)
  onClientOpenFull: (client: Client) => void; // Функция открытия карты (2хЛКМ)
}

export default function StageColumn({ 
  stage, 
  clients, 
  id, 
  selectedIds, 
  onClientSelect, 
  onClientEdit, 
  onClientOpenFull 
}: StageColumnProps) {
  const { setNodeRef } = useDroppable({ id });
  const totalSum = clients.reduce((acc, client) => acc + client.totalPrice, 0);

  return (
    <div ref={setNodeRef} className={styles.column}>
      <div className={styles.columnTitle}>
        <div>{stage.title}</div>
        <div style={{ fontSize: '0.7rem', color: 'rgba(123, 255, 0, 0.6)' }}>
          {clients.length} шт. | {totalSum.toLocaleString()} ₽
        </div>
      </div>
      <div className={styles.cardsContainer}>
        {clients.map(client => (
          <ClientCard 
            key={client.id} 
            client={client} 
            isSelected={selectedIds.includes(client.id)} // Проверяем, выбран ли этот клиент
            onSelect={() => onClientSelect(client.id)}
            onEdit={() => onClientEdit(client)}
            onOpenFull={() => onClientOpenFull(client)}
          />
        ))}
      </div>
    </div>
  );
}