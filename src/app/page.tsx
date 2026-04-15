// src/app/page.tsx

import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.container}>
      {/* Наш Grid-контейнер на 2 колонки */}
      <div className={styles.grid}>
        
        {/* Левая колонка - EASY MO CORE */}
        <div className={styles.column}>
          {/* Пустой блок видео 9:16 */}
          <div className={styles.videoBlock}>Здесь будет видео</div>
          {/* Неоновый заголовок */}
          <h1 className={styles.neonTitle}>EASY MO CORE</h1>
          {/* Кнопка Войти (центрована по оси колонки) */}
          <button className={styles.heroButton}>Войти</button>
        </div>

        {/* Правая колонка - CRM мягких окон */}
        <div className={styles.column}>
          {/* Пустой блок видео 9:16 */}
          <div className={styles.videoBlock}>Здесь будет видео</div>
          {/* Белый заголовок */}
          <h1 className={styles.whiteTitle}>CRM мягких окон</h1>
          {/* Кнопка Регистрации (центрована по оси колонки) */}
          <button className={styles.heroButton}>Регистрация</button>
        </div>

        {/* Описание (на всю ширину, под сеткой) */}
        <p className={styles.description}>
          Автоматизированная система проектирования и расчета мягких окон,
          <br />
          созданная профессионалами для профессионалов.
        </p>

      </div>
    </main>
  );
}