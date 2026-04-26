'use client';

/**
 * ProfileClient — клиентский компонент страницы профиля.
 *
 * Показывает:
 *   - Аватар (загрузка файла)
 *   - Основные данные (имя, телефон, telegramId)
 *   - Смена пароля — только для isOwnerAdmin (вынесена в PasswordChangeSection)
 *
 * @module src/app/dashboard/settings/profile/ProfileClient.tsx
 */

import { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  updateUserProfileAction,
  uploadAvatarAction,
} from '../actions';
import PasswordChangeSection from './PasswordChangeSection';
import styles from './profile.module.css';

// ---------------------------------------------------------------------------
// Типы
// ---------------------------------------------------------------------------

interface UserData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  telegramId: string | null;
  avatarUrl: string | null;
  role: string;
  isOwnerAdmin: boolean;
}

interface Props {
  user: UserData;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN:    'Администратор',
  MANAGER:  'Менеджер',
  ENGINEER: 'Инженер',
};

// ---------------------------------------------------------------------------
// Компонент
// ---------------------------------------------------------------------------

export default function ProfileClient({ user }: Props) {
  const router = useRouter();

  // Состояния формы профиля
  const [name, setName]             = useState(user.name);
  const [phone, setPhone]           = useState(user.phone ?? '');
  const [telegramId, setTelegramId] = useState(user.telegramId ?? '');
  const [avatarUrl, setAvatarUrl]   = useState(user.avatarUrl ?? '');

  // Сообщения профиля
  const [profileMsg, setProfileMsg]     = useState('');
  const [profileError, setProfileError] = useState('');

  // Сообщения аватара
  const [avatarMsg, setAvatarMsg]     = useState('');
  const [avatarError, setAvatarError] = useState('');

  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Обработчики
  // ---------------------------------------------------------------------------

  function handleProfileSave(): void {
    setProfileMsg('');
    setProfileError('');
    startTransition(async () => {
      const result = await updateUserProfileAction({ name, phone, telegramId });
      if (result.success) {
        setProfileMsg('Профиль успешно сохранён');
      } else {
        setProfileError(result.error);
      }
    });
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarMsg('');
    setAvatarError('');

    const formData = new FormData();
    formData.append('avatar', file);

    startTransition(async () => {
      const result = await uploadAvatarAction(formData);
      if (result.success) {
        setAvatarUrl(result.avatarUrl ?? '');
        setAvatarMsg('Аватар обновлён');
      } else {
        setAvatarError(result.error ?? 'Ошибка загрузки');
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Рендер
  // ---------------------------------------------------------------------------

  return (
    <div className={styles.page}>

      {/* ── Шапка ── */}
      <header className={styles.header}>
        <button
          className={styles.backBtn}
          onClick={() => router.push('/dashboard')}
        >
          ← Назад
        </button>
        <span className={styles.headerTitle}>Профиль</span>
        <span className={styles.roleBadge}>
          {ROLE_LABELS[user.role] ?? user.role}
        </span>
      </header>

      {/* ── Контент ── */}
      <div className={styles.content}>

        {/* Аватар */}
        <div className={styles.card}>
          <p className={styles.cardTitle}>Аватар</p>
          <div className={styles.avatarRow}>
            <div className={styles.avatarPreview}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Аватар"
                  className={styles.avatarImg}
                />
              ) : (
                <span className={styles.avatarPlaceholder}>
                  {user.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className={styles.avatarActions}>
              <button
                className={styles.uploadBtn}
                onClick={() => fileRef.current?.click()}
                disabled={isPending}
              >
                Загрузить фото
              </button>
              <p className={styles.avatarHint}>
                JPEG, PNG или WEBP. Максимум 2 МБ.
              </p>
              {avatarMsg   && <p className={styles.successMsg}>{avatarMsg}</p>}
              {avatarError && <p className={styles.errorMsg}>{avatarError}</p>}
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className={styles.hiddenInput}
            onChange={handleAvatarChange}
          />
        </div>

        {/* Основные данные */}
        <div className={styles.card}>
          <p className={styles.cardTitle}>Основные данные</p>

          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label className={styles.label}>Имя</label>
              <input
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Введите имя"
                disabled={isPending}
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.label}>Email</label>
              <input
                className={`${styles.input} ${styles.inputReadOnly}`}
                value={user.email}
                readOnly
                tabIndex={-1}
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.label}>Телефон</label>
              <input
                className={styles.input}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 (___) ___-__-__"
                disabled={isPending}
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.label}>Telegram ID</label>
              <input
                className={styles.input}
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                placeholder="@username"
                disabled={isPending}
              />
            </div>
          </div>

          {profileMsg   && <p className={styles.successMsg}>{profileMsg}</p>}
          {profileError && <p className={styles.errorMsg}>{profileError}</p>}

          <button
            className={styles.saveBtn}
            onClick={handleProfileSave}
            disabled={isPending || !name.trim()}
          >
            {isPending ? 'Сохранение...' : 'Сохранить профиль'}
          </button>
        </div>

        {/* Смена пароля — только для isOwnerAdmin */}
        {user.isOwnerAdmin && <PasswordChangeSection />}

      </div>
    </div>
  );
}