'use client';

import React, { useState } from 'react';
import styles from './KanbanBoard.module.css';
import StageColumn from './StageColumn'; // Теперь точно найдет
import { Client, Stage } from './types';

const STAGES: Stage[] = [
  { id: 'new', title: 'Новые / Замеры' },
  { id: 'calc', title: 'Ожидают расчёт' },
  { id: 'negotiation', title: 'Дожим' },
  { id: 'install', title: 'Монтаж / Оплата' }
];

export default function KanbanBoard() {
  // Тестовые данные (имитация базы данных)
  const [clients] = useState<Client[]>([
    { id: '1', name: 'Иванов А.П.', address: 'ул. Ленина, д. 10', totalPrice: 250000, status: 'new', phone: '+7 900 123-45-67' },
    { id: '2', name: 'Петров С.В.', address: 'СНТ Ромашка, уч. 45', totalPrice: 85000, status: 'new' },
    { id: '3', name: 'Сидоров К.М.', address: 'ул. Мира, 12', totalPrice: 120000, status: 'calc' },
    { id: '4', name: 'ТехноНиколь', address: 'Промзона, корп. 2', totalPrice: 540000, status: 'install', phone: '8 800 555-35-35' },
  ]);

  return (
    <div className={styles.mainWrapper}>
      {/* ЛЕВАЯ ПАНЕЛЬ: ТЕПЕРЬ С КНОПКАМИ ДОЖИМА */}
      <aside className={styles.sidebar}>
        <h2 style={{fontSize: '1.1rem', fontWeight: 800, color: '#fff'}}>УПРАВЛЕНИЕ</h2>
        <input type="text" placeholder="Поиск по адресу..." className="neonInput" style={{width: '100%'}} />
        
        <div className={styles.quickFilters}>
          <button className={styles.filterBtn}>🔥 ГОРЯЩИЕ</button>
          <button className={styles.filterBtn}>💸 ДОЛЖНИКИ</button>
        </div>

        <div style={{marginTop: 'auto'}}>
            <button className="navButton active" style={{width: '100%', border: '1px solid #7BFF00 !important'}}>
              + НОВЫЙ КЛИЕНТ
            </button>
        </div>
      </aside>

      {/* ПРАВАЯ ПАНЕЛЬ: КАНБАН С КОЛОНКАМИ */}
      <div className={styles.board}>
        {STAGES.map(stage => (
          <StageColumn 
            key={stage.id} 
            stage={stage} 
            clients={clients.filter(c => c.status === stage.id)} 
          />
        ))}
      </div>
    </div>
  );
}