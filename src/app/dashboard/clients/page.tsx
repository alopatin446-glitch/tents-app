import { prisma } from '@/lib/prisma';
import { ClientProvider } from './ClientContext';
import KanbanBoard from './KanbanBoard';
import { parseWindowItems } from '@/types';
import { normalizeStatus } from '@/lib/logic/statusDictionary';
import type { Client } from '@/types';
import { requireAuth } from '@/lib/auth/requireAuth';

export default async function ClientsPage() {
  // 1. ТАМОЖНЯ: Проверка авторизации
  const user = await requireAuth();

  // 2. ГРОССБУХ: Параллельный запрос данных организации
  const [rawClients, pricingData] = await Promise.all([
    prisma.client.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.price.findMany({
      where: { organizationId: user.organizationId }
    })
  ]);

  // 3. ПОГРАНИЧНИК-ЛОГИКА: Формирование справочника цен (Value Sovereignity)
  // Явно типизируем аккумулятор как Record<string, number>
  const priceMap: Record<string, number> = pricingData.reduce((acc, item) => {
    acc[item.name] = item.value; // В схеме поле называется 'value'
    return acc;
  }, {} as Record<string, number>);

  // 4. ЕДИНЫЙ МОЗГ: Маппинг данных с защитой от null (Пункт 2 Манифеста)
  const clients: Client[] = rawClients.map((c) => ({
    id: c.id,
    fio: c.fio || 'Без имени', // Защита от TS 2322 (null -> string)
    phone: c.phone || '',
    address: c.address || '',
    source: c.source || '',
    totalPrice: c.totalPrice,
    advance: c.advance,
    balance: c.balance,
    paymentType: c.paymentType || '',
    status: normalizeStatus(c.status),
    createdAt: c.createdAt.toISOString(),
    measurementDate: c.measurementDate?.toISOString() ?? null,
    installDate: c.installDate?.toISOString() ?? null,
    items: parseWindowItems(c.items),
    managerComment: c.managerComment || '',
    engineerComment: c.engineerComment || '',
  }));

  return (
    <ClientProvider initialClients={clients}>
      {/* Передаем выровненный priceMap в Канбан */}
      <KanbanBoard priceMap={priceMap} />
    </ClientProvider>
  );
}