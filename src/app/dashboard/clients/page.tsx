import { prisma } from '@/lib/prisma';
import { ClientProvider } from './ClientContext';
import KanbanBoard from './KanbanBoard';
import { parseWindowItems } from '@/types';
import { normalizeStatus } from '@/lib/logic/statusDictionary';
import type { Client } from '@/types';
import { requireAuth } from '@/lib/auth/requireAuth';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { getPipelineStages } from '@/app/actions/pipeline';

export default async function ClientsPage() {
  // 1. ТАМОЖНЯ: Проверка авторизации
  const user = await requireAuth();

  // 2. ГРОССБУХ: Параллельный запрос данных организации (включая динамические колонки)
  const [stagesResult, rawClients, pricingData] = await Promise.all([
    getPipelineStages(),
    // 🔥 РЕШЕНИЕ BUG-075: Не грузим архивные заказы на Канбан-доску
    prisma.client.findMany({
      where: {
        organizationId: user.organizationId,
        status: {
          notIn: ['completed', 'rejected'],
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.price.findMany({
      where: { organizationId: user.organizationId },
    }),
  ]);

  const stages = stagesResult.success && stagesResult.data ? stagesResult.data : [];

  // 3. ПОГРАНИЧНИК-ЛОГИКА: Формирование справочника цен (Value Sovereignty)
  const priceMap: Record<string, number> = pricingData.reduce((acc, item) => {
    acc[item.slug] = item.value;
    return acc;
  }, {} as Record<string, number>);

  // 4. ЕДИНЫЙ МОЗГ: Маппинг данных с защитой от null
  const clients: Client[] = rawClients.map((c) => ({
    id: c.id,
    fio: c.fio || 'Без имени',
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
      <ErrorBoundary label="канбана">
        {/* Передаем и прайсы, и динамические колонки в Канбан */}
        <KanbanBoard priceMap={priceMap} initialStages={stages} />
      </ErrorBoundary>
    </ClientProvider>
  );
}