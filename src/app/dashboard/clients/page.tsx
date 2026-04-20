import { prisma } from '@/lib/prisma';
import { ClientProvider } from './ClientContext';
import KanbanBoard from './KanbanBoard';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: {
      createdAt: 'desc',
    },
  });

  return (
    <ClientProvider initialClients={clients as any}>
      <KanbanBoard />
    </ClientProvider>
  );
}