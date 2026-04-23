'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import styles from './dashboard.module.css';
import { getArchiveOrdersCount } from '@/app/actions';

/**
 * Главная страница дашборда.
 *
 * ИСПРАВЛЕНИЯ:
 *
 * 1. checkAuth убрана из useEffect deps.
 *    С useCallback в useAuth она теперь стабильна, но лучше использовать
 *    useRef-паттерн: сохраняем функцию в ref и обращаемся к ней внутри
 *    эффекта через ref.current. Это даёт стабильный эффект без
 *    зависимости от внешних функций и явно документирует намерение.
 *
 * 2. useEffect теперь запускается ОДИН РАЗ при монтировании ([]).
 *    Это правильно: проверка авторизации — одноразовое действие.
 *    Повторная проверка при каждом ре-рендере — антипаттерн.
 *
 * 3. Загрузка archiveCount вынесена в отдельный useEffect с [isReady],
 *    чтобы явно показать зависимость: грузим ТОЛЬКО когда isReady = true.
 *
 * 4. Link заменён прямыми router.push (был неиспользуемый импорт Link).
 */
export default function DashboardPage() {
  const router = useRouter();
  const { checkAuth, logout, userName, userOrg } = useAuth();
  const checkAuthRef = useRef(checkAuth);
  checkAuthRef.current = checkAuth;

  const [archiveCount, setArchiveCount] = useState<number>(0);
  const [isReady, setIsReady] = useState(false);

  const nameStr = String(userName || 'Пользователь');
  const orgStr = String(userOrg || 'EASY MO');

  // Проверка авторизации — один раз при монтировании
  useEffect(() => {
    if (!checkAuthRef.current()) {
      router.push('/login');
      return;
    }
    setIsReady(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // ^ Намеренно пустой массив: проверяем авторизацию только при
  //   первом монтировании, а не при каждом ре-рендере.
  //   checkAuth стабильна (useCallback + [] deps в useAuth),
  //   но через ref — явно документируем намерение.

  // Загрузка счётчика архива — только после подтверждения авторизации
  useEffect(() => {
    if (!isReady) return;

    async function loadArchiveCount() {
      try {
        const result = await getArchiveOrdersCount();
        if (result && 'success' in result && result.success) {
          setArchiveCount(Number(result.count) || 0);
        }
      } catch (error) {
        console.error('Ошибка загрузки счётчика архива:', error);
      }
    }

    loadArchiveCount();
  }, [isReady]); // Запускается один раз: когда isReady переходит в true

  if (!isReady) return null;

  return (
    <main className={styles.container}>
      <header className={styles.dashboardHeader}>
        <div className={styles.headerTitle}>EASY MO CORE | ПАНЕЛЬ УПРАВЛЕНИЯ</div>
        <div className={styles.headerActions}>
          <div className={styles.settingsIcon}>⚙️</div>
          <div className={styles.userAvatar}>
            <div
              style={{
                color: '#7BFF00',
                fontSize: '10px',
                textAlign: 'center',
                marginTop: '10px',
              }}
            >
              {nameStr.charAt(0).toUpperCase()}
            </div>
          </div>
          <button onClick={logout} className={styles.heroButton}>
            ВЫЙТИ
          </button>
        </div>
      </header>

      <div className={styles.column} style={{ marginTop: '90px' }}>
        <h2
          className={styles.neonTitle}
          style={{ marginBottom: '2rem', textAlign: 'center' }}
        >
          С ВОЗВРАЩЕНИЕМ, {nameStr.toUpperCase()} ИЗ &quot;{orgStr.toUpperCase()}&quot;.
        </h2>

        <div
          className={styles.dashboardGrid}
          style={{ minHeight: '500px', gap: '20px' }}
        >
          {/* Карточка создания расчёта */}
          <div
            className={styles.mainActionCard}
            onClick={() => router.push('/dashboard/new-calculation')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ')
                router.push('/dashboard/new-calculation');
            }}
            role="button"
            tabIndex={0}
            style={{
              cursor: 'pointer',
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <div
              className={styles.neonIcon}
              style={{ transform: 'scale(1.2)', marginBottom: '2rem' }}
            >
              <svg
                viewBox="0 0 24 24"
                width="70"
                height="70"
                fill="none"
                stroke="#7BFF00"
                strokeWidth="1.5"
              >
                <path d="M12 2C12 2 7 8 7 14C7 18 10 20 12 20C14 20 17 18 17 14C17 8 12 2 12 2Z" />
                <circle cx="12" cy="11" r="2" />
                <path d="M7 14L3 17V20L7 18" />
                <path d="M17 14L21 17V20L17 18" />
                <path d="M10 20L12 22L14 20" />
              </svg>
            </div>
            <div className={styles.rocketButton}>СОЗДАТЬ НОВЫЙ РАСЧЕТ</div>
          </div>

          {/* Сетка статистики */}
          <div
            className={styles.statsWrapper}
            style={{
              gap: '20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gridTemplateRows: '1fr 1fr',
            }}
          >
            <div
              className={styles.mainActionCard}
              onClick={() => router.push('/dashboard/archive')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ')
                  router.push('/dashboard/archive');
              }}
              role="button"
              tabIndex={0}
              style={{ padding: '1.5rem', cursor: 'pointer', textAlign: 'center' }}
            >
              <p className={styles.statLabel} style={{ fontWeight: '700' }}>
                ГОТОВЫЕ ЗАКАЗЫ
              </p>
              <p className={styles.statValue} style={{ fontSize: '1.4rem' }}>
                {archiveCount}
              </p>
            </div>

            <div
              className={styles.mainActionCard}
              style={{ padding: '1.5rem', textAlign: 'center' }}
            >
              <p className={styles.statLabel} style={{ fontWeight: '700' }}>
                СУММА ЗА МЕСЯЦ
              </p>
              <p className={styles.statValue} style={{ fontSize: '1.4rem' }}>
                2,450,000 ₽
              </p>
            </div>

            <div
              className={styles.mainActionCard}
              style={{ padding: '1.5rem', textAlign: 'center' }}
            >
              <p className={styles.statLabel} style={{ fontWeight: '700' }}>
                ПРОГРЕСС ЦЕЛИ
              </p>
              <div style={{ color: '#7BFF00', fontWeight: 'bold' }}>75%</div>
            </div>

            <div
              className={styles.mainActionCard}
              onClick={() => router.push('/dashboard/clients')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ')
                  router.push('/dashboard/clients');
              }}
              role="button"
              tabIndex={0}
              style={{ padding: '1.5rem', cursor: 'pointer', textAlign: 'center' }}
            >
              <p className={styles.statLabel} style={{ fontWeight: '700' }}>
                КЛИЕНТЫ
              </p>
              <p className={styles.statValue} style={{ fontSize: '1.4rem' }}>
                124
              </p>
            </div>

            <div
              className={styles.mainActionCard}
              style={{ padding: '1.5rem', textAlign: 'center' }}
            >
              <p className={styles.statLabel} style={{ fontWeight: '700' }}>
                СРЕДНИЙ ЧЕК
              </p>
              <p className={styles.statValue} style={{ fontSize: '1.4rem' }}>
                87,500 ₽
              </p>
            </div>

            <div
              className={styles.mainActionCard}
              style={{ padding: '1.5rem', textAlign: 'center' }}
            >
              <p className={styles.statLabel} style={{ fontWeight: '700' }}>
                В ОЖИДАНИИ
              </p>
              <p className={styles.statValue} style={{ fontSize: '1.4rem' }}>
                5
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}