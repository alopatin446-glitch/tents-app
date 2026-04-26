'use client';

/**
 * TeamClient — клиентский компонент страницы управления командой.
 *
 * Функциональность:
 *   - Таблица сотрудников с бейджами роли/статуса
 *   - Создание сотрудника (модал)
 *   - Редактирование имени/роли (модал)
 *   - Управление разрешениями по группам (модал, сворачиваемые секции)
 *   - Сброс пароля (модал)
 *   - Блокировка / разблокировка
 *   - Передача прав владельца (только isOwnerAdmin)
 *
 * @module src/app/dashboard/settings/team/TeamClient.tsx
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  createEmployeeAction,
  updateEmployeeAction,
  toggleUserStatusAction,
  updateUserPermissionsAction,
  resetEmployeePasswordAction,
  transferOwnerAdminAction,
} from '../actions';
import { PERMISSION_GROUPS } from '@/lib/permissionGroups';
import styles from './team.module.css';

// ---------------------------------------------------------------------------
// Типы
// ---------------------------------------------------------------------------

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  isOwnerAdmin: boolean;
  lastLoginAt: string | null;
  permissions: string[];
}

interface Props {
  users: UserRow[];
  currentUserId: string;
  currentUserIsOwnerAdmin: boolean;
}

type ModalMode =
  | 'create'
  | 'edit'
  | 'permissions'
  | 'reset-password'
  | 'transfer'
  | null;

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  ENGINEER: 'Инженер',
};

// ---------------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------------

function formatLastLogin(iso: string | null): string {
  if (!iso) return 'Нет данных';
  try {
    return new Date(iso).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return 'Нет данных';
  }
}

function getRoleBadgeClass(
  role: string,
  stylesObj: Record<string, string>
): string {
  if (role === 'ADMIN') return `${stylesObj.badge} ${stylesObj.badgeAdmin}`;
  if (role === 'MANAGER') return `${stylesObj.badge} ${stylesObj.badgeManager}`;
  return `${stylesObj.badge} ${stylesObj.badgeEngineer}`;
}

function getStatusBadgeClass(
  status: string,
  stylesObj: Record<string, string>
): string {
  if (status === 'ACTIVE') return `${stylesObj.badge} ${stylesObj.badgeActive}`;
  return `${stylesObj.badge} ${stylesObj.badgeBlocked}`;
}

// ---------------------------------------------------------------------------
// Компонент
// ---------------------------------------------------------------------------

export default function TeamClient({
  users,
  currentUserId,
  currentUserIsOwnerAdmin,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ── Состояние модалок ──────────────────────────────────────────────────
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);

  // ── Форма создания ────────────────────────────────────────────────────
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState('MANAGER');

  // ── Форма редактирования ──────────────────────────────────────────────
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('MANAGER');

  // ── Разрешения ────────────────────────────────────────────────────────
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set([PERMISSION_GROUPS[0]?.group ?? ''])
  );

  // ── Сброс пароля ─────────────────────────────────────────────────────
  const [newPassword, setNewPassword] = useState('');

  // ── Передача прав ─────────────────────────────────────────────────────
  const [transferTargetId, setTransferTargetId] = useState('');

  // ── Сообщения ─────────────────────────────────────────────────────────
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  // ── Утилиты модалок ───────────────────────────────────────────────────

  function closeModal(): void {
    setModalMode(null);
    setSelectedUser(null);
    setModalError('');
    setModalSuccess('');
    setNewPassword('');
    setTransferTargetId('');
  }

  function openCreate(): void {
    setCreateName('');
    setCreateEmail('');
    setCreatePassword('');
    setCreateRole('MANAGER');
    setModalError('');
    setModalSuccess('');
    setModalMode('create');
  }

  function openEdit(user: UserRow): void {
    setSelectedUser(user);
    setEditName(user.name);
    setEditRole(user.role);
    setModalError('');
    setModalSuccess('');
    setModalMode('edit');
  }

  function openPermissions(user: UserRow): void {
    setSelectedUser(user);
    setSelectedPermissions([...user.permissions]);
    setExpandedGroups(new Set([PERMISSION_GROUPS[0]?.group ?? '']));
    setModalError('');
    setModalSuccess('');
    setModalMode('permissions');
  }

  function openResetPassword(user: UserRow): void {
    setSelectedUser(user);
    setNewPassword('');
    setModalError('');
    setModalSuccess('');
    setModalMode('reset-password');
  }

  function openTransfer(): void {
    setTransferTargetId('');
    setModalError('');
    setModalSuccess('');
    setModalMode('transfer');
  }

  // ── Обработчики разрешений ─────────────────────────────────────────────

  function togglePermission(key: string): void {
    setSelectedPermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function toggleGroup(group: string): void {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }

  // ── Server Action вызовы ───────────────────────────────────────────────

  function handleCreate(): void {
    setModalError('');
    startTransition(async () => {
      const result = await createEmployeeAction({
        name: createName,
        email: createEmail,
        password: createPassword,
        role: createRole,
      });
      if (result.success) {
        closeModal();
        router.refresh();
      } else {
        setModalError(result.error);
      }
    });
  }

  function handleEdit(): void {
    if (!selectedUser) return;
    setModalError('');
    startTransition(async () => {
      const result = await updateEmployeeAction({
        userId: selectedUser.id,
        name: editName,
        role: editRole,
      });
      if (result.success) {
        closeModal();
        router.refresh();
      } else {
        setModalError(result.error);
      }
    });
  }

  function handleToggleStatus(user: UserRow): void {
    startTransition(async () => {
      const result = await toggleUserStatusAction(user.id);
      if (result.success) {
        router.refresh();
      }
    });
  }

  function handleSavePermissions(): void {
    if (!selectedUser) return;
    setModalError('');
    startTransition(async () => {
      const result = await updateUserPermissionsAction(
        selectedUser.id,
        selectedPermissions
      );
      if (result.success) {
        setModalSuccess('Разрешения сохранены');
        setTimeout(() => {
          closeModal();
          router.refresh();
        }, 800);
      } else {
        setModalError(result.error);
      }
    });
  }

  function handleResetPassword(): void {
    if (!selectedUser) return;
    setModalError('');
    startTransition(async () => {
      const result = await resetEmployeePasswordAction(
        selectedUser.id,
        newPassword
      );
      if (result.success) {
        setModalSuccess('Пароль успешно сброшен');
        setTimeout(() => closeModal(), 1000);
      } else {
        setModalError(result.error);
      }
    });
  }

  function handleTransfer(): void {
    if (!transferTargetId) return;
    setModalError('');
    startTransition(async () => {
      const result = await transferOwnerAdminAction(transferTargetId);
      if (result.success) {
        setModalSuccess('Права владельца переданы');
        setTimeout(() => {
          closeModal();
          router.refresh();
        }, 1000);
      } else {
        setModalError(result.error);
      }
    });
  }

  // ── Список потенциальных получателей прав ──────────────────────────────
  const transferCandidates = users.filter(
    (u) => u.role === 'ADMIN' && !u.isOwnerAdmin && u.id !== currentUserId
  );

  // ── Рендер ────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* Шапка */}
      <header className={styles.header}>
        <button
          className={styles.backBtn}
          onClick={() => router.push('/dashboard')}
        >
          ← Назад
        </button>
        <span className={styles.headerTitle}>Команда</span>
        {currentUserIsOwnerAdmin && (
          <button
            className={styles.addBtn}
            style={{ marginRight: '0.5rem' }}
            onClick={openTransfer}
            disabled={transferCandidates.length === 0}
          >
            Передать права
          </button>
        )}
        <button className={styles.addBtn} onClick={openCreate}>
          + Добавить
        </button>
      </header>

      {/* Таблица */}
      <div className={styles.content}>
        <div className={styles.tableWrap}>
          {users.length === 0 ? (
            <div className={styles.emptyState}>Сотрудников нет</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Сотрудник</th>
                  <th className={styles.th}>Роль</th>
                  <th className={styles.th}>Статус</th>
                  <th className={styles.th}>Последний вход</th>
                  <th className={styles.th}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className={styles.tr}>
                    <td className={styles.td}>
                      <div className={styles.userName}>
                        {user.name}
                        {user.isOwnerAdmin && (
                          <span className={styles.userOwner}>владелец</span>
                        )}
                      </div>
                      <div className={styles.userEmail}>{user.email}</div>
                    </td>
                    <td className={styles.td}>
                      <span className={getRoleBadgeClass(user.role, styles)}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <span className={getStatusBadgeClass(user.status, styles)}>
                        {user.status === 'ACTIVE' ? 'Активен' : 'Заблокирован'}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.lastLogin}>
                        {formatLastLogin(user.lastLoginAt)}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.actionGroup}>
                        {/* Редактировать */}
                        <button
                          className={styles.actionBtn}
                          onClick={() => openEdit(user)}
                          disabled={
                            isPending ||
                            (user.isOwnerAdmin && !currentUserIsOwnerAdmin)
                          }
                        >
                          Изменить
                        </button>

                        {/* Разрешения — только для не-ADMIN */}
                        {user.role !== 'ADMIN' && (
                          <button
                            className={styles.actionBtn}
                            onClick={() => openPermissions(user)}
                            disabled={isPending}
                          >
                            Права
                          </button>
                        )}

                        {/* Сброс пароля */}
                        <button
                          className={styles.actionBtn}
                          onClick={() => openResetPassword(user)}
                          disabled={
                            isPending || user.id === currentUserId
                          }
                        >
                          Пароль
                        </button>

                        {/* Блокировка / разблокировка */}
                        {!user.isOwnerAdmin && user.id !== currentUserId && (
                          <button
                            className={`${styles.actionBtn} ${
                              user.status === 'ACTIVE'
                                ? styles.actionBtnDanger
                                : styles.actionBtnUnblock
                            }`}
                            onClick={() => handleToggleStatus(user)}
                            disabled={isPending}
                          >
                            {user.status === 'ACTIVE' ? 'Блок' : 'Разблок'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          МОДАЛКИ
         ════════════════════════════════════════════════════════ */}

      {modalMode !== null && (
        <div className={styles.overlay} onClick={closeModal}>
          <div
            className={`${styles.modal} ${
              modalMode === 'permissions' ? styles.modalLarge : ''
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Создание ── */}
            {modalMode === 'create' && (
              <>
                <div className={styles.modalHeader}>
                  <span className={styles.modalTitle}>Новый сотрудник</span>
                  <button className={styles.modalClose} onClick={closeModal}>×</button>
                </div>

                <div className={styles.formField}>
                  <label className={styles.label}>Имя</label>
                  <input
                    className={styles.input}
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Имя сотрудника"
                  />
                </div>
                <div className={styles.formField}>
                  <label className={styles.label}>Email</label>
                  <input
                    className={styles.input}
                    type="email"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>
                <div className={styles.formField}>
                  <label className={styles.label}>Пароль</label>
                  <input
                    className={styles.input}
                    type="password"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="Минимум 6 символов"
                    autoComplete="new-password"
                  />
                </div>
                <div className={styles.formField}>
                  <label className={styles.label}>Роль</label>
                  <select
                    className={styles.select}
                    value={createRole}
                    onChange={(e) => setCreateRole(e.target.value)}
                  >
                    <option value="MANAGER">Менеджер</option>
                    <option value="ENGINEER">Инженер</option>
                    {currentUserIsOwnerAdmin && (
                      <option value="ADMIN">Администратор</option>
                    )}
                  </select>
                </div>

                {modalError && <p className={styles.errorMsg}>{modalError}</p>}

                <div className={styles.modalFooter}>
                  <button className={styles.btnSecondary} onClick={closeModal}>
                    Отмена
                  </button>
                  <button
                    className={styles.btnPrimary}
                    onClick={handleCreate}
                    disabled={
                      isPending ||
                      !createName.trim() ||
                      !createEmail.trim() ||
                      !createPassword
                    }
                  >
                    {isPending ? 'Создание...' : 'Создать'}
                  </button>
                </div>
              </>
            )}

            {/* ── Редактирование ── */}
            {modalMode === 'edit' && selectedUser && (
              <>
                <div className={styles.modalHeader}>
                  <span className={styles.modalTitle}>Редактировать</span>
                  <button className={styles.modalClose} onClick={closeModal}>×</button>
                </div>

                {selectedUser.isOwnerAdmin && (
                  <p className={styles.ownerNote}>
                    Владелец системы — некоторые параметры недоступны для изменения.
                  </p>
                )}

                <div className={styles.formField}>
                  <label className={styles.label}>Имя</label>
                  <input
                    className={styles.input}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div className={styles.formField}>
                  <label className={styles.label}>Роль</label>
                  <select
                    className={styles.select}
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    disabled={selectedUser.isOwnerAdmin && !currentUserIsOwnerAdmin}
                  >
                    <option value="MANAGER">Менеджер</option>
                    <option value="ENGINEER">Инженер</option>
                    {currentUserIsOwnerAdmin && (
                      <option value="ADMIN">Администратор</option>
                    )}
                  </select>
                </div>

                {modalError && <p className={styles.errorMsg}>{modalError}</p>}

                <div className={styles.modalFooter}>
                  <button className={styles.btnSecondary} onClick={closeModal}>
                    Отмена
                  </button>
                  <button
                    className={styles.btnPrimary}
                    onClick={handleEdit}
                    disabled={isPending || !editName.trim()}
                  >
                    {isPending ? 'Сохранение...' : 'Сохранить'}
                  </button>
                </div>
              </>
            )}

            {/* ── Разрешения ── */}
            {modalMode === 'permissions' && selectedUser && (
              <>
                <div className={styles.modalHeader}>
                  <span className={styles.modalTitle}>
                    Права доступа — {selectedUser.name}
                  </span>
                  <button className={styles.modalClose} onClick={closeModal}>×</button>
                </div>

                {PERMISSION_GROUPS.map((group) => {
                  const isOpen = expandedGroups.has(group.group);
                  const activeCount = group.permissions.filter((p) =>
                    selectedPermissions.includes(p.key)
                  ).length;

                  return (
                    <div key={group.group} className={styles.permGroup}>
                      <button
                        className={styles.permGroupHeader}
                        onClick={() => toggleGroup(group.group)}
                      >
                        <span>
                          {group.group}
                          {activeCount > 0 && (
                            <span className={styles.permGroupCount}>
                              ({activeCount}/{group.permissions.length})
                            </span>
                          )}
                        </span>
                        <span
                          className={`${styles.permGroupChevron} ${
                            isOpen ? styles.permGroupChevronOpen : ''
                          }`}
                        >
                          ▼
                        </span>
                      </button>

                      {isOpen && (
                        <div className={styles.permGroupContent}>
                          {group.permissions.map((perm) => {
                            const checked = selectedPermissions.includes(perm.key);
                            return (
                              <label
                                key={perm.key}
                                className={styles.permItem}
                              >
                                <span className={styles.toggle}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => togglePermission(perm.key)}
                                  />
                                  <span className={styles.slider} />
                                </span>
                                <span className={styles.permLabel}>
                                  {perm.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {modalError && <p className={styles.errorMsg}>{modalError}</p>}
                {modalSuccess && <p className={styles.successMsg}>{modalSuccess}</p>}

                <div className={styles.modalFooter}>
                  <button className={styles.btnSecondary} onClick={closeModal}>
                    Отмена
                  </button>
                  <button
                    className={styles.btnPrimary}
                    onClick={handleSavePermissions}
                    disabled={isPending}
                  >
                    {isPending ? 'Сохранение...' : 'Сохранить права'}
                  </button>
                </div>
              </>
            )}

            {/* ── Сброс пароля ── */}
            {modalMode === 'reset-password' && selectedUser && (
              <>
                <div className={styles.modalHeader}>
                  <span className={styles.modalTitle}>
                    Сброс пароля — {selectedUser.name}
                  </span>
                  <button className={styles.modalClose} onClick={closeModal}>×</button>
                </div>

                <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', marginBottom: '1rem' }}>
                  Все активные сессии сотрудника будут завершены.
                </p>

                <div className={styles.formField}>
                  <label className={styles.label}>Новый пароль</label>
                  <input
                    className={styles.input}
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Минимум 6 символов"
                    autoComplete="new-password"
                  />
                </div>

                {modalError && <p className={styles.errorMsg}>{modalError}</p>}
                {modalSuccess && <p className={styles.successMsg}>{modalSuccess}</p>}

                <div className={styles.modalFooter}>
                  <button className={styles.btnSecondary} onClick={closeModal}>
                    Отмена
                  </button>
                  <button
                    className={styles.btnPrimary}
                    onClick={handleResetPassword}
                    disabled={isPending || newPassword.length < 6}
                  >
                    {isPending ? 'Сохранение...' : 'Сбросить пароль'}
                  </button>
                </div>
              </>
            )}

            {/* ── Передача прав владельца ── */}
            {modalMode === 'transfer' && (
              <>
                <div className={styles.modalHeader}>
                  <span className={styles.modalTitle}>Передача прав владельца</span>
                  <button className={styles.modalClose} onClick={closeModal}>×</button>
                </div>

                <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', marginBottom: '1rem' }}>
                  После передачи вы потеряете статус владельца и сохраните роль администратора.
                </p>

                {transferCandidates.length === 0 ? (
                  <p className={styles.ownerNote}>
                    Нет подходящих администраторов для передачи прав.
                    Сначала создайте администратора.
                  </p>
                ) : (
                  <div className={styles.formField}>
                    <label className={styles.label}>Новый владелец</label>
                    <select
                      className={styles.select}
                      value={transferTargetId}
                      onChange={(e) => setTransferTargetId(e.target.value)}
                    >
                      <option value="">— Выберите администратора —</option>
                      {transferCandidates.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {modalError && <p className={styles.errorMsg}>{modalError}</p>}
                {modalSuccess && <p className={styles.successMsg}>{modalSuccess}</p>}

                <div className={styles.modalFooter}>
                  <button className={styles.btnSecondary} onClick={closeModal}>
                    Отмена
                  </button>
                  <button
                    className={styles.btnPrimary}
                    onClick={handleTransfer}
                    disabled={isPending || !transferTargetId}
                  >
                    {isPending ? 'Передача...' : 'Передать права'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}