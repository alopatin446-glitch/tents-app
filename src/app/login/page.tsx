'use client';

import { useState, type FormEvent } from 'react';
import styles from '../auth.module.css';
import { loginAction } from '../auth/actions'; // Импортируем экшен напрямую

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      // Вызываем напрямую серверный экшен, минуя хуки
      const result = await loginAction(email, password);

      if (result.success) {
        // Силовой редирект с полной перезагрузкой страницы
        // Это решит проблему с "зависшим" состоянием Next.js
        window.location.href = '/dashboard';
      } else {
        setError(result.error || 'Неверные данные');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Произошла ошибка на сервере');
      setIsLoading(false);
    }
  };

  return (
    <main className={styles.authWrapper}>
      <h1 className={styles.neonTitle} style={{ marginBottom: '2.5rem' }}>ВХОД</h1>

      <form onSubmit={handleSubmit} className={styles.authFormFields}>
        {error && <div style={{ color: '#ff4444', textAlign: 'center', marginBottom: '1rem' }}>{error}</div>}
        
        <input
          type="email"
          placeholder="Почта"
          value={email}
          className={styles.authInput}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          className={styles.authInput}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
        />
        <button 
          type="submit" 
          className={styles.loginButton}
          disabled={isLoading}
        >
          {isLoading ? 'ЗАГРУЗКА...' : 'ВОЙТИ'}
        </button>
      </form>
    </main>
  );
}