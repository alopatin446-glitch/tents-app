'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { TEST_USER } from '@/core/auth/mockUser';
import styles from '../page.module.css';

export default function DashboardPage() {
  const router = useRouter();
  const { checkAuth, logout } = useAuth();

  useEffect(() => {
    if (!checkAuth()) {
      router.push('/login');
    }
  }, [checkAuth, router]);

  const userName = TEST_USER.name;
  const userOrg = TEST_USER.org;

  return (
    <main className={styles.container}>
      <header className={styles.dashboardHeader}>
        <div className={styles.headerTitle}>EASY MO CORE | ПАНЕЛЬ УПРАВЛЕНИЯ</div>
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

      <div className={styles.column} style={{ marginTop: '80px' }}>
        <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
          <h2 className={styles.neonTitle}>
            С ВОЗВРАЩЕНИЕМ, {userName} ИЗ '{userOrg}'.
          </h2>
        </div>

        <div className={styles.dashboardGrid}>
          <div className={styles.mainActionCard}>
            <div style={{ fontSize: '5rem' }}>🚀</div>
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
              <div style={{ width: '100px', margin: '0 auto' }}>
                <svg viewBox="0 0 100 50">
                  <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                  <path d="M 10 50 A 40 40 0 0 1 70 20" fill="none" stroke="#7BFF00" strokeWidth="8" strokeDasharray="100" />
                </svg>
                <div style={{ fontSize: '0.8rem', color: '#7BFF00', fontWeight: 'bold' }}>75%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}