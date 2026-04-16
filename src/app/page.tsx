import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    /* ВЕСЬ ЭКРАН: использует наш темно-синий фон #182234 */
    <main className={styles.container}>
      
      {/* СЕТКА: разделяет экран на две части (Лево и Право) */}
      <div className={styles.grid}>
        
        {/* ЛЕВАЯ КОЛОНКА (EASY MO CORE) */}
        <div className={styles.column}>
          {/* Заглушка под видео — будет в неоновой рамке */}
          <div className={styles.videoBlock}>Здесь будет видео</div>
          
          {/* Наш фирменный неоновый заголовок */}
          <h1 className={styles.neonTitle}>EASY MO CORE</h1>
          
          {/* Кнопка входа: теперь Montserrat и с неоновым эффектом */}
          <Link href="/login" className={styles.heroButton}>
            Войти
          </Link>
        </div>

        {/* ПРАВАЯ КОЛОНКА (CRM) */}
        <div className={styles.column}>
          {/* Второе видео */}
          <div className={styles.videoBlock}>Здесь будет видео</div>
          
          {/* Белый заголовок для контраста (тоже Montserrat) */}
          <h1 className={styles.whiteTitle}>CRM МЯГКИХ ОКОН</h1>
          
          {/* Кнопка регистрации: используем тот же класс, что и для входа */}
          <Link href="/register" className={styles.heroButton}>
            Регистрация
          </Link>
        </div>

        {/* НИЖНИЙ ТЕКСТ: общий для обеих колонок */}
        <p className={styles.description}>
          Автоматизированная система проектирования и расчета мягких окон,
          <br />
          созданная профессионалами для профессионалов.
        </p>
      </div>
    </main>
  );
}