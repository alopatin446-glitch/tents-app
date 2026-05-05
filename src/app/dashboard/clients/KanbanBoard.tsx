'use client';

/**
 * Канбан-доска активных клиентов.
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
import ConfirmDialog from '@/components/ui/ConfirmDialog';

// Типы
import { type Client, type Stage } from '@/types';
import { useClients } from './ClientContext';

// Ядро
import {
  ACTIVE_STATUSES,
  ACTIVE_STATUS_ID_SET,
  type ClientStatus,
} from '@/lib/logic/statusDictionary';

// Типизация пропсов для Канбана
interface KanbanBoardProps {
  initialClients?: Client[]; // Если нужно для синхронизации
  priceMap: Record<string, number>; // ОБЯЗАТЕЛЬНО: наш ценовой справочник
}

const KANBAN_STAGES: Stage[] = ACTIVE_STATUSES.map((s) => ({
  id: s.id,
  title: s.label,
}));

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

// Добавляем priceMap в деструктуризацию пропсов
export default function KanbanBoard({ priceMap }: KanbanBoardProps) {
  const { clients, updateClient, deleteClient } = useClients();
  const router = useRouter();

  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const filteredClients = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(searchQuery);
    if (!normalizedQuery) return clients;

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

  const deleteSelected = async (): Promise<void> => {
    if (selectedIds.length === 0) return;
    setConfirmDeleteOpen(true);
  };

  const handleDeleteConfirmed = async (): Promise<void> => {
    setConfirmDeleteOpen(false);
    if (selectedIds.length === 0) return;

    try {
      const idsToDelete = selectedIds.map((id) => String(id));
      const results = await Promise.allSettled(
        idsToDelete.map(async (id) => {
          const result = await deleteClientAction(id);
          if (!result.success) throw new Error(result.error || `Ошибка удаления ${id}`);
          return id;
        })
      );

      const deletedIds: string[] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') deletedIds.push(idsToDelete[index]);
      });

      deletedIds.forEach((id) => deleteClient(String(id)));
      setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(String(id))));
      router.refresh();
    } catch {
      notifyError('Произошла ошибка при удалении');
    }
  };

  const resolveDropStatus = (overId: string, allClients: Client[]): ClientStatus | null => {
    if (ACTIVE_STATUS_ID_SET.has(overId as ClientStatus)) return overId as ClientStatus;
    const overClient = allClients.find((client) => String(client.id) === String(overId));
    if (!overClient) return null;
    const status = overClient.status as ClientStatus;
    return ACTIVE_STATUS_ID_SET.has(status) ? status : null;
  };

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event;
    if (!over) return;

    const activeClientId = String(active.id);
    const draggedClient = clients.find((client) => String(client.id) === activeClientId);
    if (!draggedClient) return;

    const previousStatus = draggedClient.status;
    const nextStatus = resolveDropStatus(String(over.id), clients);

    if (!nextStatus || previousStatus === nextStatus) return;

    updateClient(activeClientId, { status: nextStatus });
    const result = await updateClientAction(activeClientId, { status: nextStatus });

    if (!result.success) {
      updateClient(activeClientId, { status: previousStatus });
      notifyError('Ошибка сохранения статуса');
      return;
    }
    router.refresh();
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className={styles.mainWrapper}>
        <aside className={styles.sidebar}>
          <button onClick={() => router.push('/dashboard')} className={styles.filterBtn} style={{ background: 'transparent', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>
            ← ГЛАВНОЕ МЕНЮ
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input type="text" placeholder="Поиск..." className={styles.sidebarInput} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <button className={styles.addClientBtn} onClick={() => setIsAddingNew(true)}>
              + КЛИЕНТ
            </button>
          </div>

          <div style={{ height: '1px', background: 'rgba(123, 255, 0, 0.1)', margin: '10px 0' }} />

          <div className={styles.quickFilters}>
            <button className={styles.filterBtn}>🔥 ГОРЯЩИЕ</button>
            <button className={styles.filterBtn}>💸 ДОЛЖНИКИ</button>
          </div>

          {selectedIds.length > 0 && (
            <div className={styles.actionPanel}>
              <div style={{ color: '#7BFF00', fontSize: '0.7rem', fontWeight: 800, textAlign: 'center', textTransform: 'uppercase' }}>
                ВЫБРАНО: {selectedIds.length}
              </div>
              <button onClick={deleteSelected} className={styles.deleteBtn}>УДАЛИТЬ КАРТОЧКИ</button>
              <button onClick={clearSelection} className={styles.filterBtn} style={{ width: '100%', fontSize: '0.65rem', background: 'transparent' }}>
                ОТМЕНА
              </button>
            </div>
          )}
        </aside>

        <div className={styles.board}>
          {KANBAN_STAGES.map((stage) => (
            <StageColumn
              key={stage.id}
              id={stage.id}
              stage={stage}
              clients={filteredClients.filter((client) => client.status === stage.id)}
              selectedIds={selectedIds}
              onClientSelect={toggleSelect}
              onClientEdit={(client) => setEditingClient(client)}
              onClientOpenFull={(client) => router.push(`/dashboard/new-calculation?id=${String(client.id)}`)}
            />
          ))}
        </div>

        {/* ── МОДАЛКИ: ТЕПЕРЬ С PRICEMAP (БИЛД ПРОЙДЕТ) ────────────────── */}
        {editingClient && (
          <EditModal
            client={editingClient}
            priceMap={priceMap}
            onClose={() => setEditingClient(null)}
          />
        )}

        {isAddingNew && (
          <CreateClientModal 
            priceMap={priceMap}
            onClose={() => setIsAddingNew(false)} 
          />
        )}

        <ConfirmDialog
          open={confirmDeleteOpen}
          title={`Удалить выбранных клиентов (${selectedIds.length} шт.)?`}
          description="Это действие необратимо. Все данные карточек будут удалены."
          confirmLabel="Удалить"
          cancelLabel="Отмена"
          variant="danger"
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setConfirmDeleteOpen(false)}
        />
      </div>
    </DndContext>
  );
}