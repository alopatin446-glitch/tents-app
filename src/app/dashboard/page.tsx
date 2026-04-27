'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import styles from './dashboard.module.css';
import { getArchiveOrdersCount } from '@/app/actions';

export default function DashboardPage() {
  const router = useRouter();
  const { userName, userOrg, logout, checkAuth, isLoading, role, permissions } = useAuth();
  const [archiveCount, setArchiveCount] = useState<number>(0);

  useEffect(() => {
    if (!isLoading && !checkAuth()) {
      router.push('/login');
    }

    async function loadArchiveCount() {
      if (isLoading) return;
      try {
        const result = await getArchiveOrdersCount();
        if (result && typeof result === 'object' && 'success' in result && result.success) {
          setArchiveCount(Number((result as any).count) || 0);
        }
      } catch (error) {
        console.error('Ошибка загрузки счётчика:', error);
      }
    }
    loadArchiveCount();
  }, [checkAuth, router, isLoading]);

  // Улучшенная функция проверки доступа
  const canAccess = (perm: string): boolean => {
    const userRole = String(role || '').toUpperCase();

    // 1. АДМИНУ можно всё
    if (userRole === 'ADMIN') return true;

    // 2. ЕСЛИ ПРАВА ЕСТЬ В МАССИВЕ (из базы)
    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      const searchKey = perm.split(':')[0].toLowerCase();
      const hasDirectPerm = permissions.some(p => {
        const lp = String(p).toLowerCase();
        return lp === perm.toLowerCase() || lp === searchKey || lp.includes(searchKey);
      });
      if (hasDirectPerm) return true;
    }

    // 3. ЗАПАСНОЙ ВАРИАНТ (по роли)
    // Если массив прав пуст, но юзер — сотрудник (USER/ENGINEER), открываем базу
    if (userRole === 'USER' || userRole === 'ENGINEER') {
      const standardPaths = ['calculations:write', 'clients:read', 'archive:read', 'calendar:read'];
      return standardPaths.includes(perm);
    }

    return false;
  };

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
          {String(role).toUpperCase() === 'ADMIN' && (
            <div
              className={styles.settingsIcon}
              onClick={() => router.push('/dashboard/settings/team')}
              style={{ cursor: 'pointer' }}
            >
              ⚙️
            </div>
          )}

          {/* Внутри секции headerActions */}
          <div className={styles.headerActions}>
            {/* Доступ к прайсу только Админу */}
            {role === 'ADMIN' && (
              <button
                onClick={() => router.push('/dashboard/prices')}
                className={styles.heroButton}
                style={{ marginRight: '15px', border: '1px solid #7BFF00', background: 'transparent' }}
              >
                ПРАЙС-ЛИСТ
              </button>
            )}

            {/* ... остальной код (шестеренка, аватар, выйти) */}
          </div>

          <div
            className={styles.userAvatar}
            onClick={() => router.push('/dashboard/settings/profile')}
            style={{ cursor: 'pointer' }}
          >
            <div style={{ color: '#7BFF00', fontSize: '10px', textAlign: 'center', marginTop: '10px' }}>
              {String(userName || 'U').charAt(0).toUpperCase()}
            </div>
          </div>
          <button onClick={logout} className={styles.heroButton}>
            ВЫЙТИ
          </button>
        </div>
      </header>

      <div className={styles.column} style={{ marginTop: '90px' }}>
        <h2 className={styles.neonTitle} style={{ marginBottom: '2rem', textAlign: 'center' }}>
          С ВОЗВРАЩЕНИЕМ, {String(userName || 'ПОЛЬЗОВАТЕЛЬ').toUpperCase()} ИЗ &quot;{String(userOrg || 'ОРГАНИЗАЦИЯ').toUpperCase()}&quot;.
        </h2>

        <div className={styles.dashboardGrid} style={{ minHeight: '500px', gap: '20px' }}>
          {/* Кнопка Расчетов */}
          <div
            className={styles.mainActionCard}
            onClick={() => canAccess('calculations:write') ? router.push('/dashboard/new-calculation') : null}
            style={{
              cursor: canAccess('calculations:write') ? 'pointer' : 'not-allowed',
              opacity: canAccess('calculations:write') ? 1 : 0.4,
              padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'
            }}
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
            <div className={styles.rocketButton}>
              {canAccess('calculations:write') ? 'СОЗДАТЬ НОВЫЙ РАСЧЕТ' : 'ДОСТУП ЗАКРЫТ'}
            </div>
          </div>

          <div className={styles.statsWrapper} style={{ gap: '20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: '1fr 1fr' }}>
            {/* Готовые заказы (Архив) */}
            <div
              className={styles.mainActionCard}
              onClick={() => canAccess('archive:read') ? router.push('/dashboard/archive') : null}
              style={{
                padding: '1.5rem',
                cursor: canAccess('archive:read') ? 'pointer' : 'not-allowed',
                opacity: canAccess('archive:read') ? 1 : 0.5,
                textAlign: 'center'
              }}
            >
              <p className={styles.statLabel} style={{ fontWeight: '700' }}>ГОТОВЫЕ ЗАКАЗЫ</p>
              <p className={styles.statValue} style={{ fontSize: '1.4rem' }}>{canAccess('archive:read') ? archiveCount : '🔒'}</p>
            </div>

            <div className={styles.mainActionCard} style={{ padding: '1.5rem', textAlign: 'center' }}>
              <p className={styles.statLabel} style={{ fontWeight: '700' }}>СРЕДНИЙ ЧЕК</p>
              <p className={styles.statValue} style={{ fontSize: '1.4rem' }}>87,500 ₽</p>
            </div>

            <div className={styles.mainActionCard} style={{ padding: '1.5rem', textAlign: 'center' }}>
              <p className={styles.statLabel} style={{ fontWeight: '700' }}>СУММА ЗА МЕСЯЦ</p>
              <p className={styles.statValue} style={{ fontSize: '1.4rem' }}>2,450,000 ₽</p>
            </div>

            {/* Клиенты */}
            <div
              className={styles.mainActionCard}
              onClick={() => canAccess('clients:read') ? router.push('/dashboard/clients') : null}
              style={{
                padding: '1.5rem',
                cursor: canAccess('clients:read') ? 'pointer' : 'not-allowed',
                opacity: canAccess('clients:read') ? 1 : 0.5,
                textAlign: 'center'
              }}
            >
              <p className={styles.statLabel} style={{ fontWeight: '700' }}>КЛИЕНТЫ</p>
              <p className={styles.statValue} style={{ fontSize: '1.4rem' }}>{canAccess('clients:read') ? '124' : '🔒'}</p>
            </div>

            {/* Календарь */}
            <div
              className={styles.mainActionCard}
              onClick={() => canAccess('calendar:read') ? router.push('/dashboard/calendar') : null}
              style={{
                padding: '1.5rem',
                cursor: canAccess('calendar:read') ? 'pointer' : 'not-allowed',
                opacity: canAccess('calendar:read') ? 1 : 0.5,
                textAlign: 'center'
              }}
            >
              <p className={styles.statLabel} style={{ fontWeight: '700' }}>КАЛЕНДАРЬ МОНТАЖЕЙ</p>
              <p className={styles.statValue} style={{ fontSize: '1.4rem' }}>{canAccess('calendar:read') ? '📅 ОТКРЫТЬ' : '🔒'}</p>
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