'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation'; // Добавили роутер
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
  const router = useRouter(); // Инициализация навигации
  
  // Состояния для модалок
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

  const deleteSelected = () => {
    if (confirm(`Удалить выбранных клиентов (${selectedIds.length} шт.)?`)) {
      selectedIds.forEach(id => deleteClient(id));
      setSelectedIds([]);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const clientId = active.id as string;
    const newStatus = over.id as Client['status'];
    updateClient(clientId, { status: newStatus });
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

          {selectedIds.length > 0 && (
            <div className={styles.actionPanel}>
              <div style={{color: '#7BFF00', fontSize: '0.75rem', fontWeight: 800}}>ВЫБРАНО: {selectedIds.length}</div>
              <button onClick={deleteSelected} className={styles.deleteBtn}>УДАЛИТЬ КАРТОЧКИ</button>
              <button onClick={() => setSelectedIds([])} className={styles.filterBtn}>ОТМЕНА</button>
            </div>
          )}

          <div style={{marginTop: 'auto'}}>
            <button 
              className="navButton active" 
              style={{width: '100%'}}
              onClick={() => setIsAddingNew(true)}
            >
              + КЛИЕНТ
            </button>
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
              // ВОТ ЗДЕСЬ МАГИЯ: заменяем alert на переход с ID
              onClientOpenFull={(client) => router.push(`/dashboard/new-calculation?id=${client.id}`)}
            />
          ))}
        </div>

        {/* МОДАЛКА РЕДАКТИРОВАНИЯ */}
        {editingClient && (
          <EditModal 
            client={editingClient} 
            onClose={() => setEditingClient(null)} 
          />
        )}

        {/* МОДАЛКА СОЗДАНИЯ */}
        {isAddingNew && (
          <CreateClientModal onClose={() => setIsAddingNew(false)} />
        )}
      </div>
    </DndContext>
  );
}