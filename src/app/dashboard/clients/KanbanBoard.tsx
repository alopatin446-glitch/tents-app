'use client';

/**
 * Канбан-доска активных клиентов (Динамическая версия).
 */

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  DragOverlay, // 🔥 НОВОЕ: Оверлей для визуализации перетаскивания
} from '@dnd-kit/core';
import { 
  SortableContext, 
  horizontalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'; // 🔥 НОВОЕ: Контекст сортировки

import { notifyError } from '@/lib/notify';

// Серверные экшены
import { updateClientAction, deleteClientAction } from './actions';
import { createPipelineStage, updatePipelineStagesOrder } from '@/app/actions/pipeline'; // 🔥 НОВОЕ: Экшен сохранения порядка

// Стили и дочерние компоненты
import styles from './KanbanBoard.module.css';
import StageColumn from './StageColumn';
import EditModal from './EditModal';
import CreateClientModal from './CreateClientModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

// Типы
import { type Client } from '@/types';
import { useClients } from './ClientContext';

// 🔥 ВОЗВРАЩАЕМ ИМПОРТ: Нужен для обмана TypeScript при переходе со старого формата на новый
import { type ClientStatus } from '@/lib/logic/statusDictionary';

// Типизация пропсов для Канбана
interface PipelineStage {
  id: string;
  name: string;
  color: string;
  order: number;
  isSystem: boolean;
  isArchive: boolean;
}

interface KanbanBoardProps {
  initialClients?: Client[];
  priceMap: Record<string, number>;
  initialStages: PipelineStage[];
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

export default function KanbanBoard({ priceMap, initialStages }: KanbanBoardProps) {
  const { clients, updateClient, deleteClient } = useClients();
  const router = useRouter();

  // Стейт монтирования
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Стейты для новой стадии
  const [isAddStageOpen, setIsAddStageOpen] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#7BFF00');
  const [isCreatingStage, setIsCreatingStage] = useState(false);

  // 🔥 НОВОЕ: Локальный стейт для колонок, чтобы можно было мгновенно их перемещать
  const [localStages, setLocalStages] = useState(
    initialStages.filter((s) => !s.isArchive).sort((a, b) => a.order - b.order)
  );

  // Обновляем локальный стейт, если сервер прислал новые колонки (например, создали новую)
  useEffect(() => {
    setLocalStages(initialStages.filter((s) => !s.isArchive).sort((a, b) => a.order - b.order));
  }, [initialStages]);

  // Для DragOverlay (что именно мы тащим прямо сейчас)
  const [activeColumn, setActiveColumn] = useState<PipelineStage | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const activeStageIds = useMemo(() => new Set(localStages.map(s => s.id)), [localStages]);

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

  const handleCreateStage = async () => {
    if (!newStageName.trim()) return;
    setIsCreatingStage(true);
    try {
      const result = await createPipelineStage(newStageName, newStageColor);
      if (result.success) {
        setNewStageName('');
        setNewStageColor('#7BFF00');
        setIsAddStageOpen(false);
        router.refresh(); 
      } else {
        notifyError(result.error || 'Ошибка создания стадии');
      }
    } catch {
      notifyError('Ошибка сети при создании стадии');
    } finally {
      setIsCreatingStage(false);
    }
  };

  // 🔥 НОВОЕ: Обработчик НАЧАЛА перетаскивания
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeData = active.data.current;

    // Проверяем, что именно мы потащили (колонку)
    if (activeData?.type === 'Column') {
      setActiveColumn(activeData.stage);
    }
  };

  // 🔥 НОВОЕ: Обработчик ОКОНЧАНИЯ перетаскивания (теперь умеет обрабатывать и карточки, и колонки)
  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    setActiveColumn(null); // Сбрасываем оверлей
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // СЦЕНАРИЙ 1: ПЕРЕТАСКИВАНИЕ КОЛОНКИ
    const isActiveColumn = active.data.current?.type === 'Column';
    if (isActiveColumn) {
      if (activeId !== overId) {
        const oldIndex = localStages.findIndex((s) => s.id === activeId);
        const newIndex = localStages.findIndex((s) => s.id === overId);
        
        // Оптимистично меняем порядок локально (мгновенно)
        const newStages = arrayMove(localStages, oldIndex, newIndex);
        setLocalStages(newStages);

        // Отправляем новый порядок на сервер
        const orderedIds = newStages.map(s => s.id);
        const res = await updatePipelineStagesOrder(orderedIds);
        if (!res.success) {
          notifyError('Не удалось сохранить новый порядок колонок');
          router.refresh(); // Откатываем UI, если сервер выдал ошибку
        }
      }
      return;
    }

    // СЦЕНАРИЙ 2: ПЕРЕТАСКИВАНИЕ КАРТОЧКИ КЛИЕНТА
    const draggedClient = clients.find((client) => String(client.id) === activeId);
    if (!draggedClient) return;

    const previousStatus = draggedClient.status;
    
    // Если кинули поверх колонки
    let nextStatus = overId as ClientStatus | null;
    
    // Если кинули поверх другой карточки — берем статус той карточки
    if (!activeStageIds.has(overId as string)) {
       const overClient = clients.find((client) => String(client.id) === overId);
       if (overClient) {
         nextStatus = String(overClient.status) as ClientStatus;
       } else {
         nextStatus = null;
       }
    }

    if (!nextStatus || !activeStageIds.has(nextStatus as string) || previousStatus === nextStatus) return;

    updateClient(activeId, { status: nextStatus });
    const result = await updateClientAction(activeId, { status: nextStatus });

    if (!result.success) {
      updateClient(activeId, { status: previousStatus });
      notifyError('Ошибка сохранения статуса');
      return;
    }
    router.refresh();
  };

  if (!isMounted) {
    return null;
  }

  // Массив ID для SortableContext
  const columnsId = localStages.map((s) => s.id);

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={closestCorners} 
      onDragStart={handleDragStart} 
      onDragEnd={handleDragEnd}
    >
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

          {/* 🔥 Удалены неработающие кнопки фильтров */}

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
          {/* 🔥 НОВОЕ: Оборачиваем колонки в SortableContext */}
          <SortableContext items={columnsId} strategy={horizontalListSortingStrategy}>
            {localStages.map((stage) => (
              <StageColumn
                key={stage.id}
                id={stage.id as string}
                stage={{ id: stage.id as any, title: stage.name, color: stage.color, isSystem: stage.isSystem }}
                clients={filteredClients.filter((client) => String(client.status) === String(stage.id))}
                selectedIds={selectedIds}
                onClientSelect={toggleSelect}
                onClientEdit={(client) => setEditingClient(client)}
                onClientOpenFull={(client) => router.push(`/dashboard/new-calculation?id=${String(client.id)}`)}
              />
            ))}
          </SortableContext>

          <div className={styles.addStageContainer}>
            <button onClick={() => setIsAddStageOpen(true)} className={styles.addStageBtn}>
              + ДОБАВИТЬ СТАДИЮ
            </button>
          </div>
        </div>

        {/* 🔥 НОВОЕ: Оверлей (призрак колонки, который мы тащим мышкой) */}
        <DragOverlay>
          {activeColumn && (
            <StageColumn
              id={activeColumn.id}
              stage={{ id: activeColumn.id as any, title: activeColumn.name, color: activeColumn.color, isSystem: activeColumn.isSystem }}
              clients={filteredClients.filter((client) => String(client.status) === String(activeColumn.id))}
              selectedIds={selectedIds}
              onClientSelect={() => {}}
              onClientEdit={() => {}}
              onClientOpenFull={() => {}}
            />
          )}
        </DragOverlay>

        {isAddStageOpen && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <h3 className={styles.modalTitle}>Новая стадия</h3>
              <input
                type="text"
                placeholder="Название стадии..."
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                className={styles.modalInput}
                autoFocus
              />
              <div className={styles.colorPickerContainer}>
                <span>Цвет:</span>
                <input
                  type="color"
                  value={newStageColor}
                  onChange={(e) => setNewStageColor(e.target.value)}
                  className={styles.colorInput}
                />
              </div>
              <div className={styles.modalActions}>
                <button onClick={() => setIsAddStageOpen(false)} className={styles.modalCancelBtn}>
                  Отмена
                </button>
                <button onClick={handleCreateStage} disabled={isCreatingStage || !newStageName.trim()} className={styles.modalSaveBtn}>
                  {isCreatingStage ? 'Сохранение...' : 'Создать'}
                </button>
              </div>
            </div>
          </div>
        )}

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