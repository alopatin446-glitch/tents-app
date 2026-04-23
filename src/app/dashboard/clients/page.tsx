import { prisma } from '@/lib/prisma';
import { ClientProvider } from './ClientContext';
import KanbanBoard from './KanbanBoard';
import { parseWindowItems } from '@/types';
import { normalizeStatus } from '@/lib/logic/statusDictionary';
import type { Client } from '@/types';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const raw = await prisma.client.findMany({
    orderBy: { createdAt: 'desc' },
  });

  // Сериализуем Prisma-объекты в чистые Client-объекты:
  // - Date → ISO-строка (клиентские компоненты не принимают Date-объекты)
  // - status: string → ClientStatus через normalizeStatus
  // - items: Json → WindowItem[] через parseWindowItems
  const clients: Client[] = raw.map((c) => ({
    id: c.id,
    fio: c.fio,
    phone: c.phone,
    address: c.address,
    source: c.source,
    totalPrice: c.totalPrice,
    advance: c.advance,
    balance: c.balance,
    paymentType: c.paymentType,
    status: normalizeStatus(c.status),
    createdAt: c.createdAt.toISOString(),
    measurementDate: c.measurementDate?.toISOString() ?? null,
    installDate: c.installDate?.toISOString() ?? null,
    items: parseWindowItems(c.items),
    managerComment: c.managerComment,
    engineerComment: c.engineerComment,
  }));

  return (
    <ClientProvider initialClients={clients}>
      <KanbanBoard />
    </ClientProvider>
  );
}