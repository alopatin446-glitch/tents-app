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
      {/* Используем authWrapper вместо обычного column */}
      <div className={styles.authWrapper}>
        <h1 className={styles.neonTitle} style={{ marginBottom: '2rem' }}>ВХОД</h1>

        <form onSubmit={handleSubmit} className={styles.authFormFields}>
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
        </form>
      </div>
    </main>
  );
}