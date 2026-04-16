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
        <div className={styles.dashboardGrid} style={{ minHeight: '520px', alignItems: 'stretch', gap: '25px' }}>
          {/* ЛЕВАЯ КАРТОЧКА (РАКЕТА) */}
          <div className={styles.mainActionCard} style={{ padding: '3.5rem 2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <div className={styles.neonIcon} style={{ transform: 'scale(1.4)', marginBottom: '2.5rem' }}>
              <svg viewBox="0 0 24 24" width="80" height="80" fill="none" stroke="#7BFF00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C12 2 7 8 7 14C7 18 10 20 12 20C14 20 17 18 17 14C17 8 12 2 12 2Z" />
                <circle cx="12" cy="11" r="2" />
                <path d="M7 14L3 17V20L7 18" />
                <path d="M17 14L21 17V20L17 18" />
                <path d="M10 20L12 22L14 20" />
              </svg>
            </div>
            <button className={styles.rocketButton} style={{ width: '100%', maxWidth: '220px' }}>СОЗДАТЬ НОВЫЙ РАСЧЕТ</button>
          </div>

          {/* ПРАВАЯ СЕТКА (3x2) */}
          <div className={styles.statsWrapper} style={{ gap: '25px', display: 'grid', gridTemplateRows: '1fr 1fr' }}>
            {/* Карточка 1 */}
            <div className={styles.mainActionCard} style={{ padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
              <p className={styles.statLabel} style={{ fontSize: '2.2rem', fontWeight: '800', marginBottom: '0.5rem' }}>ГОТОВЫЕ ЗАКАЗЫ</p>
              <p className={styles.statValue} style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.6)' }}>28</p>
            </div>

            {/* Карточка 2 */}
            <div className={styles.mainActionCard} style={{ padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
              <p className={styles.statLabel} style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '0.5rem' }}>СУММА ЗА МЕСЯЦ</p>
              <p className={styles.statValue} style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.6)' }}>2,450,000 ₽</p>
            </div>

            {/* Карточка 3 (СПИДОМЕТР) */}
            <div className={styles.mainActionCard} style={{ padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden' }}>
              <p className={styles.statLabel} style={{ fontSize: '1.5rem', fontWeight: '800', textAlign: 'center' }}>ПРОГРЕСС ЦЕЛИ</p>
              <div className={styles.gaugeWrapper} style={{ marginTop: '2.5rem', transform: 'scale(1.8)', transformOrigin: 'center' }}>
                <svg viewBox="0 0 100 50">
                  <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                  <path d="M 10 50 A 40 40 0 0 1 70 20" fill="none" stroke="#7BFF00" strokeWidth="10" strokeDasharray="100" className={styles.gaugeProgress} />
                </svg>
                <div className={styles.gaugeValue} style={{ fontSize: '10px' }}>75%</div>
              </div>
            </div>

            {/* ВТОРОЙ РЯД */}
            {/* Карточка 4 */}
            <div className={styles.mainActionCard} style={{ padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
              <p className={styles.statLabel} style={{ fontSize: '2.2rem', fontWeight: '800', marginBottom: '0.5rem' }}>КЛИЕНТЫ</p>
              <p className={styles.statValue} style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.6)' }}>124</p>
            </div>

            {/* Карточка 5 */}
            <div className={styles.mainActionCard} style={{ padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
              <p className={styles.statLabel} style={{ fontSize: '2.2rem', fontWeight: '800', marginBottom: '0.5rem' }}>СРЕДНИЙ ЧЕК</p>
              <p className={styles.statValue} style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.6)' }}>87,500 ₽</p>
            </div>

            {/* Карточка 6 */}
            <div className={styles.mainActionCard} style={{ padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
              <p className={styles.statLabel} style={{ fontSize: '2.2rem', fontWeight: '800', marginBottom: '0.5rem' }}>ОЖИДАНИЕ</p>
              <p className={styles.statValue} style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.6)' }}>5</p>
            </div>
          </div> {/* Конец statsWrapper */}
        </div> {/* Конец dashboardGrid */}
      </div> {/* Конец column */}
    </main>
  );
}