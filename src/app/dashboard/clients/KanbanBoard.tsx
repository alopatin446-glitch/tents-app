'use client';

import { updateClientAction, deleteClientAction } from './actions';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragEndEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
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
  { id: 'special_case', title: 'Особые случаи' }
];

export default function KanbanBoard() {
  const { clients, updateClient, deleteClient } = useClients();
  const router = useRouter();

  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
    );
  };

  // ОБНОВЛЕННОЕ УДАЛЕНИЕ: теперь с сохранением в БД
  const deleteSelected = async () => {
    if (confirm(`Удалить выбранных клиентов (${selectedIds.length} шт.)?`)) {
      try {
        // Удаляем каждого клиента в цикле через серверный экшен
        for (const id of selectedIds) {
          const result = await deleteClientAction(id);
          if (result.success) {
            deleteClient(id); // удаляем из локального контекста для UI
          } else {
            console.error(`Не удалось удалить клиента с id ${id}`);
          }
        }
        setSelectedIds([]);
      } catch (error) {
        alert("Произошла ошибка при удалении из базы данных");
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const clientId = active.id as string;
    const newStatus = over.id as Client['status'];

    // 1. Сначала обновляем локально (для скорости интерфейса)
    updateClient(clientId, { status: newStatus });

    // 2. Отправляем в базу данных
    const result = await updateClientAction(clientId, { status: newStatus });

    if (!result.success) {
      alert("Ошибка сохранения в базу!");
      // Здесь можно добавить логику отката (rollback), если это критично
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className={styles.mainWrapper}>
        <aside className={styles.sidebar}>
          {/* 1. НАВИГАЦИЯ */}
          <button
            onClick={() => router.push('/dashboard')}
            className={styles.filterBtn}
            style={{
              background: 'transparent',
              borderColor: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.4)',
              marginBottom: '10px'
            }}
          >
            ← ГЛАВНОЕ МЕНЮ
          </button>

          {/* 2. ПОИСК И СОЗДАНИЕ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text"
              placeholder="Поиск..."
              className={styles.sidebarInput}
            />
            <button
              className={styles.addClientBtn}
              onClick={() => setIsAddingNew(true)}
            >
              + КЛИЕНТ
            </button>
          </div>

          {/* РАЗДЕЛИТЕЛЬ */}
          <div style={{ height: '1px', background: 'rgba(123, 255, 0, 0.1)', margin: '10px 0' }} />

          {/* 3. ФИЛЬТРЫ */}
          <div className={styles.quickFilters}>
            <button className={styles.filterBtn}>🔥 ГОРЯЩИЕ</button>
            <button className={styles.filterBtn}>💸 ДОЛЖНИКИ</button>
          </div>

          {/* 4. ПАНЕЛЬ УДАЛЕНИЯ */}
          {selectedIds.length > 0 && (
            <div className={styles.actionPanel}>
              <div style={{
                color: '#7BFF00',
                fontSize: '0.7rem',
                fontWeight: 800,
                textAlign: 'center',
                textTransform: 'uppercase'
              }}>
                ВЫБРАНО: {selectedIds.length}
              </div>
              <button onClick={deleteSelected} className={styles.deleteBtn}>
                УДАЛИТЬ КАРТОЧКИ
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className={styles.filterBtn}
                style={{ width: '100%', fontSize: '0.65rem', background: 'transparent' }}
              >
                ОТМЕНА
              </button>
            </div>
          )}
        </aside>

        <div className={styles.board}>
          {STAGES.map(stage => (
            <StageColumn
              key={stage.id}
              id={stage.id}
              stage={stage}
              clients={clients.filter(c => c.status === stage.id)}
              selectedIds={selectedIds}
              onClientSelect={toggleSelect}
              onClientEdit={(client) => setEditingClient(client)}
              onClientOpenFull={(client) => router.push(`/dashboard/new-calculation?id=${client.id}`)}
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