'use client';

import React from 'react';
import styles from './KanbanBoard.module.css';
import ClientCard from './ClientCard';
import { Client, Stage } from './types';

// Проверь, чтобы здесь было 'export default'
export default function StageColumn({ stage, clients }: { stage: Stage, clients: Client[] }) {
  const totalSum = clients.reduce((acc, client) => acc + client.totalPrice, 0);

  return (
    <div className={styles.column}>
      <div className={styles.columnTitle}>
        <div>
          {stage.title}
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
            {clients.length} шт. — {totalSum.toLocaleString()} ₽
          </div>
        </div>
      </div>

      <div className={styles.cardsContainer}>
        {clients.map(client => (
          <ClientCard key={client.id} client={client} />
        ))}
      </div>
    </div>
  );
}