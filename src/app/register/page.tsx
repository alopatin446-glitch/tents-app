'use client';

import styles from '../page.module.css';

export default function RegisterPage() {
  return (
    <main className={styles.container}>
      <div className={styles.column}>
        <h1 className={styles.whiteTitle}>РЕГИСТРАЦИЯ</h1>

        <div className={styles.authFormFields}>
          <input type="text" placeholder="Имя пользователя" className={styles.authInput} />
          <input type="text" placeholder="Название организации" className={styles.authInput} />
          <input type="tel" placeholder="Номер телефона" className={styles.authInput} />
          <input type="email" placeholder="Почта" className={styles.authInput} />
          <input type="password" placeholder="Пароль" className={styles.authInput} />
          <button className={styles.heroButton}>СОЗДАТЬ АККАУНТ</button>
        </div>
      </div>
    </main>
  );
}