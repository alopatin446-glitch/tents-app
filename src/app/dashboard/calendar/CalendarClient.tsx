'use client';

/**
 * CalendarClient — интерактивный глобальный календарь монтажей и календарных событий.
 *
 * Поддерживает:
 * - монтажи из заказов;
 * - личные события;
 * - выходные / блокировки дней;
 * - создание событий через UI;
 * - удаление личных событий и выходных;
 * - разные визуальные типы карточек;
 * - drag-and-drop только для монтажей;
 * - мягкое предупреждение при переносе монтажа на выходной или блокировку;
 * - серую подсветку заблокированных дней;
 * - безопасную работу с частично разными структурами данных из page.tsx/API.
 * - загрузку активных монтажников из БД через /api/team-members (с fallback на статику).
 */

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  type CSSProperties,
  type FormEvent,
} from 'react';
import Link from 'next/link';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { logger } from '@/lib/logger';
import { TEAM_MEMBERS, MOUNTING_STATUS_LABELS, type TeamMemberConfig } from '@/constants/pricing';
import {
  detectScheduleConflicts,
  formatMountingMoney,
  getEventDates,
} from '@/lib/logic/mountingCalculations';
import type { MountingStatus } from '@/types/mounting';
import styles from './calendar.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// Типы
// ─────────────────────────────────────────────────────────────────────────────

type CalendarEventType = 'installation' | 'personal' | 'dayOff';

type NewCalendarEventType = 'personal' | 'dayOff';

interface CalendarEventView {
  id?: string;
  type?: CalendarEventType | string;

  clientId?: string;
  clientName?: string;
  address?: string | null;

  title?: string | null;
  description?: string | null;

  date?: string | Date | null;
  mountingDate: string;
  durationDays: number;
  startTime: string;
  endTime: string;

  memberId?: string | null;
  memberName?: string;
  memberColor?: string;
  isGlobal?: boolean;

  status?: MountingStatus;
  retailFinal?: number;
  isConflict?: boolean;
}

interface CalendarClientProps {
  initialEvents?: CalendarEventView[];
  events?: CalendarEventView[];
  /**
   * Список активных монтажников, предзагруженный родительским серверным компонентом.
   * Если не передан — компонент самостоятельно запросит /api/team-members.
   * Backward compatible: пропс необязателен.
   */
  teamMembers?: TeamMemberConfig[];
}

interface ToastMessage {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  message: string;
}

interface DragPayload {
  clientId: string;
  event: CalendarEventView;
}

interface DropTargetData {
  date: string;
  memberId: string | null;
}

interface PendingDropState {
  event: CalendarEventView;
  newDate: string;
  newMemberId: string | null;
}

interface EventFormState {
  type: NewCalendarEventType;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  durationDays: number;
  isGlobal: boolean;
  memberId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Вспомогательные функции
// ─────────────────────────────────────────────────────────────────────────────

function buildMonthGrid(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);

  const cells: Date[] = [];
  for (let i = 0; i < 35; i += 1) {
    cells.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }

