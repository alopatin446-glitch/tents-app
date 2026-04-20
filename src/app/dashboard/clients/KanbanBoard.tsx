'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { updateClientAction, deleteClientAction } from './actions';
import styles from './KanbanBoard.module.css';
import StageColumn from './StageColumn';
import EditModal from './EditModal';
import CreateClientModal from './CreateClientModal';
import { Client, Stage } from './types';
import { useClients } from './ClientContext';

const STAGES: Stage[] = [
  { id: 'negotiation', title: 'Общение с клиентом' },
  { id: 'waiting_measure', title: 'Ожидает замер' },
  { id: 'promised_pay', title: 'Обещал заплатить' },
  { id: 'waiting_production', title: 'Ожидает изделия' },
  { id: 'waiting_install', title: 'Ожидает монтаж' },
  { id: 'special_case', title: 'Особые случаи' },
];

const STAGE_IDS = new Set<Client['status']>(STAGES.map((stage) => stage.id));

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

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

  const toggleSelect = (id: string) => {
    const normalizedId = String(id);

    setSelectedIds((prev) =>
      prev.includes(normalizedId)
        ? prev.filter((itemId) => String(itemId) !== normalizedId)
        : [...prev, normalizedId]
    );
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;

    const confirmed = confirm(`Удалить выбранных клиентов (${selectedIds.length} шт.)?`);
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
        alert(
          `Удаление завершено частично.\n\nУдалено: ${deletedIds.length}\nНе удалено: ${failedIds.length}`
        );
      }
    } catch (error) {
      alert('Произошла ошибка при удалении из базы данных');
    }
  };

  const resolveDropStatus = (
    overId: string,
    allClients: Client[]
  ): Client['status'] | null => {
    if (STAGE_IDS.has(overId as Client['status'])) {
      return overId as Client['status'];
    }

    const overClient = allClients.find(
      (client) => String(client.id) === String(overId)
    );

    if (!overClient) {
      return null;
    }

    return overClient.status;
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const activeClientId = String(active.id);
    const overId = String(over.id);

    const draggedClient = clients.find(
      (client) => String(client.id) === activeClientId
    );

    if (!draggedClient) {
      return;
    }

    const previousStatus = draggedClient.status;
    const nextStatus = resolveDropStatus(overId, clients);

    if (!nextStatus) {
      return;
    }

    if (previousStatus === nextStatus) {
      return;
    }

    updateClient(activeClientId, { status: nextStatus });

    const result = await updateClientAction(activeClientId, {
      status: nextStatus,
    });

    if (!result.success) {
      updateClient(activeClientId, { status: previousStatus });
      alert('Ошибка сохранения в базу!');
      return;
    }

    router.refresh();
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.mainWrapper}>
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

        <div className={styles.board}>
          {STAGES.map((stage) => (
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