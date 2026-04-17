'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import styles from './ClientCard.module.css';
import { Client } from './types';

interface ClientCardProps {
  client: Client;
  isSelected: boolean;     // Новое: выбрана ли карточка
  onSelect: () => void;    // Новое: клик ЛКМ (выбор)
  onEdit: () => void;      // Новое: клик ПКМ (быстрое редактирование)
  onOpenFull: () => void;  // Новое: двойной клик (полная карта)
}

export default function ClientCard({ client, isSelected, onSelect, onEdit, onOpenFull }: ClientCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: client.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : 1,
  };

  // Обработчик правого клика (ПКМ)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); // Отключаем стандартное меню браузера
    onEdit();
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      // Динамически добавляем класс .selected, если карточка выбрана
      className={`${styles.card} ${isSelected ? styles.selected : ''}`}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Предотвращаем конфликт, если вдруг дочерний элемент тоже имеет onClick
        e.stopPropagation(); 
        onSelect();
      }}
      onDoubleClick={onOpenFull}
      onContextMenu={handleContextMenu}
    >
      {/* Рисуем галочку, если карточка в режиме выделения */}
      {isSelected && <div className={styles.checkMark}>✓</div>}
      
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