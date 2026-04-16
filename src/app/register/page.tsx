'use client';

import styles from '../auth.module.css'; // Исправлен путь

export default function RegisterPage() {
  return (
    <main className={styles.authWrapper}>
      <h1 className={styles.whiteTitle} style={{ marginBottom: '2.5rem' }}>РЕГИСТРАЦИЯ</h1>

      <div className={styles.authFormFields}>
        <input type="text" placeholder="Имя пользователя" className={styles.authInput} />
        <input type="text" placeholder="Название организации" className={styles.authInput} />
        <input type="tel" placeholder="Номер телефона" className={styles.authInput} />
        <input type="email" placeholder="Почта" className={styles.authInput} />
        <input type="password" placeholder="Пароль" className={styles.authInput} />
        {/* Используем registerButton для красного акцента или loginButton для зеленого */}
        <button className={styles.registerButton}>СОЗДАТЬ АККАУНТ</button>
      </div>
    </main>
  );
}