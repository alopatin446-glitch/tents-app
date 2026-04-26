'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import styles from './dashboard.module.css';
import { getArchiveOrdersCount } from '@/app/actions';

export default function DashboardPage() {
  const router = useRouter();
  
  // Достаем всё из хука (теперь isLoading тут точно есть)
  const { userName, userOrg, logout, checkAuth, isLoading } = useAuth();
  const [archiveCount, setArchiveCount] = useState<number>(0);

  useEffect(() => {
    // Редирект только если загрузка закончена и пользователя нет
    if (!isLoading && !checkAuth()) {
      router.push('/login');
    }

    async function loadArchiveCount() {
      if (isLoading) return;
      try {
        const result = await getArchiveOrdersCount();
        if (result && typeof result === 'object' && 'success' in result && result.success) {
          setArchiveCount(Number(result.count) || 0);
        }
      } catch (error) {
        console.error('Ошибка загрузки счётчика:', error);
      }
    }
    loadArchiveCount();
  }, [checkAuth, router, isLoading]);

  // Пока проверяем сессию — черный экран загрузки в твоем стиле
  if (isLoading) {
    return (
      <div style={{ 
        background: '#000', height: '100vh', color: '#7BFF00', 
        display: 'flex', alignItems: 'center', justifyContent: 'center', 
        fontFamily: 'monospace' 
      }}>
        СИНХРОНИЗАЦИЯ...
      </div>
    );
  }

  return (
    <main className={styles.container}>
      <header className={styles.dashboardHeader}>
        <div className={styles.headerTitle}>EASY MO CORE | ПАНЕЛЬ УПРАВЛЕНИЯ</div>
        <div className={styles.headerActions}>
          <div 
            className={styles.settingsIcon} 
            onClick={() => router.push('/dashboard/settings/team')}
            style={{ cursor: 'pointer' }}
          >
            ⚙️
          </div>
          
          <div 
            className={styles.userAvatar}
            onClick={() => router.push('/dashboard/settings/profile')}
            style={{ cursor: 'pointer' }}
          >
            <div style={{ color: '#7BFF00', fontSize: '10px', textAlign: 'center', marginTop: '10px' }}>
              {String(userName).charAt(0).toUpperCase()}
            </div>
          </div>
          <button onClick={logout} className={styles.heroButton}>
            ВЫЙТИ
          </button>
        </div>
      </header>

      <div className={styles.column} style={{ marginTop: '90px' }}>
        <h2 className={styles.neonTitle} style={{ marginBottom: '2rem', textAlign: 'center' }}>
          С ВОЗВРАЩЕНИЕМ, {String(userName).toUpperCase()} ИЗ &quot;{String(userOrg).toUpperCase()}&quot;.
        </h2>

        <div className={styles.dashboardGrid} style={{ minHeight: '500px', gap: '20px' }}>
          <div
            className={styles.mainActionCard}
            onClick={() => router.push('/dashboard/new-calculation')}
            style={{ cursor: 'pointer', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}
          >
            <div className={styles.neonIcon} style={{ transform: 'scale(1.2)', marginBottom: '2rem' }}>
              <svg viewBox="0 0 24 24" width="70" height="70" fill="none" stroke="#7BFF00" strokeWidth="1.5">
                <path d="M12 2C12 2 7 8 7 14C7 18 10 20 12 20C14 20 17 18 17 14C17 8 12 2 12 2Z" />
                <circle cx="12" cy="11" r="2" />
                <path d="M7 14L3 17V20L7 18" />
                <path d="M17 14L21 17V20L17 18" />
                <path d="M10 20L12 22L14 20" />
              </svg>
            </div>
            <div className={styles.rocketButton}>СОЗДАТЬ НОВЫЙ РАСЧЕТ</div>
          </div>

          <div className={styles.statsWrapper} style={{ gap: '20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: '1fr 1fr' }}>
            <div className={styles.mainActionCard} onClick={() => router.push('/dashboard/archive')} style={{ padding: '1.5rem', cursor: 'pointer', textAlign: 'center' }}>
              <p className={styles.statLabel} style={{ fontWeight: '700' }}>ГОТОВЫЕ ЗАКАЗЫ</p>
              <p className={styles.statValue} style={{ fontSize: '1.4rem' }}>{archiveCount}</p>
            </div>
            <div className={styles.mainActionCard} style={{ padding: '1.5rem', textAlign: 'center' }}>
              <p className={styles.statLabel} style={{ fontWeight: '700' }}>СРЕДНИЙ ЧЕК</p>
              <p className={styles.statValue} style={{ fontSize: '1.4rem' }}>87,500 ₽</p>
            </div>
            <div className={styles.mainActionCard} style={{ padding: '1.5rem', textAlign: 'center' }}>
              <p className={styles.statLabel} style={{ fontWeight: '700' }}>СУММА ЗА МЕСЯЦ</p>
              <p className={styles.statValue} style={{ fontSize: '1.4rem' }}>2,450,000 ₽</p>
            </div>
            <div className={styles.mainActionCard} onClick={() => router.push('/dashboard/clients')} style={{ padding: '1.5rem', cursor: 'pointer', textAlign: 'center' }}>
              <p className={styles.statLabel} style={{ fontWeight: '700' }}>КЛИЕНТЫ</p>
              <p className={styles.statValue} style={{ fontSize: '1.4rem' }}>124</p>
            </div>
            <div className={styles.mainActionCard} onClick={() => router.push('/dashboard/calendar')} style={{ padding: '1.5rem', cursor: 'pointer', textAlign: 'center' }}>
              <p className={styles.statLabel} style={{ fontWeight: '700' }}>КАЛЕНДАРЬ МОНТАЖЕЙ</p>
              <p className={styles.statValue} style={{ fontSize: '1.4rem' }}>📅 ОТКРЫТЬ</p>
            </div>
            <div className={styles.mainActionCard} style={{ padding: '1.5rem', textAlign: 'center' }}>
              <p className={styles.statLabel} style={{ fontWeight: '700' }}>ПРОГРЕСС ЦЕЛИ</p>
              <div style={{ color: '#7BFF00', fontWeight: 'bold' }}>75%</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}