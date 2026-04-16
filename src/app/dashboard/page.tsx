'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import styles from '../page.module.css';

export default function DashboardPage() {
  const router = useRouter();
  const { checkAuth, logout, userName, userOrg } = useAuth();

  useEffect(() => {
    if (!checkAuth()) {
      router.push('/login');
    }
  }, [checkAuth, router]);

  return (
    <main className={styles.container}>
      {/* ПРЕМИУМ ХЕДЕР НА ВСЮ ШИРИНУ */}
      <header className={styles.dashboardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {/* БУРГЕР-МЕНЮ (SVG) */}
          <div className={styles.burgerMenu}>
            <svg viewBox="0 0 100 80" width="20" height="20">
              <rect width="100" height="15" rx="8" fill="#7BFF00"></rect>
              <rect y="30" width="100" height="15" rx="8" fill="#7BFF00"></rect>
              <rect y="60" width="100" height="15" rx="8" fill="#7BFF00"></rect>
            </svg>
          </div>
          <div className={styles.headerTitle}>EASY MO CORE | ПАНЕЛЬ УПРАВЛЕНИЯ</div>
        </div>

        <div className={styles.headerActions}>
          <span className={styles.settingsIcon}>⚙️</span>
          <div className={styles.userAvatar}>
            <img src="/avatar-placeholder.png" alt="User" />
          </div>
          <button onClick={logout} className={styles.heroButton}>
            ВЫЙТИ
          </button>
        </div>
      </header>

      <div className={styles.column} style={{ marginTop: '100px' }}>
        {/* ПРИВЕТСТВИЕ */}
        <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
          <h2 className={styles.neonTitle}>
            С ВОЗВРАЩЕНИЕМ, {userName} ИЗ '{userOrg}'.
          </h2>
        </div>

        {/* ГРИД ПАНЕЛИ (1fr 2fr) */}
        <div className={styles.dashboardGrid}>
         {/* ЛЕВАЯ КАРТОЧКА (ОБНОВЛЕННАЯ РАКЕТА) */}
        <div className={styles.mainActionCard}>
          <div className={styles.neonIcon}>
            {/* Новая SVG Ракета (из референса) */}
            <svg viewBox="0 0 24 24" width="80" height="80" fill="none" stroke="#7BFF00" strokeWidth="1.5">
              <path d="M4.5 16.5c-1.5 1.5-1.5 3.5 0 5s3.5 1.5 5 0M15 3c6 0 6 0 6 6s-6 12-12 12-4-4-4-4l2-2 3 3 5-5-5-5 3-3Z" />
              <path d="M11 13c1.1 1.1 1.1 2.9 0 4s-2.9 1.1-4 0M17 7c.6.6.6 1.4 0 2s-1.4.6-2 0 .6-1.4 0-2 1.4-.6 2 0Z" />
            </svg>
          </div>
          {/* Используем наш новый класс rocketButton */}
          <button className={styles.rocketButton}>СОЗДАТЬ НОВЫЙ РАСЧЕТ</button>
        </div>

          {/* ПРАВАЯ СЕТКА (3x2) */}
          <div className={styles.statsWrapper}>
            {/* Карточка 1 */}
            <div className={styles.statCard}>
              <p className={styles.statLabel}>ГОТОВЫЕ ЗАКАЗЫ</p>
              <p className={styles.statValue}>28</p>
            </div>
            {/* Карточка 2 */}
            <div className={styles.statCard}>
              <p className={styles.statLabel}>ОБЩАЯ СУММА ЗА МЕСЯЦ</p>
              <p className={styles.statValue}>2,450,000 ₽</p>
            </div>
            {/* Карточка 3 */}
            <div className={styles.statCard}>
              <p className={styles.statLabel}>ПРОГРЕСС ЦЕЛИ</p>
              <div className={styles.gaugeWrapper}>
                <svg viewBox="0 0 100 50">
                  <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                  <path d="M 10 50 A 40 40 0 0 1 70 20" fill="none" stroke="#7BFF00" strokeWidth="10" strokeDasharray="100" className={styles.gaugeProgress} />
                </svg>
                <div className={styles.gaugeValue}>75%</div>
              </div>
            </div>

            {/* ВТОРОЙ РЯД (Новые карточки) */}
            {/* Карточка 4 */}
            <div className={styles.statCard}>
              <p className={styles.statLabel}>АКТИВНЫЕ КЛИЕНТЫ</p>
              <p className={styles.statValue}>124</p>
            </div>
            {/* Карточка 5 */}
            <div className={styles.statCard}>
              <p className={styles.statLabel}>СРЕДНИЙ ЧЕК</p>
              <p className={styles.statValue}>87,500 ₽</p>
            </div>
            {/* Карточка 6 */}
            <div className={styles.statCard}>
              <p className={styles.statLabel}>В ОЖИДАНИИ</p>
              <p className={styles.statValue}>5</p>
            </div>
          </div> {/* Конец statsWrapper */}
        </div> {/* Конец dashboardGrid */}
      </div> {/* Закрытие contentSection (проверь, есть ли он у тебя выше) */}
    </main>
  );
}