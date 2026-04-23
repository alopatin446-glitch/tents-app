'use client';

import DrawingCanvas from './DrawingCanvas';
import FastenersParams from './FastenersParams';
import styles from './FastenersStep.module.css';

// Исправленный импорт
import { type WindowItem, type FastenerConfig, getInitialFastener } from '@/types';

interface FastenersStepProps {
  windows: WindowItem[];
  activeWindowId: number;
  onActiveWindowChange: (id: number) => void;
  onWindowsChange: (windows: WindowItem[]) => void;
  onSave: (windows: WindowItem[]) => void;
  isReadOnly?: boolean;
}

export default function FastenersStep({
  windows,
  activeWindowId,
  onActiveWindowChange,
  onWindowsChange,
  onSave,
  isReadOnly = false,
}: FastenersStepProps) {
  const activeWindow = windows.find((w) => w.id === activeWindowId);
  
  // Здесь исправлено название функции
  const activeFasteners = activeWindow?.fasteners || getInitialFastener();

  const handleParamsChange = (newConfig: FastenerConfig) => {
    if (!activeWindow) return;
    const updated = windows.map((w) =>
      w.id === activeWindowId ? { ...w, fasteners: newConfig } : w
    );
    onWindowsChange(updated);
  };

  const activeSidesCount = activeFasteners.type === 'none' ? 0 : 
    Object.values(activeFasteners.sides).filter(v => v !== false).length;

  return (
    <div className={styles.fastenersLayout}>
      <div className={styles.leftPanel}>
        <div className={styles.headerRow}>
          <h2 className={styles.sectionTitle}>Крепёж</h2>
          <span className={styles.windowName}>{activeWindow?.name}</span>
        </div>
        
        <FastenersParams
          fasteners={activeFasteners}
          onChange={handleParamsChange}
          isReadOnly={isReadOnly}
        />

        <button 
          className={styles.saveButton} 
          onClick={() => onSave(windows)}
          disabled={isReadOnly}
        >
          СОХРАНИТЬ КРЕПЁЖ
        </button>
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.tabsRow}>
          {windows.map((w, index) => (
            <div
              key={w.id}
              className={`${styles.tabItem} ${activeWindowId === w.id ? styles.activeTab : ''}`}
              onClick={() => onActiveWindowChange(w.id)}
            >
              Окно {index + 1}
            </div>
          ))}
        </div>

        {activeWindow && (
          <div className={styles.drawingWrapper}>
            <DrawingCanvas item={activeWindow} showFasteners />
          </div>
        )}

        {activeWindow && (
          <div className={styles.infoBar}>
            <span className={styles.infoItem}>
              Выбрано: <strong>{activeWindow.name}</strong>
            </span>
            <span className={styles.infoItem}>
              Стороны: <strong>{activeSidesCount} / 4</strong>
            </span>
            <span className={styles.infoItem}>
              Тип: <strong>
                {activeFasteners.type === 'none'
                  ? 'Без крепежа'
                  : activeFasteners.type.replace('_', ' ').toUpperCase()}
              </strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}