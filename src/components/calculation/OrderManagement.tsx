'use client';

import { useState } from 'react';
import styles from './OrderManagement.module.css';

export default function OrderManagement() {
  // Состояния для дат, сумм и результатов
  const [orderDate, setOrderDate] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [finalAmount, setFinalAmount] = useState(0);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOrderDate(e.target.value);
  };

  const handlePaymentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPaymentAmount(Number(e.target.value));
  };

  const handleFinalAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFinalAmount(Number(e.target.value));
  };

  return (
    <div className={styles.orderGrid}>
      {/* Дата заказа */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Дата заказа</h3>
        <div className={styles.inputGroup}>
          <label>Выберите дату</label>
          <input
            type="date"
            value={orderDate}
            onChange={handleDateChange}
            className={styles.neonInput}
          />
        </div>
      </div>

      {/* Сумма оплаты */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Сумма оплаты</h3>
        <div className={styles.inputGroup}>
          <label>Введите сумму</label>
          <input
            type="number"
            value={paymentAmount}
            onChange={handlePaymentChange}
            className={styles.neonInput}
          />
        </div>
      </div>

      {/* Итоговая сумма */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Итоговая сумма</h3>
        <div className={styles.inputGroup}>
          <label>Введите итоговую сумму</label>
          <input
            type="number"
            value={finalAmount}
            onChange={handleFinalAmountChange}
            className={styles.neonInput}
          />
        </div>
      </div>

      {/* Результаты */}
      <div className={styles.card}>
        <h3 className={styles.resultTitle}>Результат</h3>
        <ul className={styles.resultList}>
          <li>Дата заказа: {orderDate || 'Не выбрана'}</li>
          <li>Сумма оплаты: {paymentAmount || 0} ₽</li>
          <li>Итоговая сумма: {finalAmount || 0} ₽</li>
        </ul>
      </div>
    </div>
  );
}