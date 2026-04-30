'use client';

import React, { useState } from 'react';
import { WindowItem } from '@/types';
import CuttingCanvas from './CuttingCanvas';
// Импортируем стили от ItemsStep, чтобы сетка была один-в-один
import styles from './ItemsStep.module.css';

interface ProductionStepProps {
  windows: WindowItem[];
  activeWindowId: number;
  onActiveWindowChange: (id: number) => void;
}

export default function ProductionStep({ 
  windows, 
  activeWindowId, 
  onActiveWindowChange 
}: ProductionStepProps) {
  
  const [rollWidth, setRollWidth] = useState(1400);
  const activeWindow = windows.find(w => w.id === activeWindowId);

  return (
    <div className={styles.itemsGrid}>
      {/* ЛЕВАЯ ПАНЕЛЬ (Клон панели управления) */}
      <aside className={styles.inputPanelWrapper}>
        <div className={styles.formSection}>
          <h4>Параметры материала</h4>
          <div className={styles.selectWrapper}>
            <select 
              className={styles.selectInput}
              value={rollWidth}
              onChange={(e) => setRollWidth(Number(e.target.value))}
            >
              <option value={1400}>Рулон 1400 мм</option>
              <option value={2000}>Рулон 2000 мм</option>
              <option value={2500}>Рулон 2500 мм</option>
            </select>
          </div>
        </div>

        <div className={styles.formSection}>
          <h4>Список изделий</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '60vh' }}>
            {windows.map((win) => (
              <div 
                key={win.id}
                onClick={() => onActiveWindowChange(win.id)}
                className={styles.tabItem}
                style={{ 
                  background: activeWindowId === win.id ? '#7BFF00' : 'rgba(255,255,255,0.05)',
                  color: activeWindowId === win.id ? '#111827' : 'white',
                  cursor: 'pointer',
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none'
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{win.name}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                  {win.widthBottom} x {win.heightLeft} мм
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ПРАВАЯ ПАНЕЛЬ (Клон DrawingWrapper) */}
      <main style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className={styles.drawingWrapper} style={{ flex: 1, display: 'flex' }}>
          {activeWindow ? (
            <CuttingCanvas windowItem={activeWindow} rollWidth={rollWidth} />
          ) : (
            <div className="flex h-full items-center justify-center text-white/20">
              Выберите окно
            </div>
          )}
        </div>

        {/* Инфо-баг снизу */}
        <div className={styles.bottomInfoBar}>
          <div className={styles.statLabel}>
            Изделие: <span>{activeWindow?.name || '—'}</span>
          </div>
          <div className={styles.statLabel}>
            Режим: <span style={{ color: '#7BFF00' }}>ИТОГОВЫЙ КРОЙ</span>
          </div>
        </div>
      </main>
    </div>
  );
}