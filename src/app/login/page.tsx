'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import styles from '../page.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!login(email, password)) {
      alert('Ошибка доступа. Проверьте данные.');
    }
  };

  return (
    <main className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.column}>
        <h1 className={styles.neonTitle}>ВХОД</h1>

        <div className={styles.authFormFields}>
          <input
            type="email"
            placeholder="Почта"
            className={styles.authInput}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Пароль"
            className={styles.authInput}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className={styles.heroButton}>
            ВОЙТИ
          </button>
        </div>
      </form>
    </main>
  );
}