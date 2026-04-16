'use client';

import styles from './FastenersStep.module.css';

interface FastenersStepProps {
  onSave: () => void;
}

export default function FastenersStep({ onSave }: FastenersStepProps) {
  return (
    <div className={styles.fastenersGrid}>
      <div className={styles.leftColumn}>
        <h2 className={styles.sectionTitle}>Выбор крепежа</h2>

        <div className={styles.infoBlock}>
          <p className={styles.description}>
            Здесь будет модуль настройки крепежей для всех изделий. Основа
            модуля подключена, логика готова к дальнейшему расширению.
          </p>
        </div>

        <button className={styles.saveButton} onClick={onSave}>
          СОХРАНИТЬ КРЕПЕЖИ
        </button>
      </div>

      <div className={styles.rightColumn}>
        <div className={styles.infoCard}>
          <h3>Статус</h3>
          <p>Раздел подключен к модульной системе и готов к развитию.</p>
        </div>
      </div>
    </div>
  );
}