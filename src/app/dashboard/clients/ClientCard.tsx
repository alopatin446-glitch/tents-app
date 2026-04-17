import React from 'react';
import styles from './ClientCard.module.css';
import { Client } from './types';

export default function ClientCard({ client }: { client: Client }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.clientName}>{client.name}</span>
        {/* Индикатор срочности (пока просто точка) */}
        <div className={styles.statusDot}></div>
      </div>
      
      <span className={styles.address}>{client.address}</span>
      
      <div className={styles.cardFooter}>
        <div className={styles.priceBadge}>{client.totalPrice.toLocaleString()} ₽</div>
        {client.phone && <span className={styles.phoneShort}>{client.phone}</span>}
      </div>
    </div>
  );
}