  const grid: Date[][] = [];
  for (let i = 0; i < 35; i += 7) grid.push(cells.slice(i, i + 7));
  return grid;
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function normalizeDateValue(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (value instanceof Date) return toDateStr(value);
  return String(value).slice(0, 10);
}

function getEventType(event: CalendarEventView): CalendarEventType {
  if (event.type === 'personal') return 'personal';
  if (event.type === 'dayOff') return 'dayOff';
  return 'installation';
}

function isInstallation(event: CalendarEventView): boolean {
  return getEventType(event) === 'installation';
}

/**
 * Возвращает безопасный memberId из события.
 * Принимает members как параметр для поддержки динамического списка.
 */
function evSafeMember(memberId: string | null | undefined, members: TeamMemberConfig[]): string {
  return memberId || members[0]?.id || '';
}

function getEventKey(event: CalendarEventView): string {
  return event.id || event.clientId || `${getEventType(event)}-${event.mountingDate}-${event.title || 'event'}`;
}

function getEventTitle(event: CalendarEventView): string {
  const type = getEventType(event);
  if (type === 'dayOff') return event.title || (event.isGlobal ? 'Выходной для всех' : 'Выходной');
  if (type === 'personal') return event.title || 'Личное событие';
  return event.clientName || event.title || 'Монтаж';
}

function getTypeLabel(event: CalendarEventView): string {
  const type = getEventType(event);
  if (type === 'dayOff') return event.isGlobal ? 'Выходной для всех' : 'Выходной';
  if (type === 'personal') return 'Личное событие';
  return 'Монтаж';
}

function getStatusColor(status?: MountingStatus): string {
  switch (status) {
    case 'completed': return '#7BFF00';
    case 'confirmed': return '#00E5FF';
    default: return '#FFD600';
  }
}

/**
 * Стиль карточки события.
 * Принимает members для поиска цвета монтажника.
 */
function getEventCardStyle(event: CalendarEventView, members: TeamMemberConfig[]): CSSProperties {
  const type = getEventType(event);
  const member = members.find((m) => m.id === event.memberId);

  if (type === 'dayOff') {
    return {
      borderLeftColor: '#FF4D4D',
      background: 'rgba(255, 77, 77, 0.13)',
      boxShadow: '0 0 14px rgba(255, 77, 77, 0.15)',
    };
  }

  if (type === 'personal') {
    return {
      borderLeftColor: '#FFD600',
      background: 'rgba(255, 214, 0, 0.12)',
      boxShadow: '0 0 14px rgba(255, 214, 0, 0.12)',
    };
  }

  return { borderLeftColor: member?.color ?? '#7BFF00' };
}

/**
 * Создаёт дефолтное состояние формы для нового события.
 * Принимает members для выбора первого монтажника по умолчанию.
 */
function createDefaultFormState(
  type: NewCalendarEventType,
  date: string,
  members: TeamMemberConfig[],
): EventFormState {
  return {
    type,
    title: type === 'dayOff' ? 'Выходной' : 'Личное событие',
    description: '',
    date,
    startTime: '09:00',
    endTime: '18:00',
    durationDays: 1,
    isGlobal: type === 'dayOff',
    memberId: members[0]?.id || '',
  };
}

function normalizeCalendarEvent(raw: CalendarEventView | any): CalendarEventView | null {
  const mountingDate = normalizeDateValue(raw?.mountingDate || raw?.date);
  if (!mountingDate) return null;

  const type = getEventType({ ...raw, mountingDate, durationDays: 1, startTime: '09:00', endTime: '18:00' });

  return {
    ...raw,
    id: raw?.id ? String(raw.id) : undefined,
    type,
    clientId: raw?.clientId ? String(raw.clientId) : undefined,
    clientName: raw?.clientName || raw?.title || (type === 'dayOff' ? 'Выходной' : 'Событие'),
    address: raw?.address || '',
    title: raw?.title || (type === 'dayOff' ? 'Выходной' : type === 'personal' ? 'Личное событие' : raw?.clientName || 'Монтаж'),
    description: raw?.description || '',
    mountingDate,
    durationDays: Math.max(1, Number(raw?.durationDays || 1)),
    startTime: raw?.startTime || '09:00',
    endTime: raw?.endTime || '18:00',
    memberId: raw?.isGlobal ? null : raw?.memberId || null,
    isGlobal: Boolean(raw?.isGlobal),
    status: type === 'installation' ? raw?.status : undefined,
    retailFinal: Number(raw?.retailFinal || raw?.retail || 0),
    isConflict: Boolean(raw?.isConflict),
  };
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель',
  'Май', 'Июнь', 'Июль', 'Август',
  'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const FIELD_STYLE: CSSProperties = {
  width: '100%',
  borderRadius: 14,
  border: '1px solid rgba(123, 255, 0, 0.35)',
  background: 'rgba(7, 12, 24, 0.92)',
  color: '#F5F7FF',
  padding: '10px 12px',
  outline: 'none',
};

const LABEL_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  color: 'rgba(245, 247, 255, 0.72)',
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

// ─────────────────────────────────────────────────────────────────────────────
// Карточка события
// ─────────────────────────────────────────────────────────────────────────────

interface EventCardProps {
  event: CalendarEventView;
  isDragging?: boolean;
  members: TeamMemberConfig[];
}

function EventCard({ event, isDragging = false, members }: EventCardProps) {
  const type = getEventType(event);
  const member = members.find((m) => m.id === event.memberId);
  const statusColor = getStatusColor(event.status);
  const title = getEventTitle(event);
  const cardStyle = getEventCardStyle(event, members);

  return (
    <div
      className={`${styles.eventCard} ${event.isConflict ? styles.eventCardConflict : ''} ${isDragging ? styles.eventCardDragging : ''}`}
      style={cardStyle}
    >
      <div className={styles.eventCardHeader}>
        {type === 'installation' ? (
          <span
            className={styles.eventStatusDot}
            style={{ backgroundColor: statusColor }}
            title={event.status ? MOUNTING_STATUS_LABELS[event.status] : 'Ожидает'}
          />
        ) : (
          <span
            className={styles.eventStatusDot}
            style={{ backgroundColor: type === 'dayOff' ? '#FF4D4D' : '#FFD600' }}
            title={getTypeLabel(event)}
          />
        )}

        <span className={styles.eventClientName}>{title}</span>

        {event.isConflict && type === 'installation' && (
          <span className={styles.conflictIcon} title="Конфликт расписания">⚠</span>
        )}
      </div>

      <div className={styles.eventTime}>
        {event.startTime || '09:00'} – {event.endTime || '18:00'}
      </div>

      <div
        className={styles.eventMember}
        style={{ color: type === 'installation' ? member?.color ?? '#7BFF00' : type === 'dayOff' ? '#FF4D4D' : '#FFD600' }}
      >
        {type === 'installation'
          ? member?.name ?? 'Не назначен'
          : event.isGlobal
            ? 'Все бригады'
            : member?.name ?? 'Без монтажника'}
      </div>

      {event.durationDays > 1 && (
        <div className={styles.eventDuration}>📅 {event.durationDays} дн.</div>
      )}

      {type === 'installation' ? (
        <div className={styles.eventPrice}>{formatMountingMoney(event.retailFinal || 0)}</div>
      ) : event.description ? (
        <div className={styles.eventDuration}>{event.description}</div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ячейка дня
// ─────────────────────────────────────────────────────────────────────────────

interface DayCell {
  date: Date;
  isToday: boolean;
  isWeekend: boolean;
  isOutsideMonth: boolean;
  events: CalendarEventView[];
}

interface DroppableDayCellProps extends DayCell {
  targetMemberId: string | null;
  onEventClick: (event: CalendarEventView) => void;
  members: TeamMemberConfig[];
}

function DroppableDayCell({
  date,
  isToday,
  isWeekend,
  isOutsideMonth,
  events,
  targetMemberId,
  onEventClick,
  members,
}: DroppableDayCellProps) {
  const dateStr = toDateStr(date);
  const dayOffEvents = events.filter((ev) => getEventType(ev) === 'dayOff');
  const hasGlobalDayOff = dayOffEvents.some((ev) => ev.isGlobal);
  const hasAnyDayOff = dayOffEvents.length > 0;

  const { setNodeRef, isOver } = useDroppable({
    id: dateStr,
    data: {
      date: dateStr,
      memberId: targetMemberId,
    } satisfies DropTargetData,
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        ${styles.dayCell}
        ${isToday ? styles.dayCellToday : ''}
        ${isWeekend ? styles.dayCellWeekend : ''}
        ${isOutsideMonth ? styles.dayCellOutsideMonth ?? '' : ''}
        ${isOver ? styles.dayCellOver : ''}
      `}
      style={{
        ...(isOutsideMonth ? { opacity: 0.42 } : null),
        ...(hasAnyDayOff ? {
          background: hasGlobalDayOff
            ? 'linear-gradient(135deg, rgba(255,77,77,0.18), rgba(255,77,77,0.06))'
            : 'linear-gradient(135deg, rgba(255,214,0,0.13), rgba(255,214,0,0.04))',
          boxShadow: hasGlobalDayOff
            ? 'inset 0 0 0 1px rgba(255, 77, 77, 0.85)'
            : 'inset 0 0 0 1px rgba(255, 214, 0, 0.55)',
        } : null),
      }}
      title={hasGlobalDayOff ? 'День заблокирован для всех монтажников' : hasAnyDayOff ? 'Есть выходной / блокировка монтажника' : undefined}
    >
      <span className={styles.dayNumber}>{date.getDate()}</span>
      <div className={styles.dayEvents}>
        {events.map((ev) => (
          <DraggableEventCard
            key={getEventKey(ev)}
            event={ev}
            onEventClick={onEventClick}
            members={members}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Draggable-обёртка
// ─────────────────────────────────────────────────────────────────────────────

interface DraggableEventCardProps {
  event: CalendarEventView;
  onEventClick: (event: CalendarEventView) => void;
  members: TeamMemberConfig[];
}

function DraggableEventCard({ event, onEventClick, members }: DraggableEventCardProps) {
  const draggable = isInstallation(event) && Boolean(event.clientId);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: event.clientId || getEventKey(event),
    disabled: !draggable,
    data: draggable
      ? ({ event, clientId: event.clientId || '' } satisfies DragPayload)
      : undefined,
  });

  return (
    <div
      ref={setNodeRef}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
      onClick={() => !isDragging && onEventClick(event)}
      style={{ opacity: isDragging ? 0.4 : 1, cursor: draggable ? 'grab' : 'pointer' }}
    >
      <EventCard event={event} isDragging={isDragging} members={members} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Модальное окно создания события
// ─────────────────────────────────────────────────────────────────────────────

interface CreateEventModalProps {
  form: EventFormState | null;
  onChange: (patch: Partial<EventFormState>) => void;
  onClose: () => void;
  onSubmit: () => void;
  isSaving: boolean;
  members: TeamMemberConfig[];
}

function CreateEventModal({ form, onChange, onClose, onSubmit, isSaving, members }: CreateEventModalProps) {
  if (!form) return null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <form className={styles.modalCard} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <button type="button" className={styles.modalClose} onClick={onClose}>✕</button>

        <h3 className={styles.modalTitle}>
          {form.type === 'dayOff' ? '🚫 Добавить выходной / блокировку' : '📝 Добавить личное событие'}
        </h3>

        <div style={{ display: 'grid', gap: 14 }}>
          <label style={LABEL_STYLE}>
            Тип события
            <select
              style={FIELD_STYLE}
              value={form.type}
              onChange={(e) => {
                const type = e.target.value as NewCalendarEventType;
                onChange({
                  type,
                  title: type === 'dayOff' ? 'Выходной' : 'Личное событие',
                  isGlobal: type === 'dayOff' ? true : form.isGlobal,
                });
              }}
            >
              <option value="personal">Личное событие</option>
              <option value="dayOff">Выходной / блокировка</option>
            </select>
          </label>

          <label style={LABEL_STYLE}>
            Название
            <input
              style={FIELD_STYLE}
              value={form.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Например: отпуск, личная встреча, выходной"
              required
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={LABEL_STYLE}>
              Дата
              <input
                style={FIELD_STYLE}
                type="date"
                value={form.date}
                onChange={(e) => onChange({ date: e.target.value })}
                required
              />
            </label>

            <label style={LABEL_STYLE}>
              Дней
              <input
                style={FIELD_STYLE}
                type="number"
                min={1}
                value={form.durationDays}
                onChange={(e) => onChange({ durationDays: Math.max(1, Number(e.target.value || 1)) })}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={LABEL_STYLE}>
              Начало
              <input
                style={FIELD_STYLE}
                type="time"
                value={form.startTime}
                onChange={(e) => onChange({ startTime: e.target.value })}
              />
            </label>

            <label style={LABEL_STYLE}>
              Конец
              <input
                style={FIELD_STYLE}
                type="time"
                value={form.endTime}
                onChange={(e) => onChange({ endTime: e.target.value })}
              />
            </label>
          </div>

          <label style={{ ...LABEL_STYLE, flexDirection: 'row', alignItems: 'center', textTransform: 'none', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={form.isGlobal}
              onChange={(e) => onChange({ isGlobal: e.target.checked })}
            />
            Заблокировать для всех монтажников
          </label>

          {!form.isGlobal && (
            <label style={LABEL_STYLE}>
              Монтажник
              <select
                style={FIELD_STYLE}
                value={form.memberId}
                onChange={(e) => onChange({ memberId: e.target.value })}
              >
                {members.length === 0 ? (
                  <option value="">— Нет активных монтажников —</option>
                ) : (
                  members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))
                )}
              </select>
            </label>
          )}

          <label style={LABEL_STYLE}>
            Заметка
            <textarea
              style={{ ...FIELD_STYLE, minHeight: 86, resize: 'vertical' }}
              value={form.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Комментарий для менеджера"
            />
          </label>
        </div>

        <div className={styles.modalActions}>
          <button type="button" className={styles.modalBtnCancel} onClick={onClose}>Отмена</button>
          <button type="submit" className={styles.modalBtnConfirm} disabled={isSaving}>
            {isSaving ? 'Сохраняю...' : 'Создать'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Модальное окно деталей
// ─────────────────────────────────────────────────────────────────────────────

interface EventDetailModalProps {
  event: CalendarEventView | null;
  onClose: () => void;
  onDelete: (event: CalendarEventView) => void;
  isDeleting: boolean;
  members: TeamMemberConfig[];
}

function EventDetailModal({ event, onClose, onDelete, isDeleting, members }: EventDetailModalProps) {
  if (!event) return null;

  const type = getEventType(event);
  const member = members.find((m) => m.id === event.memberId);
  const statusColor = getStatusColor(event.status);
  const title = getEventTitle(event);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <button className={styles.modalClose} onClick={onClose}>✕</button>

        <h3 className={styles.modalTitle}>
          <span style={{ color: type === 'dayOff' ? '#FF4D4D' : type === 'personal' ? '#FFD600' : member?.color ?? '#7BFF00' }}>
            {type === 'dayOff' ? '🚫' : type === 'personal' ? '📝' : '📋'}
          </span>
          {' '}{type === 'installation' ? 'Детали монтажа' : 'Детали события'}
        </h3>

        <div className={styles.modalGrid}>
          <div className={styles.modalRow}>
            <span className={styles.modalLabel}>Тип:</span>
            <span className={styles.modalValue}>{getTypeLabel(event)}</span>
          </div>

          <div className={styles.modalRow}>
            <span className={styles.modalLabel}>{type === 'installation' ? 'Клиент:' : 'Название:'}</span>
            <span className={styles.modalValue}>{title}</span>
          </div>

          {type === 'installation' && (
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>Адрес:</span>
              <span className={styles.modalValue}>{event.address || 'Не указан'}</span>
            </div>
          )}

          <div className={styles.modalRow}>
            <span className={styles.modalLabel}>Дата:</span>
            <span className={styles.modalValue}>
              {event.mountingDate}
              {event.durationDays > 1 ? ` – ${event.durationDays} дн.` : ''}
            </span>
          </div>

          <div className={styles.modalRow}>
            <span className={styles.modalLabel}>Время:</span>
            <span className={styles.modalValue}>{event.startTime || '09:00'} – {event.endTime || '18:00'}</span>
          </div>

          <div className={styles.modalRow}>
            <span className={styles.modalLabel}>Бригада:</span>
            <span className={styles.modalValue} style={{ color: member?.color }}>
              {event.isGlobal ? 'Все бригады' : member?.name ?? 'Не назначен'}
            </span>
          </div>

          {type === 'installation' && (
            <>
              <div className={styles.modalRow}>
                <span className={styles.modalLabel}>Статус:</span>
                <span style={{ color: statusColor }}>
                  ● {event.status ? MOUNTING_STATUS_LABELS[event.status] : 'Ожидает'}
                </span>
              </div>
              <div className={styles.modalRow}>
                <span className={styles.modalLabel}>Стоимость:</span>
                <span className={styles.modalValueAccent}>
                  {formatMountingMoney(event.retailFinal || 0)}
                </span>
              </div>
            </>
          )}

          {event.description && (
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>Заметка:</span>
              <span className={styles.modalValue}>{event.description}</span>
            </div>
          )}

          {event.isConflict && type === 'installation' && (
            <div className={styles.modalConflictBanner}>
              ⚠ Конфликт расписания: у монтажника перекрываются даты!
            </div>
          )}
        </div>

        {type === 'installation' && event.clientId && (
          <Link
            href={`/dashboard/new-calculation?id=${encodeURIComponent(event.clientId)}`}
            className={styles.modalActionBtn}
            onClick={onClose}
          >
            Открыть карточку клиента →
          </Link>
        )}

        {type !== 'installation' && event.id && (
          <div className={styles.modalActions}>
            <button className={styles.modalBtnCancel} onClick={onClose}>Закрыть</button>
            <button
              className={styles.modalBtnConfirm}
              onClick={() => onDelete(event)}
              disabled={isDeleting}
              style={{ borderColor: '#FF4D4D', color: '#FF4D4D' }}
            >
              {isDeleting ? 'Удаляю...' : 'Удалить событие'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Подтверждение переноса
// ─────────────────────────────────────────────────────────────────────────────

interface ConfirmDropModalProps {
  pending: PendingDropState | null;
  blockingEvent?: CalendarEventView | null;
  onConfirm: () => void;
  onCancel: () => void;
  members: TeamMemberConfig[];
}

function ConfirmDropModal({ pending, blockingEvent, onConfirm, onCancel, members }: ConfirmDropModalProps) {
  if (!pending) return null;

  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>⚡ Перенос монтажа</h3>
        <p className={styles.modalText}>
          Перенести монтаж <strong>{getEventTitle(pending.event)}</strong>
          {' '}на <strong>{pending.newDate}</strong>?
        </p>
        {pending.newMemberId && pending.newMemberId !== pending.event.memberId ? (
          <p className={styles.modalSubtext}>
            Новый монтажник: <strong>{members.find((m) => m.id === pending.newMemberId)?.name ?? pending.newMemberId}</strong>
          </p>
        ) : null}
        {blockingEvent ? (
          <div className={styles.modalConflictBanner} style={{ borderColor: '#FFD600', color: '#FFD600' }}>
            ⚠ На эту дату стоит блокировка: {getEventTitle(blockingEvent)}. Можно продолжить вручную, если это осознанное исключение.
          </div>
        ) : (
          <p className={styles.modalSubtext}>Цена будет пересчитана автоматически.</p>
        )}
        <div className={styles.modalActions}>
          <button className={styles.modalBtnCancel} onClick={onCancel}>Отмена</button>
          <button className={styles.modalBtnConfirm} onClick={onConfirm}>
            {blockingEvent ? 'Перенести всё равно' : 'Перенести'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToastContainer({ toasts }: { toasts: ToastMessage[] }) {
  if (toasts.length === 0) return null;

  return (
    <div className={styles.toastContainer}>
      {toasts.map((t) => (
        <div key={t.id} className={`${styles.toast} ${styles[`toast_${t.type}`]}`}>
          {t.type === 'error' && '🔴 '}
          {t.type === 'warning' && '⚠️ '}
          {t.type === 'success' && '✅ '}
          {t.type === 'info' && 'ℹ️ '}
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Чип монтажника как зона переноса
// ─────────────────────────────────────────────────────────────────────────────

interface DroppableMemberChipProps {
  member: TeamMemberConfig;
  selected: boolean;
  eventsCount: number;
  hasConflict: boolean;
  onClick: () => void;
}

function DroppableMemberChip({
  member,
  selected,
  eventsCount,
  hasConflict,
  onClick,
}: DroppableMemberChipProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `member-${member.id}`,
    data: {
      date: '',
      memberId: member.id,
    } satisfies DropTargetData,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      className={`${styles.memberChip} ${selected ? styles.memberChipActive : ''}`}
      style={isOver ? { boxShadow: `0 0 0 2px ${member.color}, 0 0 18px ${member.color}` } : undefined}
      title="Можно перетащить монтаж на этот чип, чтобы сменить монтажника без смены даты"
    >
      <span style={{ color: member.color }}>●</span>
      {member.name.split(' ')[0]}
      <span className={styles.memberChipCount}>{eventsCount}</span>
      {hasConflict && <span className={styles.memberChipConflict}>⚠</span>}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Главный компонент
// ─────────────────────────────────────────────────────────────────────────────

export default function CalendarClient({
  initialEvents,
  events: eventsProp,
  teamMembers: teamMembersFromProp,
}: CalendarClientProps) {
  const today = new Date();
  const sourceEvents = initialEvents ?? eventsProp ?? [];

  const normalizedInitialEvents = useMemo<CalendarEventView[]>(() => {
    return (Array.isArray(sourceEvents) ? sourceEvents : [])
      .map((event) => normalizeCalendarEvent(event))
      .filter((event): event is CalendarEventView => Boolean(event));
  }, [sourceEvents]);

  const [events, setEvents] = useState<CalendarEventView[]>(normalizedInitialEvents);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedMemberId, setSelectedMemberId] = useState<string | 'all'>('all');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventView | null>(null);
  const [pendingDrop, setPendingDrop] = useState<PendingDropState | null>(null);
  const [activeEvent, setActiveEvent] = useState<CalendarEventView | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [eventForm, setEventForm] = useState<EventFormState | null>(null);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);

  // ── Загрузка монтажников из БД (если не переданы пропом) ─────────────────
  const [fetchedMembers, setFetchedMembers] = useState<TeamMemberConfig[] | null>(null);

  useEffect(() => {
    if (teamMembersFromProp !== undefined) return;

    let cancelled = false;

    fetch('/api/team-members')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<TeamMemberConfig[]>;
      })
      .then((data) => {
        if (cancelled) return;
        setFetchedMembers(Array.isArray(data) ? data : null);
      })
      .catch((error) => {
        if (cancelled) return;
        logger.error('[CalendarClient] Не удалось загрузить бригаду из API', error);
        // fetchedMembers остаётся null → effectiveMembers упадёт на TEAM_MEMBERS
      });

    return () => {
      cancelled = true;
    };
  }, [teamMembersFromProp]);

  /**
   * Итоговый список монтажников:
   *   1. Если проп передан (включая пустой массив) — используем его.
   *   2. Если проп не передан, но API вернул данные — используем из API.
   *   3. Иначе — статический TEAM_MEMBERS (fallback).
   */
  const effectiveMembers = useMemo<TeamMemberConfig[]>(() => {
    if (teamMembersFromProp !== undefined) return teamMembersFromProp;
    if (fetchedMembers !== null) return fetchedMembers;
    return TEAM_MEMBERS as TeamMemberConfig[];
  }, [teamMembersFromProp, fetchedMembers]);

  const addToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const monthGrid = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const filteredEvents = useMemo(() => {
    const safeEvents = Array.isArray(events) ? events : [];
    if (selectedMemberId === 'all') return safeEvents;

    return safeEvents.filter((event) => {
      if (event.isGlobal) return true;
      return event.memberId === selectedMemberId;
    });
  }, [events, selectedMemberId]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventView[]>();
    for (const ev of filteredEvents) {
      const dates = getEventDates(ev.mountingDate, ev.durationDays || 1);
      for (const dateStr of dates) {
        if (!map.has(dateStr)) map.set(dateStr, []);
        map.get(dateStr)!.push(ev);
      }
    }
    return map;
  }, [filteredEvents]);

  const monthStats = useMemo(() => {
    const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
    const monthEvents = events.filter((e) => e.mountingDate.startsWith(monthPrefix));
    const installationEvents = monthEvents.filter((e) => isInstallation(e));
    const personalEvents = monthEvents.filter((e) => getEventType(e) === 'personal');
    const dayOffEvents = monthEvents.filter((e) => getEventType(e) === 'dayOff');
    const totalRevenue = installationEvents.reduce((sum, e) => sum + (e.retailFinal || 0), 0);
    const conflicts = installationEvents.filter((e) => e.isConflict).length;

    return {
      count: installationEvents.length,
      personalCount: personalEvents.length,
      dayOffCount: dayOffEvents.length,
      totalRevenue,
      conflicts,
    };
  }, [events, viewYear, viewMonth]);

  const findBlockingDayOff = useCallback((dateStr: string, memberId?: string | null) => {
    return events.find((event) => {
      if (getEventType(event) !== 'dayOff') return false;
      const dates = getEventDates(event.mountingDate, event.durationDays || 1);
      if (!dates.includes(dateStr)) return false;
      if (event.isGlobal) return true;
      return Boolean(memberId) && event.memberId === memberId;
    });
  }, [events]);

  const openCreateEvent = (type: NewCalendarEventType) => {
    const currentMonthDate = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01`;
    const defaultDate = viewYear === today.getFullYear() && viewMonth === today.getMonth()
      ? toDateStr(today)
      : currentMonthDate;
    setEventForm(createDefaultFormState(type, defaultDate, effectiveMembers));
  };

  const handleCreateEvent = useCallback(async () => {
    if (!eventForm) return;

    if (!eventForm.date) {
      addToast('error', 'Укажите дату события');
      return;
    }

    if (!eventForm.isGlobal && !eventForm.memberId) {
      addToast('error', 'Выберите монтажника или включите блокировку для всех');
      return;
    }

    setIsSavingEvent(true);

    try {
      const payload = {
        type: eventForm.type,
        title: eventForm.title.trim() || (eventForm.type === 'dayOff' ? 'Выходной' : 'Личное событие'),
        description: eventForm.description.trim() || null,
        date: eventForm.date,
        startTime: eventForm.startTime || '09:00',
        endTime: eventForm.endTime || '18:00',
        durationDays: Math.max(1, Number(eventForm.durationDays || 1)),
        isGlobal: Boolean(eventForm.isGlobal),
        memberId: eventForm.isGlobal ? null : eventForm.memberId,
      };

      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new Error(`HTTP : `);
      }

      const created = await res.json();
      const normalized = normalizeCalendarEvent({
        ...created,
        mountingDate: created.mountingDate || created.date || payload.date,
        type: created.type || payload.type,
      });

      if (normalized) {
        setEvents((prev) => [...prev, normalized]);
      }

      setEventForm(null);
      addToast('success', payload.type === 'dayOff' ? 'Выходной добавлен' : 'Личное событие добавлено');
      logger.info('[CalendarClient] Событие календаря создано', payload);
    } catch (error) {
      addToast('error', 'Не удалось создать событие календаря');
      logger.error('[CalendarClient] Ошибка создания события календаря', error);
    } finally {
      setIsSavingEvent(false);
    }
  }, [eventForm, addToast]);

  const handleDeleteEvent = useCallback(async (event: CalendarEventView) => {
    if (isInstallation(event) || !event.id) return;

    setIsDeletingEvent(true);

    try {
      const res = await fetch('/api/calendar/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: event.id }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new Error(`HTTP : `);
      }

      setEvents((prev) => prev.filter((item) => item.id !== event.id));
      setSelectedEvent(null);
      addToast('success', 'Событие удалено');
      logger.info('[CalendarClient] Событие календаря удалено', { id: event.id });
    } catch (error) {
      addToast('error', 'Не удалось удалить событие');
      logger.error('[CalendarClient] Ошибка удаления события календаря', error);
    } finally {
      setIsDeletingEvent(false);
    }
  }, [addToast]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  const handleDragStart = (dragEvent: DragStartEvent) => {
    const payload = dragEvent.active.data.current as DragPayload | undefined;
    if (payload?.event && isInstallation(payload.event)) setActiveEvent(payload.event);
  };

  const handleDragEnd = (dragEvent: DragEndEvent) => {
    setActiveEvent(null);

    const { over, active } = dragEvent;
    if (!over || !active.data.current) return;

    const payload = active.data.current as DragPayload;
    const target = over.data.current as DropTargetData | undefined;
    const ev = payload.event;
    const newDate = target?.date || (String(over.id).startsWith('member-') ? ev.mountingDate : String(over.id));
    const newMemberId = target?.memberId || evSafeMember(ev.memberId, effectiveMembers);

    if (!isInstallation(ev)) return;
    if (newDate === 'empty') return;

    const oldMemberId = evSafeMember(ev.memberId, effectiveMembers);
    const isSameDate = newDate === ev.mountingDate;
    const isSameMember = newMemberId === oldMemberId;

    if (isSameDate && isSameMember) return;

    const blockingEvent = findBlockingDayOff(newDate, newMemberId);
    if (blockingEvent) {
      addToast('warning', `На ${newDate} стоит блокировка: ${getEventTitle(blockingEvent)}`);
    }

    setPendingDrop({ event: ev, newDate, newMemberId });
  };

  const confirmDrop = useCallback(async () => {
    if (!pendingDrop) return;
    const { event: ev, newDate, newMemberId } = pendingDrop;

    const blockingEvent = findBlockingDayOff(newDate, newMemberId);

    try {
      const nextEvents = events.map((e) =>
        (e.clientId || '') === (ev.clientId || '') ? { ...e, mountingDate: newDate, memberId: newMemberId } : e,
      );

      setEvents(nextEvents);

      const updatedEntries = nextEvents
        .filter((e) => isInstallation(e) && e.clientId)
        .map((e) => ({
          clientId: e.clientId || '',
          memberId: e.memberId || '',
          mountingDate: e.mountingDate,
          durationDays: e.durationDays || 1,
        }));

      const conflictMap = detectScheduleConflicts(updatedEntries);
      setEvents((prev) =>
        prev.map((e) => ({
          ...e,
          isConflict: isInstallation(e) ? conflictMap.get(e.clientId || '') ?? false : false,
        })),
      );

      const res = await fetch('/api/mounting/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: ev.clientId || '', newDate, memberId: newMemberId }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new Error(`HTTP : `);
      }

      if (blockingEvent) {
        addToast('warning', `Монтаж перенесён на заблокированный день: ${getEventTitle(blockingEvent)}`);
      } else if (conflictMap.get(ev.clientId || '')) {
        addToast('warning', `Конфликт! У монтажника уже назначен монтаж на ${newDate}`);
      } else {
        addToast('success', `Монтаж ${getEventTitle(ev)} перенесён на ${newDate}${newMemberId !== evSafeMember(ev.memberId, effectiveMembers) ? ' и другого монтажника' : ''}`);
      }

      logger.info('[CalendarClient] Монтаж перенесён', { clientId: ev.clientId, newDate, memberId: newMemberId });
    } catch (error) {
      setEvents(normalizedInitialEvents);
      addToast('error', 'Ошибка переноса монтажа — изменения отменены');
      logger.error('[CalendarClient] Ошибка переноса монтажа', error);
    } finally {
      setPendingDrop(null);
    }
  }, [pendingDrop, events, normalizedInitialEvents, addToast, findBlockingDayOff, effectiveMembers]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.calendarPage}>
        <header className={styles.calendarHeader}>
          <div className={styles.headerLeft}>
            <Link href="/dashboard" className={styles.backLink}>← Дашборд</Link>
            <h1 className={styles.pageTitle}>📅 Глобальный календарь</h1>
          </div>

          <div className={styles.headerStats}>
            <div className={styles.statChip}>
              <span className={styles.statChipLabel}>Монтажей в месяц</span>
              <span className={styles.statChipValue}>{monthStats.count}</span>
            </div>
            <div className={styles.statChip}>
              <span className={styles.statChipLabel}>Выручка</span>
              <span className={styles.statChipValue}>{formatMountingMoney(monthStats.totalRevenue)}</span>
            </div>
            <div className={styles.statChip}>
              <span className={styles.statChipLabel}>События</span>
              <span className={styles.statChipValue}>{monthStats.personalCount}</span>
            </div>
            <div className={styles.statChip}>
              <span className={styles.statChipLabel}>Выходные</span>
              <span className={styles.statChipValue}>{monthStats.dayOffCount}</span>
            </div>
            {monthStats.conflicts > 0 && (
              <div className={`${styles.statChip} ${styles.statChipConflict}`}>
                <span className={styles.statChipLabel}>Конфликты</span>
                <span className={styles.statChipValue}>⚠ {monthStats.conflicts}</span>
              </div>
            )}
          </div>
        </header>

        <div className={styles.controlBar}>
          <div className={styles.monthNav}>
            <button className={styles.navBtn} onClick={prevMonth}>‹</button>
            <span className={styles.monthLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
            <button className={styles.navBtn} onClick={nextMonth}>›</button>
            <button className={styles.todayBtn} onClick={goToToday}>Сегодня</button>
            <button className={styles.todayBtn} onClick={() => openCreateEvent('personal')}>+ Личное событие</button>
            <button
              className={styles.todayBtn}
              onClick={() => openCreateEvent('dayOff')}
              style={{ borderColor: '#FF4D4D', color: '#FF4D4D' }}
            >
              + Выходной
            </button>
          </div>

          <div className={styles.memberFilter}>
            <select
              className={styles.memberSelect}
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
            >
              <option value="all">Все монтажники</option>
              {effectiveMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={styles.legendDot} style={{ backgroundColor: '#00E5FF' }} />
            Монтаж
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendDot} style={{ backgroundColor: '#FFD600' }} />
            Личное событие
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendDot} style={{ backgroundColor: '#FF4D4D' }} />
            Выходной / блокировка
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendDot} style={{ backgroundColor: '#FF4D4D' }} />
            Конфликт
          </span>
        </div>

        <div className={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((day) => (
            <div key={day} className={styles.weekdayLabel}>{day}</div>
          ))}
        </div>

        <div className={styles.calendarGrid}>
          {monthGrid.flat().map((date, idx) => {
            const dateStr = toDateStr(date);
            const dayEvents = eventsByDate.get(dateStr) ?? [];
            const isToday = dateStr === toDateStr(today);
            const weekday = date.getDay();
            const isWeekend = weekday === 0 || weekday === 6;
            const isOutsideMonth = date.getMonth() !== viewMonth;

            return (
              <DroppableDayCell
                key={dateStr}
                date={date}
                isToday={isToday}
                isWeekend={isWeekend}
                isOutsideMonth={isOutsideMonth}
                events={dayEvents}
                targetMemberId={selectedMemberId === 'all' ? null : selectedMemberId}
                onEventClick={setSelectedEvent}
                members={effectiveMembers}
              />
            );
          })}
        </div>

        <div className={styles.teamStatusBar}>
          <span className={styles.teamStatusTitle}>Бригады:</span>
          {effectiveMembers.map((m) => {
            const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
            const memberEvents = events.filter(
              (e) => isInstallation(e) && e.memberId === m.id && e.mountingDate.startsWith(monthPrefix),
            );
            const hasConflict = memberEvents.some((e) => e.isConflict);

            return (
              <DroppableMemberChip
                key={m.id}
                member={m}
                selected={selectedMemberId === m.id}
                eventsCount={memberEvents.length}
                hasConflict={hasConflict}
                onClick={() => setSelectedMemberId((prev) => (prev === m.id ? 'all' : m.id))}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeEvent ? <EventCard event={activeEvent} isDragging={true} members={effectiveMembers} /> : null}
        </DragOverlay>
      </div>

      <CreateEventModal
        form={eventForm}
        onChange={(patch) => setEventForm((prev) => (prev ? { ...prev, ...patch } : prev))}
        onClose={() => setEventForm(null)}
        onSubmit={handleCreateEvent}
        isSaving={isSavingEvent}
        members={effectiveMembers}
      />

      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onDelete={handleDeleteEvent}
        isDeleting={isDeletingEvent}
        members={effectiveMembers}
      />

      <ConfirmDropModal
        pending={pendingDrop}
        blockingEvent={pendingDrop ? findBlockingDayOff(pendingDrop.newDate, pendingDrop.newMemberId) : null}
        onConfirm={confirmDrop}
        onCancel={() => setPendingDrop(null)}
        members={effectiveMembers}
      />

      <ToastContainer toasts={toasts} />
    </DndContext>
  );
}