'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';
import { Client } from './types';

interface ClientContextType {
  clients: Client[];
  addClient: (client: Client) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

function normalizeClientId(id: unknown): string {
  return String(id);
}

function normalizeClients(clients: Client[]): Client[] {
  if (!Array.isArray(clients)) {
    return [];
  }

  return clients.map((client) => ({
    ...client,
    id: normalizeClientId(client.id),
  }));
}

interface ClientProviderProps {
  children: React.ReactNode;
  initialClients?: Client[];
}

export function ClientProvider({
  children,
  initialClients = [],
}: ClientProviderProps) {
  const [clients, setClients] = useState<Client[]>(() =>
    normalizeClients(initialClients)
  );

  const addClient = (client: Client) => {
    const normalizedClient: Client = {
      ...client,
      id: normalizeClientId(client.id),
    };

    setClients((prev) => {
      const normalizedId = normalizeClientId(normalizedClient.id);
      const existingIndex = prev.findIndex(
        (item) => normalizeClientId(item.id) === normalizedId
      );

      if (existingIndex === -1) {
        return [...prev, normalizedClient];
      }

      return prev.map((item) =>
        normalizeClientId(item.id) === normalizedId
          ? { ...item, ...normalizedClient }
          : item
      );
    });
  };

  const updateClient = (id: string, updates: Partial<Client>) => {
    const normalizedId = normalizeClientId(id);

    setClients((prev) =>
      prev.map((client) =>
        normalizeClientId(client.id) === normalizedId
          ? {
              ...client,
              ...updates,
              id: normalizeClientId(client.id),
            }
          : client
      )
    );
  };

  const deleteClient = (id: string) => {
    const normalizedId = normalizeClientId(id);

    setClients((prev) =>
      prev.filter(
        (client) => normalizeClientId(client.id) !== normalizedId
      )
    );
  };

  const value = useMemo(
    () => ({
      clients,
      addClient,
      updateClient,
      deleteClient,
    }),
    [clients]
  );

  return (
    <ClientContext.Provider value={value}>
      {children}
    </ClientContext.Provider>
  );
}

export const useClients = () => {
  const context = useContext(ClientContext);

  if (!context) {
    throw new Error('useClients must be used within ClientProvider');
  }

  return context;
};