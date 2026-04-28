import { prisma } from '@/lib/prisma';
import { ClientProvider } from './ClientContext';
import KanbanBoard from './KanbanBoard';
import { parseWindowItems } from '@/types';
import { normalizeStatus } from '@/lib/logic/statusDictionary';
import type { Client } from '@/types';
import { requireAuth } from '@/lib/auth/requireAuth'; // Используем requireAuth для гарантии организации
import { redirect } from 'next/navigation';

export default async function ClientsPage() {
  // 1. Получаем авторизованного пользователя с его organizationId
  const user = await requireAuth();

  // 2. Запрашиваем клиентов ТОЛЬКО этой организации
  const raw = await prisma.client.findMany({
    where: {
      organizationId: user.organizationId,
    },
    orderBy: { createdAt: 'desc' },
  });

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