'use client';

import React, { createContext, useContext, useState } from 'react';
import { Client } from './types';

interface ClientContextType {
  clients: Client[];
  addClient: (client: Client) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

// Добавляем initialClients в пропсы
export function ClientProvider({ 
  children, 
  initialClients = [] 
}: { 
  children: React.ReactNode, 
  initialClients?: Client[] 
}) {
  // Инициализируем стейт данными, которые пришли из базы через page.tsx
  const [clients, setClients] = useState<Client[]>(initialClients);

  // УДАЛИЛИ блоки useEffect с localStorage, так как теперь данные живут в PostgreSQL

  const addClient = (client: Client) => {
    setClients(prev => [...prev, client]);
  };

  const updateClient = (id: string, updates: Partial<Client>) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const deleteClient = (id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
  };

  return (
    <ClientContext.Provider value={{ clients, addClient, updateClient, deleteClient }}>
      {children}
    </ClientContext.Provider>
  );
}

export const useClients = () => {
  const context = useContext(ClientContext);
  if (!context) throw new Error('useClients must be used within ClientProvider');
  return context;
};