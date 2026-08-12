'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/actions';
import styles from './DashboardSidebar.module.css';

type NavItem = { href: string | null; label: string; icon: string; soon?: boolean };

// href ведут на существующие страницы. Производство/Финансы — заглушки «скоро»
// (по рабочей тетради: нефункциональные кнопки не должны выглядеть рабочими).
const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: '▦' },
  { href: '/dashboard/clients', label: 'Заказы', icon: '🗂' },
  { href: '/dashboard/clients', label: 'Клиенты', icon: '👥' },
  { href: '/dashboard/calendar', label: 'Календарь', icon: '📅' },
  { href: null, label: 'Производство', icon: '🏭', soon: true },
  { href: null, label: 'Финансы', icon: '💳', soon: true },
  { href: '/dashboard/archive', label: 'Архив', icon: '🗄' },
  { href: '/dashboard/settings', label: 'Настройки', icon: '⚙' },
];

export default function DashboardSidebar({ userName, userRole }: { userName: string; userRole: string }) {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        EASY MO<br /><span>CORE</span>{/* замените на свой бренд */}
      </div>

      <nav className={styles.nav}>
        {NAV.map((item) =>
          item.soon || !item.href ? (
            <span key={item.label} className={`${styles.navItem} ${styles.navItemSoon}`} title="В разработке">
              <span className={styles.navIcon}>{item.icon}</span>{item.label}
            </span>
          ) : (
            <Link
              key={item.label}
              href={item.href}
              className={`${styles.navItem} ${pathname === item.href ? styles.navItemActive : ''}`}
            >
              <span className={styles.navIcon}>{item.icon}</span>{item.label}
            </Link>
          )
        )}
      </nav>

      <div className={styles.bottom}>
        <a className={styles.supportCard} href="mailto:support@easymo.ru">
          <span className={styles.supportIcon}>🛟</span>
          <span>
            <b>Техподдержка</b>
            <small>Написать в поддержку</small>
          </span>
        </a>

        <div className={styles.userCard}>
          <span className={styles.userAvatar}>{(userName || '?').charAt(0).toUpperCase()}</span>
          <span className={styles.userMeta}>
            <b>{userName}</b>
            <small>{userRole}</small>
          </span>
          <form action={logoutAction}>
            <button type="submit" className={styles.logoutBtn} title="Выйти">⎋</button>
          </form>
        </div>
      </div>
    </aside>
  );
}