import { prisma } from '@/lib/prisma';
import { ClientProvider } from './ClientContext';
import KanbanBoard from './KanbanBoard';
import { parseWindowItems } from '@/types';
import { normalizeStatus } from '@/lib/logic/statusDictionary';
import type { Client } from '@/types';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { redirect } from 'next/navigation';

export default async function ClientsPage() {
  // Просто получаем пользователя, чтобы сессия была валидна
  const user = await getCurrentUser();
  
  // Если вообще не залогинен — на вход
  if (!user) {
    return redirect('/login');
  }

  // БЛОКИРОВКУ ПО PERMISSIONS УБРАЛИ. Дмитрий снова может зайти.

  const raw = await prisma.client.findMany({
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