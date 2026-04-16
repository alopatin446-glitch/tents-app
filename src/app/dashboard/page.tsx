'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const router = useRouter();
  const { checkAuth, logout, userName, userOrg } = useAuth();

  useEffect(() => {
    if (!checkAuth()) {
      router.push('/login');
    }
  }, [checkAuth, router]);

  const handleNewCalculation = () => {
    console.log("Navigating to new calculation...");
    router.push('/dashboard/new-calculation');
  };

  return (
    <main className={styles.container}>
      {/* ВОССТАНОВЛЕННЫЙ ХЕДЕР (Который GPT удалил) */}
      <header className={styles.dashboardHeader}>
        <div className={styles.headerTitle}>EASY MO CORE | ПАНЕЛЬ УПРАВЛЕНИЯ</div>
        <div className={styles.headerActions}>
          <div className={styles.settingsIcon}>⚙️</div>
          <div className={styles.userAvatar}>
             {/* Заглушка аватара */}
             <div style={{ color: '#7BFF00', fontSize: '10px', textAlign: 'center', marginTop: '10px' }}>
               {userName ? userName[0] : 'U'}
             </div>
          </div>
          <button onClick={logout} className={styles.heroButton}>ВЫЙТИ</button>
        </div>
      </header>

      <div className={styles.column} style={{ marginTop: '90px' }}>
        <h2 className={styles.neonTitle} style={{ marginBottom: '2rem', textAlign: 'center' }}>
          С ВОЗВРАЩЕНИЕМ, {userName || 'ПОЛЬЗОВАТЕЛЬ'} ИЗ "{userOrg || 'EASY MO'}".
        </h2>

        <div className={styles.dashboardGrid} style={{ minHeight: '500px', gap: '20px' }}>
          
          {/* ЛЕВАЯ КАРТОЧКА - ИСПРАВЛЕНА И ДОСТУПНА */}
          <div 
            className={styles.mainActionCard} 
            onClick={handleNewCalculation}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleNewCalculation(); }}
            role="button"
            tabIndex={0}
            style={{ 
              cursor: 'pointer', 
              padding: '2rem', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center', 
              alignItems: 'center',
              position: 'relative',
              zIndex: 10
            }}
          >
            <div className={styles.neonIcon} style={{ transform: 'scale(1.2)', marginBottom: '2rem', pointerEvents: 'none' }}>
              <svg viewBox="0 0 24 24" width="70" height="70" fill="none" stroke="#7BFF00" strokeWidth="1.5">
                <path d="M12 2C12 2 7 8 7 14C7 18 10 20 12 20C14 20 17 18 17 14C17 8 12 2 12 2Z" />
                <circle cx="12" cy="11" r="2" />
                <path d="M7 14L3 17V20L7 18" /><path d="M17 14L21 17V20L17 18" /><path d="M10 20L12 22L14 20" />
              </svg>
            </div>
            <div className={styles.rocketButton} style={{ pointerEvents: 'none' }}>
              СОЗДАТЬ НОВЫЙ РАСЧЕТ
            </div>
          </div>

          {/* ПРАВАЯ СЕТКА */}
          <div className={styles.statsWrapper} style={{ gap: '20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: '1fr 1fr' }}>
            {[
              { label: 'ГОТОВЫЕ ЗАКАЗЫ', value: '28' },
              { label: 'СУММА ЗА МЕСЯЦ', value: '2,450,000 ₽' },
              { label: 'ПРОГРЕСС ЦЕЛИ', isGauge: true },
              { label: 'КЛИЕНТЫ', value: '124' },
              { label: 'СРЕДНИЙ ЧЕК', value: '87,500 ₽' },
              { label: 'В ОЖИДАНИИ', value: '5' }
            ].map((item, idx) => (
              <div key={idx} className={styles.mainActionCard} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                <p className={styles.statLabel} style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.8rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {item.label}
                </p>
                {item.isGauge ? (
                  <div className={styles.gaugeWrapper} style={{ transform: 'scale(1.5)', marginTop: '1rem' }}>
                    <svg viewBox="0 0 100 50" width="100">
                      <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                      <path d="M 10 50 A 40 40 0 0 1 70 20" fill="none" stroke="#7BFF00" strokeWidth="8" strokeDasharray="100" />
                    </svg>
                    <div className={styles.gaugeValue} style={{ fontSize: '12px', bottom: '-5px' }}>75%</div>
                  </div>
                ) : (
                  <p className={styles.statValue} style={{ fontSize: '1.4rem', color: '#7BFF00', fontWeight: '600', opacity: 0.9 }}>
                    {item.value}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}