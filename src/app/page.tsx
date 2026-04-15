import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.container}>
      <div className={styles.grid}>
        {/* ЛЕВАЯ ОСЬ */}
        <div className={styles.column}>
          <div className={styles.videoBlock}>Здесь будет видео</div>
          <h1 className={styles.neonTitle}>EASY MO CORE</h1>
          <Link href="/login" className={styles.heroButton}>
            Войти
          </Link>
        </div>

        {/* ПРАВАЯ ОСЬ */}
        <div className={styles.column}>
          <div className={styles.videoBlock}>Здесь будет видео</div>
          <h1 className={styles.whiteTitle}>CRM мягких окон</h1>
          <Link href="/register" className={styles.heroButton}>
            Регистрация
          </Link>
        </div>

        {/* ОБЩИЙ ПОДВАЛ (Центровка по красной линии) */}
        <p className={styles.description}>
          Автоматизированная система проектирования и расчета мягких окон,
          <br />
          созданная профессионалами для профессионалов.
        </p>
      </div>
    </main>
  );
}