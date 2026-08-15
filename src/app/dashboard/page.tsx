import Link from 'next/link';
import { requireAuth } from '@/lib/auth/requireAuth';
import { prisma } from '@/lib/prisma';
import { normalizeStatus } from '@/lib/logic/statusDictionary';
import styles from './dashboard.module.css';
import NewClientBtn from './NewClientBtn'; 
import QuickCalcBtn from './QuickCalcBtn'; // 🔥 Импорт теперь на правильном месте!

const MONTH_PLAN = 2_450_000; // план месяца, ₽ — позже вынести в настройки организации

const STATUS_META: Record<string, { label: string; cls: string }> = {
  negotiation: { label: 'Заявка', cls: 'stNegotiation' },
  measurement: { label: 'Замер', cls: 'stMeasurement' },
  production: { label: 'Производство', cls: 'stProduction' },
  ready: { label: 'Монтаж', cls: 'stReady' },
  completed: { label: 'Успешно', cls: 'stCompleted' },
  rejected: { label: 'Отказ', cls: 'stRejected' },
};

const fmtMoney = (n: number) => `${n.toLocaleString('ru-RU')} ₽`;

export default async function DashboardPage() {
  const user = await requireAuth();
  const orgId = user.organizationId;

  const now = new Date();
  const d = (y: number, m: number, day: number) => new Date(y, m, day);
  const startOfToday = d(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = d(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const startOfMonth = d(now.getFullYear(), now.getMonth(), 1);

  const [
    measurementsToday, mountsToday, newRequestsToday, debtorsCount, overdueCount, recentOrders, monthAgg, clientsMonth, pricingData
  ] = await Promise.all([
    prisma.client.count({ where: { organizationId: orgId, measurementDate: { gte: startOfToday, lt: endOfToday } } }),
    prisma.client.count({ where: { organizationId: orgId, installDate: { gte: startOfToday, lt: endOfToday } } }),
    prisma.client.count({ where: { organizationId: orgId, createdAt: { gte: startOfToday, lt: endOfToday } } }),
    prisma.client.count({ where: { organizationId: orgId, status: 'completed', balance: { gt: 0 } } }),
    prisma.client.count({ where: { organizationId: orgId, installDate: { lt: startOfToday }, status: { notIn: ['completed', 'rejected'] } } }),
    prisma.client.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.client.aggregate({ where: { organizationId: orgId, createdAt: { gte: startOfMonth } }, _sum: { totalPrice: true }, _count: true }),
    prisma.client.count({ where: { organizationId: orgId, createdAt: { gte: startOfMonth } } }),
    prisma.price.findMany({ where: { organizationId: orgId } }),
  ]);

  const priceMap: Record<string, number> = pricingData.reduce((acc, item) => {
    acc[item.slug] = item.value;
    return acc;
  }, {} as Record<string, number>);

  const factMoney = monthAgg._sum.totalPrice ?? 0;
  const restMoney = Math.max(MONTH_PLAN - factMoney, 0);
  const planPercent = Math.min(Math.round((factMoney / MONTH_PLAN) * 100), 100);
  const avgCheck = monthAgg._count ? Math.round(factMoney / monthAgg._count) : 0;

  const todayRows = [
    { label: 'Замеры', count: measurementsToday, tone: 'tBlue', letter: 'З' },
    { label: 'Монтажи', count: mountsToday, tone: 'tGreen', letter: 'М' },
    { label: 'Новые заявки', count: newRequestsToday, tone: 'tAmber', letter: 'Н' },
    { label: 'Должники', count: debtorsCount, tone: 'tOrange', letter: 'Д' },
    { label: 'Просроченные', count: overdueCount, tone: 'tRed', letter: 'П' },
  ];

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <h1 className={styles.pageTitle}>ПАНЕЛЬ УПРАВЛЕНИЯ</h1>
        <div className={styles.searchWrap}>
          <input
            className={styles.searchInput}
            placeholder="Поиск по клиентам, заказам, телефонам..."
          />
          <span className={styles.searchKbd}>⌘K</span>
        </div>
      </header>

      <div className={styles.content}>
        <section>
          <h2 className={styles.sectionTitle}>БЫСТРЫЕ ДЕЙСТВИЯ</h2>
          <div className={styles.quickGrid}>
            <Link href="/dashboard/new-calculation" className={styles.quickCard}>
              <span className={`${styles.quickIcon} ${styles.qiGreen}`}>📝</span>
              <span><b>Новый заказ</b><small>Создать заказ</small></span>
            </Link>
            
            <NewClientBtn priceMap={priceMap} />
            
            {/* 🔥 А вот и правильный вызов нашей новой кнопки! */}
            <QuickCalcBtn priceMap={priceMap} /> 
            
            <Link href="/dashboard/calendar" className={styles.quickCard}>
              <span className={`${styles.quickIcon} ${styles.qiCyan}`}>📅</span>
              <span><b>Будущая функция</b><small>Неизвестная кнопка</small></span>
            </Link>
          </div>
        </section>

        <section className={styles.statsRow}>
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>СЕГОДНЯ</h3>
            <ul className={styles.todayList}>
              {todayRows.map((r) => (
                <li key={r.label}>
                  <span className={`${styles.todayBadge} ${styles[r.tone]}`}>{r.letter}</span>
                  <span className={styles.todayLabel}>{r.label}</span>
                  <span className={styles.todayCount}>{r.count}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>ФИНАНСЫ МЕСЯЦА</h3>
            <div className={styles.financeRow}><span>План:</span><b>{fmtMoney(MONTH_PLAN)}</b></div>
            <div className={styles.financeRow}><span>Факт:</span><b>{fmtMoney(factMoney)}</b></div>
            <div className={styles.financeRow}>
              <span>Осталось:</span>
              <b className={styles.remainBadge}>{fmtMoney(restMoney)}</b>
            </div>
            <div className={styles.financeRow}>
              <span>Выполнение плана</span><b>{planPercent}%</b>
            </div>
            <div className={styles.progressTrack}>
              <div className={styles.progressBar} style={{ width: `${planPercent}%` }} />
            </div>
          </div>

          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>СРЕДНИЙ ЧЕК</h3>
            <div className={styles.bigNumber}>{fmtMoney(avgCheck)}</div>
            <h3 className={styles.panelTitle}>КЛИЕНТОВ В МЕСЯЦ</h3>
            <div className={styles.bigNumber}>{clientsMonth}</div>
          </div>
        </section>

        <section className={styles.panel}>
          <h3 className={styles.panelTitle}>ПОСЛЕДНИЕ ЗАКАЗЫ</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Клиент</th><th>Адрес</th><th>Статус</th>
                <th>Сумма</th><th>Дата</th><th>Менеджер</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => {
                const meta = STATUS_META[normalizeStatus(o.status)] ?? STATUS_META.negotiation;
                const clientUrl = `/dashboard/new-calculation?id=${o.id}`;
                const cellLinkStyle = { color: 'inherit', textDecoration: 'none', display: 'block' };

                return (
                  <tr key={o.id} style={{ cursor: 'pointer' }}>
                    <td>
                      <Link href={clientUrl} style={cellLinkStyle}>
                        <b>{o.fio || '—'}</b>
                      </Link>
                    </td>
                    <td className={styles.muted}>
                      <Link href={clientUrl} style={cellLinkStyle}>
                        {o.address || '—'}
                      </Link>
                    </td>
                    <td>
                      <Link href={clientUrl} style={cellLinkStyle}>
                        <span className={`${styles.statusBadge} ${styles[meta.cls]}`}>{meta.label}</span>
                      </Link>
                    </td>
                    <td>
                      <Link href={clientUrl} style={cellLinkStyle}>
                        {fmtMoney(o.totalPrice ?? 0)}
                      </Link>
                    </td>
                    <td className={styles.muted}>
                      <Link href={clientUrl} style={cellLinkStyle}>
                        {o.createdAt.toLocaleDateString('ru-RU')}
                      </Link>
                    </td>
                    <td className={styles.muted}>
                      <Link href={clientUrl} style={cellLinkStyle}>
                        {o.createdByName || user.name}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className={styles.viewAllWrap}>
            <Link href="/dashboard/clients" className={styles.viewAll}>Смотреть все заказы →</Link>
          </div>
        </section>
      </div>
    </main>
  );
}