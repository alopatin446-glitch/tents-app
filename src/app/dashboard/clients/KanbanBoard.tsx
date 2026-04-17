'use client';

import React, { useState } from 'react';
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
import { Client, Stage } from './types';

const STAGES: Stage[] = [
  { id: 'new', title: 'Новые / Замеры' },
  { id: 'calc', title: 'Ожидают расчёт' },
  { id: 'negotiation', title: 'Дожим' },
  { id: 'install', title: 'Монтаж / Оплата' }
];

export default function KanbanBoard() {
  const [clients, setClients] = useState<Client[]>([
    { id: '1', name: 'Иванов А.П.', address: 'ул. Ленина, д. 10', totalPrice: 250000, status: 'new', phone: '+7 900 123-45-67' },
    { id: '2', name: 'Петров С.В.', address: 'СНТ Ромашка, уч. 45', totalPrice: 85000, status: 'new' },
    { id: '3', name: 'Сидоров К.М.', address: 'ул. Мира, 12', totalPrice: 120000, status: 'calc' },
    { id: '4', name: 'ТехноНиколь', address: 'Промзона, корп. 2', totalPrice: 540000, status: 'install', phone: '8 800 555-35-35' },
  ]);

  // СОСТОЯНИЯ
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ЛОГИКА ВЫБОРА (ЛКМ)
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
    );
  };

  // ЛОГИКА УДАЛЕНИЯ ВЫБРАННЫХ
  const deleteSelected = () => {
    if (confirm(`Удалить выбранных клиентов (${selectedIds.length} шт.)?`)) {
      setClients(prev => prev.filter(c => !selectedIds.includes(c.id)));
      setSelectedIds([]);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const clientId = active.id as string;
    const newStatus = over.id as Client['status'];

    setClients((prev) =>
      prev.map((client) =>
        client.id === clientId ? { ...client, status: newStatus } : client
      )
    );
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className={styles.mainWrapper}>
        <aside className={styles.sidebar}>
          <h2 style={{fontSize: '1.1rem', fontWeight: 800, color: '#fff'}}>УПРАВЛЕНИЕ</h2>
          <input type="text" placeholder="Поиск..." className="neonInput" style={{width: '100%'}} />
          
          <div className={styles.quickFilters}>
            <button className={styles.filterBtn}>🔥 ГОРЯЩИЕ</button>
            <button className={styles.filterBtn}>💸 ДОЛЖНИКИ</button>
          </div>

          {/* ПАНЕЛЬ УДАЛЕНИЯ (появляется только если выбрано что-то) */}
          {selectedIds.length > 0 && (
            <div className={styles.actionPanel}>
              <div style={{color: '#7BFF00', fontSize: '0.75rem', fontWeight: 800}}>ВЫБРАНО: {selectedIds.length}</div>
              <button onClick={deleteSelected} className={styles.deleteBtn}>УДАЛИТЬ КАРТОЧКИ</button>
              <button onClick={() => setSelectedIds([])} className={styles.filterBtn} style={{fontSize: '0.7rem', padding: '8px'}}>ОТМЕНА</button>
            </div>
          )}

          <div style={{marginTop: 'auto'}}>
            <button className="navButton active" style={{width: '100%'}}>+ КЛИЕНТ</button>
          </div>
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
              onClientOpenFull={(client) => alert(`Переход в полную карту: ${client.name}`)}
            />
          ))}
        </div>

        {editingClient && (
          <EditModal 
            client={editingClient} 
            onClose={() => setEditingClient(null)} 
          />
        )}
      </div>
    </DndContext>
  );
}