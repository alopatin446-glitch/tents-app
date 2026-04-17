'use client';

import { ClientProvider } from './ClientContext';
import KanbanBoard from './KanbanBoard';

export default function ClientsPage() {
  return (
    <ClientProvider>
      <KanbanBoard />
    </ClientProvider>
  );
}