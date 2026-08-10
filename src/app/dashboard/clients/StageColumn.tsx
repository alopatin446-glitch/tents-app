'use client';

import React, { useState, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useVirtualizer } from '@tanstack/react-virtual'; // 🔥 НОВОЕ: Виртуализация

import { useRouter } from 'next/navigation';
import styles from './KanbanBoard.module.css';
import ClientCard from './ClientCard';
import { Client, Stage } from './types';
import { updatePipelineStage, deletePipelineStage } from '@/app/actions/pipeline';
import { notifyError, notifySuccess } from '@/lib/notify';

// Расширяем стандартный тип Stage для наших новых нужд
interface ExtendedStage extends Stage {
  color?: string;
  isSystem?: boolean;
}

interface StageColumnProps {
  stage: ExtendedStage;
  clients: Client[];
  id: string;
  selectedIds: string[];
  onClientSelect: (id: string) => void;
  onClientEdit: (client: Client) => void;
  onClientOpenFull: (client: Client) => void;
}

export default function StageColumn({
  stage,
  clients,
  id,
  selectedIds,
  onClientSelect,
  onClientEdit,
  onClientOpenFull
}: StageColumnProps) {
  const router = useRouter();

  // Логика сортировки колонок
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: {
      type: 'Column',
      stage,
    },
  });

  const totalSum = clients.reduce((acc, client) => acc + (client.totalPrice || 0), 0);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(stage.title);
  const [editColor, setEditColor] = useState(stage.color || '#7BFF00');
  const [isSaving, setIsSaving] = useState(false);

  // Стилизуем полоску цвета сверху колонки
  const columnColor = stage.color || 'rgba(123, 255, 0, 0.1)';

  // Стили для анимации перетаскивания колонки
  const dndStyle = {
    transition,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
  };

  // 🔥 НОВОЕ: Настройка виртуализации
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: clients.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 140, // Примерная стартовая высота карточки с отступами
    overscan: 10, // 🔥 Как ты и просил! Рендерим 10 невидимых карточек про запас для плавности
  });

  const handleUpdateStage = async () => {
    if (!editName.trim()) return;
    setIsSaving(true);
    try {
      const res = await updatePipelineStage(id, editName, editColor);
      if (res.success) {
        setIsEditModalOpen(false);
        setIsMenuOpen(false);
        notifySuccess('Стадия обновлена');
        router.refresh();
      } else {
        notifyError(res.error || 'Ошибка при обновлении стадии');
      }
    } catch {
      notifyError('Сетевая ошибка');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStage = async () => {
    if (stage.isSystem) {
      notifyError('Системные стадии удалять нельзя');
      return;
    }
    if (clients.length > 0) {
      notifyError('Нельзя удалить стадию, в которой есть клиенты');
      return;
    }
    
    if (!confirm(`Вы уверены, что хотите удалить стадию "${stage.title}"?`)) return;

    setIsSaving(true);
    try {
      const res = await deletePipelineStage(id);
      if (res.success) {
        setIsEditModalOpen(false);
        setIsMenuOpen(false);
        notifySuccess('Стадия удалена');
        router.refresh();
      } else {
        notifyError(res.error || 'Ошибка при удалении');
      }
    } catch {
      notifyError('Сетевая ошибка');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      ref={setNodeRef} 
      className={styles.column} 
      style={{ ...dndStyle, borderTop: `3px solid ${columnColor}` }}
    >
      
      {/* Шапка колонки с названием, итогами и меню настроек */}
      <div className={styles.columnHeader} style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          
          <div 
            {...attributes} 
            {...listeners} 
            style={{ cursor: 'grab', flexGrow: 1, paddingRight: '10px' }}
            title="Зажмите, чтобы переместить колонку"
          >
            <h3 className={styles.columnTitle} style={{ color: columnColor }}>
              <span style={{ color: 'rgba(255,255,255,0.2)', marginRight: '6px', cursor: 'grab' }}>⠿</span>
              {stage.title}
            </h3>
            <div className={styles.columnMeta}>
              {clients.length} шт. | {totalSum.toLocaleString()} ₽
            </div>
          </div>
          
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={styles.stageMenuBtn}
            title="Настройки стадии"
          >
            ⋮
          </button>
        </div>

        {isMenuOpen && (
          <div className={styles.stageDropdown}>
            <button 
              onClick={() => { setIsEditModalOpen(true); setIsMenuOpen(false); }}
              className={styles.stageDropdownItem}
            >
              Настроить стадию
            </button>
            {!stage.isSystem && (
              <button 
                onClick={handleDeleteStage}
                className={`${styles.stageDropdownItem} ${styles.stageDropdownItemDanger}`}
              >
                Удалить стадию
              </button>
            )}
          </div>
        )}
      </div>

      {/* 🔥 НОВОЕ: Виртуализированный контейнер для карточек */}
      <div 
        ref={parentRef} 
        className={styles.cardsContainer} 
        style={{ overflowY: 'auto', position: 'relative' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const client = clients[virtualRow.index];
            return (
              <div
                key={client.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingBottom: '10px', // Отступ между карточками
                }}
              >
                <ClientCard
                  client={client}
                  isSelected={selectedIds.includes(String(client.id))}
                  onSelect={() => onClientSelect(String(client.id))}
                  onEdit={() => onClientEdit(client)}
                  onOpenFull={() => onClientOpenFull(client)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Модальное окно редактирования стадии */}
      {isEditModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Настройка стадии</h3>
            
            <input
              type="text"
              placeholder="Название стадии..."
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className={styles.modalInput}
              disabled={stage.isSystem} 
            />
            {stage.isSystem && (
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)'}}>Имя базовой колонки нельзя изменить</span>
            )}

            <div className={styles.colorPickerContainer}>
              <span>Цвет колонки:</span>
              <input
                type="color"
                value={editColor}
                onChange={(e) => setEditColor(e.target.value)}
                className={styles.colorInput}
              />
            </div>

            <div className={styles.modalActions}>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className={styles.modalCancelBtn}
              >
                Отмена
              </button>
              <button
                onClick={handleUpdateStage}
                disabled={isSaving || !editName.trim()}
                className={styles.modalSaveBtn}
              >
                {isSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}