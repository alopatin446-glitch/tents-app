'use client';

import { useState } from 'react';
import QuickCalcModal from './QuickCalcModal';
import styles from './dashboard.module.css';

interface QuickCalcBtnProps {
  priceMap: Record<string, number>;
}

export default function QuickCalcBtn({ priceMap }: QuickCalcBtnProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={styles.quickCard}
        style={{
          textAlign: 'left',
          fontFamily: 'inherit',
          color: 'inherit',
          cursor: 'pointer',
          width: '100%',
        }}
      >
        <span className={`${styles.quickIcon} ${styles.qiGreen}`}>⚡</span>
        <span style={{ display: 'flex', flexDirection: 'column' }}>
          <b>Быстрый расчёт</b>
          <small>Прикинуть розницу</small>
        </span>
      </button>

      {isOpen && (
        <QuickCalcModal
          priceMap={priceMap}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}