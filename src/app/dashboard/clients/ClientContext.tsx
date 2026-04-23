'use client';

/**
 * Контекст списка клиентов для канбан-доски.
 *
 * Хранит актуальный список в памяти и предоставляет методы
 * оптимистичного обновления (без ожидания ответа сервера).
 *
 * Обновление (ШАГ 2.2.1):
 *   - Тип Client теперь использует ClientStatus из ядра (D-05).
 *   - Убрана локальная нормализация — типы гарантируют корректность.
 *
 * @module src/app/dashboard/clients/ClientContext.tsx
 */

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { type Client } from '@/types';

// ---------------------------------------------------------------------------
// Интерфейс контекста
// ---------------------------------------------------------------------------

interface ClientContextType {
  clients: Client[];
  addClient: (client: Client) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Создание контекста
// ---------------------------------------------------------------------------

const ClientContext = createContext<ClientContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------------

function normalizeId(id: unknown): string {
  return String(id);
}

function normalizeClients(clients: Client[]): Client[] {
  if (!Array.isArray(clients)) return [];
  return clients.map((client) => ({
    ...client,
    id: normalizeId(client.id),
  }));
}

// ---------------------------------------------------------------------------
// Провайдер
// ---------------------------------------------------------------------------

interface ClientProviderProps {
  children: ReactNode;
  initialClients?: Client[];
}

export function ClientProvider({
  children,
  initialClients = [],
}: ClientProviderProps) {
  const [clients, setClients] = useState<Client[]>(() =>
    normalizeClients(initialClients)
  );

  // ── addClient ─────────────────────────────────────────────────────────────
  // Если клиент с таким id уже есть — обновляем (upsert).
  // Это защита от двойного добавления при быстром клике.

  const addClient = (client: Client): void => {
    const normalized: Client = { ...client, id: normalizeId(client.id) };

    setClients((prev) => {
      const existingIndex = prev.findIndex(
        (item) => normalizeId(item.id) === normalized.id
      );

      if (existingIndex === -1) {
        return [...prev, normalized];
      }

      return prev.map((item) =>
        normalizeId(item.id) === normalized.id
          ? { ...item, ...normalized }
          : item
      );
    });
  };

  // ── updateClient ──────────────────────────────────────────────────────────
  // Оптимистичное обновление: UI реагирует мгновенно.
  // При ошибке сервера — вызывающий код восстанавливает предыдущий статус.

  const updateClient = (id: string, updates: Partial<Client>): void => {
    const normalizedId = normalizeId(id);

    setClients((prev) =>
      prev.map((client) =>
        normalizeId(client.id) === normalizedId
          ? { ...client, ...updates, id: normalizeId(client.id) }
          : client
      )
    );
  };

  // ── deleteClient ──────────────────────────────────────────────────────────

  const deleteClient = (id: string): void => {
    const normalizedId = normalizeId(id);
    setClients((prev) =>
      prev.filter((client) => normalizeId(client.id) !== normalizedId)
    );
  };

  // ── Мемоизация значения контекста ─────────────────────────────────────────
  // Без useMemo каждый ре-рендер провайдера создаёт новый объект value,
  // что вызывает ре-рендер всех потребителей контекста.

  const value = useMemo<ClientContextType>(
    () => ({ clients, addClient, updateClient, deleteClient }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clients]
  );

  return (
    <ClientContext.Provider value={value}>
      {children}
    </ClientContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Хук-потребитель
// ---------------------------------------------------------------------------

export function useClients(): ClientContextType {
  const context = useContext(ClientContext);

  if (!context) {
    throw new Error(
      '[useClients] Хук должен использоваться внутри <ClientProvider>. ' +
        'Оберни компонент в ClientProvider или добавь его в layout.tsx.'
    );
  }

  return context;
}