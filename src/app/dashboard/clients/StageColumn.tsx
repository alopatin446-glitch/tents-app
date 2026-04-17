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
  onClientClick: (client: Client) => void; // Добавили описание функции
}

export default function StageColumn({ stage, clients, id, onClientClick }: StageColumnProps) {
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
            onClick={() => onClientClick(client)} // Передаем клик в карточку
          />
        ))}
      </div>
    </div>
  );
}