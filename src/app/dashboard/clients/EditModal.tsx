'use client';

import React from 'react';
import styles from './Modal.module.css';
import { Client } from './types';

interface EditModalProps {
  client: Client;
  onClose: () => void;
}

export default function EditModal({ client, onClose }: EditModalProps) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>×</button>
        <h2 className={styles.title}>Редактировать клиента</h2>
        
        <div className={styles.formGroup}>
          <label className={styles.label}>Имя / Компания</label>
          <input className={styles.input} defaultValue={client.name} />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Адрес объекта</label>
          <input className={styles.input} defaultValue={client.address} />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Сумма сделки (₽)</label>
          <input className={styles.input} type="number" defaultValue={client.totalPrice} />
        </div>

        <button className={styles.saveBtn} onClick={onClose}>
          СОХРАНИТЬ ИЗМЕНЕНИЯ
        </button>
      </div>
    </div>
  );
}