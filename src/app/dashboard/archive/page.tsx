import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import styles from './archive.module.css';

export const dynamic = 'force-dynamic';

type ArchivePageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function getStatusMeta(status: string) {
  if (status === 'completed') {
    return {
      label: 'Успешно',
      badgeClass: styles.statusCompleted,
      dotClass: styles.dotCompleted,
    };
  }

  if (status === 'rejected') {
    return {
      label: 'Провалено',
      badgeClass: styles.statusRejected,
      dotClass: styles.dotRejected,
    };
  }

  return {
    label: status || '—',
    badgeClass: styles.statusUnknown,
    dotClass: styles.dotUnknown,
  };
}

export default async function ArchivePage({ searchParams }: ArchivePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = (resolvedSearchParams?.q || '').trim();

  const archiveWhere = {
    status: {
      in: ['completed', 'rejected'],
    },
    ...(query
      ? {
          address: {
            contains: query,
            mode: 'insensitive' as const,
          },
        }
      : {}),
  };

  const [archiveClients, totalInArchive, completedCount, rejectedCount] =
    await Promise.all([
      prisma.client.findMany({
        where: archiveWhere,
        orderBy: {
          updatedAt: 'desc',
        },
      }),
      prisma.client.count({
        where: {
          status: {
            in: ['completed', 'rejected'],
          },
        },
      }),
      prisma.client.count({
        where: {
          status: 'completed',
        },
      }),
      prisma.client.count({
        where: {
          status: 'rejected',
        },
      }),
    ]);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>CRM / АРХИВ</div>
            <h1 className={styles.title}>Архив заказов</h1>
            <p className={styles.subtitle}>
              Завершённые и проваленные сделки в отдельном разделе, без смешивания
              с активной доской.
            </p>
          </div>

          <div className={styles.headerActions}>
            <Link href="/dashboard" className={styles.secondaryButton}>
              В панель
            </Link>
            <Link href="/dashboard/clients" className={styles.secondaryButton}>
              В канбан
            </Link>
            <Link href="/dashboard/new-calculation" className={styles.primaryButton}>
              Новый расчёт
            </Link>
          </div>
        </header>

        <section className={styles.statsGrid}>
          <article className={styles.statCard}>
            <div className={styles.statLabel}>ВСЕГО В АРХИВЕ</div>
            <div className={styles.statValue}>{totalInArchive}</div>
            <div className={styles.statHint}>Все завершённые записи</div>
          </article>

          <article className={styles.statCard}>
            <div className={styles.statLabel}>УСПЕШНЫХ</div>
            <div className={styles.statValue}>{completedCount}</div>
            <div className={styles.statHint}>Статус completed</div>
          </article>

          <article className={styles.statCard}>
            <div className={styles.statLabel}>ПРОВАЛЕННЫХ</div>
            <div className={styles.statValue}>{rejectedCount}</div>
            <div className={styles.statHint}>Статус rejected</div>
          </article>

          <article className={`${styles.statCard} ${styles.analyticsCard}`}>
            <div className={styles.statLabel}>АНАЛИТИКА</div>
            <button type="button" className={styles.analyticsButton}>
              Скоро здесь
            </button>
            <div className={styles.statHint}>Заглушка под будущую аналитику</div>
          </article>
        </section>

        <section className={styles.tableSection}>
          <div className={styles.tableHeader}>
            <div>
              <h2 className={styles.tableTitle}>Список архивных заказов</h2>
              <p className={styles.tableSubtitle}>
                Фильтр только по completed и rejected.
              </p>
            </div>

            <form className={styles.searchForm}>
              <input
                type="text"
                name="q"
                defaultValue={query}
                placeholder="Поиск по адресу объекта..."
                className={styles.searchInput}
              />
              <button type="submit" className={styles.searchButton}>
                Найти
              </button>
            </form>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Заказчик</th>
                  <th>Сумма</th>
                  <th>Статус</th>
                  <th>Менеджер</th>
                </tr>
              </thead>
              <tbody>
                {archiveClients.length > 0 ? (
                  archiveClients.map((client) => {
                    const statusMeta = getStatusMeta(client.status);

                    return (
                      <tr key={client.id}>
                        <td>{formatDate(client.updatedAt || client.createdAt)}</td>
                        <td>
                          <div className={styles.clientCell}>
                            <div className={styles.clientName}>{client.fio}</div>
                            <div className={styles.clientPhone}>
                              {client.phone || '—'}
                            </div>
                          </div>
                        </td>
                        <td>{formatMoney(client.totalPrice)}</td>
                        <td>
                          <span className={`${styles.statusBadge} ${statusMeta.badgeClass}`}>
                            <span className={`${styles.statusDot} ${statusMeta.dotClass}`} />
                            {statusMeta.label}
                          </span>
                        </td>
                        <td>—</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <div className={styles.emptyState}>
                        По текущему фильтру архивных заказов не найдено.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}