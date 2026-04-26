'use client';

/**
 * PasswordChangeSection — блок смены пароля в профиле.
 *
 * Рендерится только для isOwnerAdmin.
 * Управляет собственным состоянием и useTransition.
 *
 * @module src/app/dashboard/settings/profile/PasswordChangeSection.tsx
 */

import { useState, useTransition } from 'react';
import { changePasswordAction } from '../actions';
import styles from './profile.module.css';

// ---------------------------------------------------------------------------
// Компонент
// ---------------------------------------------------------------------------

export default function PasswordChangeSection() {
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd]         = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [msg, setMsg]               = useState('');
  const [error, setError]           = useState('');

  const [isPending, startTransition] = useTransition();

  function handleSubmit(): void {
    setMsg('');
    setError('');

    if (newPwd.length < 8) {
      setError('Новый пароль должен содержать минимум 8 символов');
      return;
    }

    if (newPwd !== confirmPwd) {
      setError('Пароли не совпадают');
      return;
    }

    startTransition(async () => {
      const result = await changePasswordAction(currentPwd, newPwd);
      if (result.success) {
        setMsg('Пароль успешно изменён');
        setCurrentPwd('');
        setNewPwd('');
        setConfirmPwd('');
      } else {
        setError(result.error);
      }
    });
  }

  const isDisabled = isPending || !currentPwd || !newPwd || !confirmPwd;

  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>Смена пароля</p>

      <div className={styles.formGrid}>
        {/* Текущий пароль занимает левую колонку; правая — пустая для выравнивания */}
        <div className={styles.formField}>
          <label className={styles.label}>Текущий пароль</label>
          <input
            type="password"
            className={styles.input}
            value={currentPwd}
            onChange={(e) => setCurrentPwd(e.target.value)}
            autoComplete="current-password"
            disabled={isPending}
          />
        </div>

        {/* spacer */}
        <div className={styles.formField} />

        <div className={styles.formField}>
          <label className={styles.label}>Новый пароль</label>
          <input
            type="password"
            className={styles.input}
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            autoComplete="new-password"
            disabled={isPending}
          />
        </div>

        <div className={styles.formField}>
          <label className={styles.label}>Подтверждение</label>
          <input
            type="password"
            className={styles.input}
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            autoComplete="new-password"
            disabled={isPending}
          />
        </div>
      </div>

      {msg   && <p className={styles.successMsg}>{msg}</p>}
      {error && <p className={styles.errorMsg}>{error}</p>}

      <button
        className={styles.saveBtn}
        onClick={handleSubmit}
        disabled={isDisabled}
      >
        {isPending ? 'Сохранение...' : 'Изменить пароль'}
      </button>
    </div>
  );
}