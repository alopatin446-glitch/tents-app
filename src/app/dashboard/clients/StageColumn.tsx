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
  selectedIds: string[];
  onClientSelect: (id: string) => void;
  onClientEdit: (client: Client) => void;
  onClientOpenFull: (client: Client) => void;
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
  const totalSum = clients.reduce((acc, client) => acc + (client.totalPrice || 0), 0);

  return (
    <div ref={setNodeRef} className={styles.column}>
      {/* Шапка колонки с названием и итогами */}
      <div className={styles.columnHeader}>
        <h3 className={styles.columnTitle}>{stage.title}</h3>
        <div className={styles.columnMeta}>
          {clients.length} шт. | {totalSum.toLocaleString()} ₽
        </div>
      </div>

      {/* Контейнер для карточек */}
      <div className={styles.cardsContainer}>
        {clients.map(client => (
          <ClientCard 
            key={client.id} 
            client={client} 
            isSelected={selectedIds.includes(client.id)}
            onSelect={() => onClientSelect(client.id)}
            onEdit={() => onClientEdit(client)}
            onOpenFull={() => onClientOpenFull(client)}
          />
        ))}
      </div>
    </div>
  );
}