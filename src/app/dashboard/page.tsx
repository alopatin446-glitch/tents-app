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
            <svg viewBox="0 0 24 24" width="80" height="80" fill="none" stroke="#7BFF00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {/* Корпус ракеты */}
              <path d="M12 2C12 2 7 8 7 14C7 18 10 20 12 20C14 20 17 18 17 14C17 8 12 2 12 2Z" />
              {/* Иллюминатор */}
              <circle cx="12" cy="11" r="2" />
              {/* Левое крыло */}
              <path d="M7 14L3 17V20L7 18" />
              {/* Правое крыло */}
              <path d="M17 14L21 17V20L17 18" />
              {/* Сопло/Пламя */}
              <path d="M10 20L12 22L14 20" />
            </svg>
          </div>
          {/* Используем наш новый класс rocketButton */}
          <button className={styles.rocketButton}>СОЗДАТЬ НОВЫЙ РАСЧЕТ</button>
        </div>

          {/* ПРАВАЯ СЕТКА (3x2) */}
          <div className={styles.statsWrapper}>
            {/* Карточка 1 — УВЕЛИЧЕННАЯ */}
            <div className={styles.mainActionCard} style={{ padding: '2.5rem 2rem' }}>
              <p className={styles.statLabel}>ГОТОВЫЕ ЗАКАЗЫ</p>
              <p className={styles.statValue} style={{ fontSize: '2.2rem', marginTop: '1rem' }}>28</p>
            </div>
            {/* Карточка 2 */}
            <div className={styles.mainActionCard}>
              <p className={styles.statLabel}>ОБЩАЯ СУММА ЗА МЕСЯЦ</p>
              <p className={styles.statValue}>2,450,000 ₽</p>
            </div>
            {/* Карточка 3 */}
            <div className={styles.mainActionCard}>
              <p className={styles.statLabel}>ПРОГРЕС ЦЕЛИ</p>
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
            <div className={styles.mainActionCard}>
              <p className={styles.statLabel}>АКТИВНЫЕ КЛИЕНТЫ</p>
              <p className={styles.statValue}>124</p>
            </div>
            {/* Карточка 5 */}
            <div className={styles.mainActionCard}>
              <p className={styles.statLabel}>СРЕДНИЙ ЧЕК</p>
              <p className={styles.statValue}>87,500 ₽</p>
            </div>
            {/* Карточка 6 */}
            <div className={styles.mainActionCard}>
              <p className={styles.statLabel}>В ОЖИДАНИИ</p>
              <p className={styles.statValue}>5</p>
            </div>
          </div> {/* Конец statsWrapper */}
        </div> {/* Конец dashboardGrid */}
      </div> {/* Закрытие contentSection (проверь, есть ли он у тебя выше) */}
    </main>
  );
}