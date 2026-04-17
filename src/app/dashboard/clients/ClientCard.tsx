import React from 'react';
import styles from './ClientCard.module.css';

interface ClientCardProps {
  name: string;
  address: string;
  price: string;
}

export default function ClientCard({ name, address, price }: ClientCardProps) {
  return (
    <div className={styles.card}>
      <span className={styles.clientName}>{name}</span>
      <span className={styles.address}>{address}</span>
      <div className={styles.priceBadge}>{price} ₽</div>
    </div>
  );
}