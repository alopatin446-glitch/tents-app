/**
 * Страница расчёта / карточки клиента.
 *
 * Серверный компонент (Next.js App Router):
 *   1. Получает `id` и `mode` из searchParams.
 *   2. Загружает клиента из БД через Prisma.
 *   3. Парсит изделия из JSON-поля `items` через `parseWindowItems`.
 *   4. Передаёт данные в клиентский оркестратор `CalculationClient`.
 *
 * Режимы:
 *   - `mode=archive` → isReadOnly=true (просмотр архивной карточки)
 *   - без mode       → полное редактирование
 *
 * @module src/app/dashboard/new-calculation/page.tsx
 */

import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { parseWindowItems } from '@/types';
import { logger } from '@/lib/logger';
import CalculationClient from '@/components/calculation/CalculationClient';
import type { ClientFormData } from '@/components/calculation/ClientStep';
import type { MountingConfig } from '@/types/mounting';
import { requireAuth } from '@/lib/auth/requireAuth';

// Страница всегда серверная и динамическая —
// данные клиента могут меняться между запросами.
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Типы
// ---------------------------------------------------------------------------

type PageProps = {
  searchParams?: Promise<{
    id?: string;
    mode?: string;
  }>;
};

// ---------------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------------

/**
 * Форматирует Date для поля <input type="date"> (YYYY-MM-DD).
 * Null и невалидные даты → пустая строка.
 */
function formatDateForInput(value: Date | null | undefined): string {
  if (!value) return '';

  try {
    return value.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Страница
// ---------------------------------------------------------------------------

export default async function NewCalculationPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const resolved = searchParams ? await searchParams : {};
  const clientId = resolved?.id?.trim();
  const isReadOnly = resolved?.mode === 'archive';

  if (!clientId) {
    const emptyClientData: ClientFormData = {
      fio: '',
      phone: '',
      address: '',
      source: '',
      status: 'new',
      totalPrice: 0,
      advance: 0,
      balance: 0,
      paymentType: 'cash',
      measurementDate: '',
      installDate: '',
      managerComment: '',
      engineerComment: '',
      mountingConfig: null,
    };

    return (
      <CalculationClient
        clientId=""
        initialClientData={emptyClientData}
        initialWindows={[]}
        currentUserId={user.id}
        isReadOnly={false}
      />
    );
  }

  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      organizationId: user.organizationId,
    },
  });

  if (!client) {
    logger.warn('[NewCalculationPage] Клиент не найден или принадлежит другой организации', {
      clientId,
      userId: user.id,
      userOrganizationId: user.organizationId,
    });

    notFound();
  }

  const openedAt = new Date();

  try {
    await prisma.client.update({
      where: { id: client.id },
      data: {
        lastOpenedById: user.id,
        lastOpenedByName: user.name,
        lastOpenedByRole: user.role,
        lastOpenedAt: openedAt,
      },
    });
  } catch (err) {
    logger.error('[NewCalculationPage] Не удалось записать последнее открытие клиента', {
      clientId: client.id,
      userId: user.id,
      error: err,
    });
  }

  const initialWindows = parseWindowItems(client.items);

  const initialClientData: ClientFormData = {
    id: client.id,
    fio: client.fio,
    phone: client.phone,
    address: client.address,
    source: client.source,
    status: client.status,
    totalPrice: client.totalPrice,
    advance: client.advance,
    balance: client.balance,
    paymentType: client.paymentType,

    preliminaryPrice: client.preliminaryPrice,
    costPrice: client.costPrice,
    overspending: client.overspending,
    productionCost: client.productionCost,
    mountingCost: client.mountingCost,

    measurementDate: formatDateForInput(client.measurementDate),
    installDate: formatDateForInput(client.installDate),
    managerComment: client.managerComment,
    engineerComment: client.engineerComment,
    mountingConfig: (client.mountingConfig ?? null) as MountingConfig | null,

    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),

    createdById: client.createdById,
    createdByName: client.createdByName,
    createdByRole: client.createdByRole,

    updatedById: client.updatedById,
    updatedByName: client.updatedByName,
    updatedByRole: client.updatedByRole,
    contentUpdatedAt: client.contentUpdatedAt
      ? client.contentUpdatedAt.toISOString()
      : null,

    lastOpenedById: user.id,
    lastOpenedByName: user.name,
    lastOpenedByRole: user.role,
    lastOpenedAt: openedAt.toISOString(),
  };

  return (
    <CalculationClient
      clientId={clientId}
      initialClientData={initialClientData}
      initialWindows={initialWindows}
      currentUserId={user.id}
      isReadOnly={isReadOnly}
    />
  );
}