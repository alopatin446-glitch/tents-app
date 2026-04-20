'use client';

import styles from './FastenersStep.module.css';

interface FastenersStepProps {
  onSave: () => void;
  isReadOnly?: boolean;
}

export default function FastenersStep({
  onSave,
  isReadOnly = false,
}: FastenersStepProps) {
  return (
    <div className={styles.fastenersGrid}>
      <div className={styles.leftColumn}>
        <h2 className={styles.sectionTitle}>
          {isReadOnly ? 'Выбор крепежа (только просмотр)' : 'Выбор крепежа'}
        </h2>

        <div className={styles.infoBlock}>
          <p className={styles.description}>
            Здесь будет модуль настройки крепежей для всех изделий. Основа
            модуля подключена, логика готова к дальнейшему расширению.
          </p>
        </div>

        {!isReadOnly && (
          <button className={styles.saveButton} onClick={onSave}>
            СОХРАНИТЬ КРЕПЕЖИ
          </button>
        )}
      </div>

      <div className={styles.rightColumn}>
        <div className={styles.infoCard}>
          <h3>Статус</h3>
          <p>
            {isReadOnly
              ? 'Архивный режим: редактирование отключено.'
              : 'Раздел подключен к модульной системе и готов к развитию.'}
          </p>
        </div>
      </div>
    </div>
  );
}