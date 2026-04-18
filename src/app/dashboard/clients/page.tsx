import { PrismaClient } from '@prisma/client';
import { ClientProvider } from './ClientContext';
import KanbanBoard from './KanbanBoard';

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient();

export default async function ClientsPage() {
  // 1. Прямо здесь (на сервере) забираем данные из PostgreSQL
  const clients = await prisma.client.findMany({
    orderBy: {
      createdAt: 'desc', // Свежие клиенты будут первыми
    },
  });

  return (
    // 2. Передаем данные из базы в твой провайдер (если он поддерживает initialData)
    // Либо просто выводим доску
    // Измени строку в page.tsx на эту:
<ClientProvider initialClients={clients as any}>
      <KanbanBoard />
    </ClientProvider>
  );
}