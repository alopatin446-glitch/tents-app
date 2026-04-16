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
      <header className={styles.dashboardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
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
        <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
          <h2 className={styles.neonTitle}>
            С ВОЗВРАЩЕНИЕМ, {userName} ИЗ '{userOrg}'.
          </h2>
        </div>

        <div className={styles.dashboardGrid}>
          <div className={styles.mainActionCard}>
            <div className={styles.neonIcon}>
              <svg viewBox="0 0 24 24" width="80" height="80">
                <path fill="none" stroke="#7BFF00" strokeWidth="1.5" d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71zM12 18l6.79 3 .71-.71z"></path>
                <circle cx="12" cy="12" r="3" fill="none" stroke="#7BFF00" strokeWidth="1.5"></circle>
              </svg>
            </div>
            <button className={styles.heroButton}>СОЗДАТЬ НОВЫЙ РАСЧЕТ</button>
          </div>

          <div className={styles.statsWrapper}>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>ГОТОВЫЕ ЗАКАЗЫ</p>
              <p className={styles.statValue}>28</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statLabel}>ОБЩАЯ СУММА ЗА МЕСЯЦ</p>
              <p className={styles.statValue}>2,450,000 ₽</p>
            </div>
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
          </div>
        </div>
      </div>
    </main>
  );
}