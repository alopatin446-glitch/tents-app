'use client';

/**
 * Канбан-доска активных клиентов.
 *
 * Архитектурные изменения (ШАГ 2.2.1):
 *   - Колонки доски строятся из ACTIVE_STATUSES (statusDictionary) — D-05 закрыт.
 *   - Хардкоженный массив STAGES и Set STAGE_IDS удалены.
 *   - ACTIVE_STATUS_ID_SET заменяет локальный Set в resolveDropStatus.
 *   - Тип ClientStatus из ядра выровнен с Client['status'] из ./types.
 *
 * @module src/components/KanbanBoard.tsx
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { notifyError, notifySuccess } from '@/lib/notify';

// Серверные экшены
import { updateClientAction, deleteClientAction } from './actions';

// Стили и дочерние компоненты
import styles from './KanbanBoard.module.css';
import StageColumn from './StageColumn';
import EditModal from './EditModal';
import CreateClientModal from './CreateClientModal';

// Типы: Client из локального types, Stage конструируем из словаря
import { type Client, type Stage } from '@/types';
import { useClients } from './ClientContext';

// Ядро: словарь статусов (D-05)
import {
  ACTIVE_STATUSES,
  ACTIVE_STATUS_ID_SET,
  type ClientStatus,
} from '@/lib/logic/statusDictionary';

// ---------------------------------------------------------------------------
// Колонки канбана
//
// ACTIVE_STATUSES из словаря уже отсортированы по kanbanOrder.
// Маппим label → title для совместимости с интерфейсом Stage из ./types.
// StageColumn не трогаем — он по-прежнему получает Stage с полем title.
// ---------------------------------------------------------------------------
const KANBAN_STAGES: Stage[] = ACTIVE_STATUSES.map((s) => ({
  id: s.id,
  title: s.label,
}));

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Компонент
// ---------------------------------------------------------------------------

export default function KanbanBoard() {
  const { clients, updateClient, deleteClient } = useClients();
  const router = useRouter();

  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // ---------------------------------------------------------------------------
  // Фильтрация клиентов по строке поиска
  // ---------------------------------------------------------------------------

  const filteredClients = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(searchQuery);

    if (!normalizedQuery) {
      return clients;
    }

    return clients.filter((client) => {
      const fio = String(client.fio || '').toLowerCase();
      const phone = String(client.phone || '').toLowerCase();
      const address = String(client.address || '').toLowerCase();

      return (
        fio.includes(normalizedQuery) ||
        phone.includes(normalizedQuery) ||
        address.includes(normalizedQuery)
      );
    });
  }, [clients, searchQuery]);

  // ---------------------------------------------------------------------------
  // Управление выделением карточек
  // ---------------------------------------------------------------------------

  const toggleSelect = (id: string): void => {
    const normalizedId = String(id);

    setSelectedIds((prev) =>
      prev.includes(normalizedId)
        ? prev.filter((itemId) => String(itemId) !== normalizedId)
        : [...prev, normalizedId]
    );
  };

  const clearSelection = (): void => {
    setSelectedIds([]);
  };

  // ---------------------------------------------------------------------------
  // Массовое удаление выделенных карточек
  // ---------------------------------------------------------------------------

  const deleteSelected = async (): Promise<void> => {
    if (selectedIds.length === 0) return;

    const confirmed = confirm(
      `Удалить выбранных клиентов (${selectedIds.length} шт.)?`
    );
    if (!confirmed) return;

    try {
      const idsToDelete = selectedIds.map((id) => String(id));

      const results = await Promise.allSettled(
        idsToDelete.map(async (id) => {
          const result = await deleteClientAction(id);

          if (!result.success) {
            throw new Error(result.error || `Не удалось удалить клиента ${id}`);
          }

          return id;
        })
      );

      const deletedIds: string[] = [];
      const failedIds: string[] = [];

      results.forEach((result, index) => {
        const currentId = idsToDelete[index];

        if (result.status === 'fulfilled') {
          deletedIds.push(currentId);
        } else {
          failedIds.push(currentId);
        }
      });

      deletedIds.forEach((id) => {
        deleteClient(String(id));
      });

      setSelectedIds((prev) =>
        prev.filter((id) => !deletedIds.includes(String(id)))
      );

      router.refresh();

      if (failedIds.length > 0) {
        notifyError(
          `Удаление завершено частично.\n\nУдалено: ${deletedIds.length}\nНе удалось: ${failedIds.length}`
        );
      }
    } catch {
      notifyError('Произошла ошибка при удалении из базы данных');
    }
  };

  // ---------------------------------------------------------------------------
  // DnD: определение целевого статуса при перетаскивании
  //
  // ACTIVE_STATUS_ID_SET из ядра заменяет локальный STAGE_IDS.
  // O(1)-проверка через Set остаётся — только источник данных теперь правильный.
  // ---------------------------------------------------------------------------

  const resolveDropStatus = (
    overId: string,
    allClients: Client[]
  ): ClientStatus | null => {
    // Случай 1: карточку бросили на саму колонку (overId = id статуса)
    if (ACTIVE_STATUS_ID_SET.has(overId as ClientStatus)) {
      return overId as ClientStatus;
    }

    // Случай 2: карточку бросили на другую карточку — берём статус той карточки
    const overClient = allClients.find(
      (client) => String(client.id) === String(overId)
    );

    if (!overClient) {
      return null;
    }

    // Убеждаемся, что статус целевой карточки — активный (не терминальный).
    // Нельзя перетащить клиента на архивную колонку через DnD.
    const status = overClient.status as ClientStatus;
    return ACTIVE_STATUS_ID_SET.has(status) ? status : null;
  };

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event;

    if (!over) return;

    const activeClientId = String(active.id);
    const overId = String(over.id);

    const draggedClient = clients.find(
      (client) => String(client.id) === activeClientId
    );

    if (!draggedClient) return;

    const previousStatus = draggedClient.status;
    const nextStatus = resolveDropStatus(overId, clients);

    if (!nextStatus) return;
    if (previousStatus === nextStatus) return;

    // Оптимистичное обновление — UI реагирует мгновенно
    updateClient(activeClientId, { status: nextStatus });

    const result = await updateClientAction(activeClientId, {
      status: nextStatus,
    });

    if (!result.success) {
      // Откат при ошибке сервера
      updateClient(activeClientId, { status: previousStatus });
      notifyError('Ошибка сохранения статуса. Изменения отменены.');
      return;
    }

    router.refresh();
  };

  // ---------------------------------------------------------------------------
  // Рендер
  // ---------------------------------------------------------------------------

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.mainWrapper}>

        {/* ── Боковая панель ───────────────────────────────────────────── */}
        <aside className={styles.sidebar}>
          <button
            onClick={() => router.push('/dashboard')}
            className={styles.filterBtn}
            style={{
              background: 'transparent',
              borderColor: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.4)',
              marginBottom: '10px',
            }}
          >
            ← ГЛАВНОЕ МЕНЮ
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text"
              placeholder="Поиск..."
              className={styles.sidebarInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <button
              className={styles.addClientBtn}
              onClick={() => setIsAddingNew(true)}
            >
              + КЛИЕНТ
            </button>
          </div>

          <div
            style={{
              height: '1px',
              background: 'rgba(123, 255, 0, 0.1)',
              margin: '10px 0',
            }}
          />

          <div className={styles.quickFilters}>
            <button className={styles.filterBtn}>🔥 ГОРЯЩИЕ</button>
            <button className={styles.filterBtn}>💸 ДОЛЖНИКИ</button>
          </div>

          {selectedIds.length > 0 && (
            <div className={styles.actionPanel}>
              <div
                style={{
                  color: '#7BFF00',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  textAlign: 'center',
                  textTransform: 'uppercase',
                }}
              >
                ВЫБРАНО: {selectedIds.length}
              </div>

              <button onClick={deleteSelected} className={styles.deleteBtn}>
                УДАЛИТЬ КАРТОЧКИ
              </button>

              <button
                onClick={clearSelection}
                className={styles.filterBtn}
                style={{
                  width: '100%',
                  fontSize: '0.65rem',
                  background: 'transparent',
                }}
              >
                ОТМЕНА
              </button>
            </div>
          )}
        </aside>

        {/* ── Канбан-доска ─────────────────────────────────────────────── */}
        <div className={styles.board}>
          {KANBAN_STAGES.map((stage) => (
            <StageColumn
              key={stage.id}
              id={stage.id}
              stage={stage}
              clients={filteredClients.filter(
                (client) => client.status === stage.id
              )}
              selectedIds={selectedIds}
              onClientSelect={toggleSelect}
              onClientEdit={(client) => setEditingClient(client)}
              onClientOpenFull={(client) =>
                router.push(`/dashboard/new-calculation?id=${String(client.id)}`)
              }
            />
          ))}
        </div>

        {/* ── Модалы ───────────────────────────────────────────────────── */}
        {editingClient && (
          <EditModal
            client={editingClient}
            onClose={() => setEditingClient(null)}
          />
        )}

        {isAddingNew && (
          <CreateClientModal onClose={() => setIsAddingNew(false)} />
        )}
      </div>
    </DndContext>
  );
}