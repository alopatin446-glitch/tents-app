'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import styles from '../page.module.css';

export default function DashboardPage() {
  const router = useRouter();
  const { checkAuth, logout } = useAuth();

  useEffect(() => {
    if (!checkAuth()) {
      router.push('/login');
    }
  }, [checkAuth, router]);

  return (
    <main className={styles.container}>
      <div className={styles.column}>
        <h1 className={styles.neonTitle}>DASHBOARD ПОДГОТОВЛЕН</h1>
        <p>Если вы видите этот текст — авторизация и редирект сработали!</p>
        <button onClick={logout} className={styles.heroButton}>ВЫЙТИ</button>
      </div>
    </main>
  );
}