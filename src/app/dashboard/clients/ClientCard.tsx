'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import styles from './ClientCard.module.css';
import { Client } from './types';

// Добавляем onClick в интерфейс пропсов
interface ClientCardProps {
  client: Client;
  onClick: () => void; 
}

export default function ClientCard({ client, onClick }: ClientCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: client.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1, // Чтобы карточка была полупрозрачной при таскании
    zIndex: isDragging ? 999 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={styles.card}
      {...attributes}
      {...listeners}
      onClick={onClick} // Вешаем клик на всю карточку
    >
      <div className={styles.cardHeader}>
        <span className={styles.clientName}>{client.name}</span>
        <div className={styles.statusDot}></div>
      </div>
      <span className={styles.address}>{client.address}</span>
      <div className={styles.cardFooter}>
        <div className={styles.priceBadge}>{client.totalPrice.toLocaleString()} ₽</div>
      </div>
    </div>
  );
}