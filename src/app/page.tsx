import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.container}>
      
      {/* Используем homeGrid вместо обычного grid */}
      <div className={styles.homeGrid}>
        
        {/* ЛЕВАЯ КОЛОНКА */}
        <div className={styles.homeColumn}>
          <div className={styles.videoBlock}>Здесь будет видео</div>
          <h1 className={styles.neonTitle}>EASY MO CORE</h1>
          {/* Сделаем кнопку зеленой для красоты входа */}
          <Link href="/login" className={styles.loginButton} style={{maxWidth: '200px'}}>
            Войти
          </Link>
        </div>

        {/* ПРАВАЯ КОЛОНКА */}
        <div className={styles.homeColumn}>
          <div className={styles.videoBlock}>Здесь будет видео</div>
          <h1 className={styles.whiteTitle}>CRM МЯГКИХ ОКОН</h1>
          <Link href="/register" className={styles.loginButton} style={{maxWidth: '200px', borderColor: '#fff', color: '#fff'}}>
            Регистрация
          </Link>
        </div>

        <p className={styles.description}>
          Автоматизированная система проектирования и расчета мягких окон,
          <br />
          созданная профессионалами для профессионалов!
        </p>
      </div>
    </main>
  );
}