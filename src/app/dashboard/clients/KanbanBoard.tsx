'use client';

import React from 'react';
import styles from './KanbanBoard.module.css';
import ClientCard from './ClientCard';

const STAGES = [
  { id: 'new', title: 'Новые / Замеры' },
  { id: 'calc', title: 'Ожидают расчёт' },
  { id: 'wait', title: 'Дожим' },
  { id: 'work', title: 'Монтаж / Оплата' }
];

export default function KanbanBoard() {
  return (
    <div className={styles.mainWrapper}>
      {/* ЛЕВАЯ ПАНЕЛЬ */}
      <aside className={styles.sidebar}>
        <h2 style={{fontSize: '1.1rem', fontWeight: 800}}>ФИЛЬТРЫ</h2>
        <input type="text" placeholder="Поиск по адресу..." className="neonInput" style={{width: '100%'}} />
        <div style={{marginTop: 'auto'}}>
            <button className="navButton active" style={{width: '100%'}}>+ КЛИЕНТ</button>
        </div>
      </aside>

      {/* КАНБАН */}
      <div className={styles.board}>
        {STAGES.map(stage => (
          <div key={stage.id} className={styles.column}>
            <div className={styles.columnTitle}>
              {stage.title} <span>•</span>
            </div>
            <div className={styles.cardsContainer}>
              {/* Рендерим тестовую карточку для примера */}
              <ClientCard name="Иванов А.П." address="ул. Ленина, д. 10" price="250,000" />
              <ClientCard name="Петров С.В." address="СНТ Ромашка, уч. 45" price="85,000" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}