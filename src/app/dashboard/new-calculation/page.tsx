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

import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { parseWindowItems } from '@/types';
import { logger } from '@/lib/logger';
import CalculationClient from '@/components/calculation/CalculationClient';
import type { ClientFormData } from '@/components/calculation/ClientStep';
import type { MountingConfig } from '@/types/mounting';

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
  const resolved = searchParams ? await searchParams : {};
  const clientId = resolved?.id?.trim();
  const isReadOnly = resolved?.mode === 'archive';

  // --- ИСПРАВЛЕНИЕ: Если ID нет, не выкидываем пользователя, а создаем пустую форму ---
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
        isReadOnly={false}
      />
    );
  }
  // --- КОНЕЦ ИСПРАВЛЕНИЯ ---

  // Дальше идет логика загрузки существующего клиента (она остается без изменений)
  let client;
  try {
    client = await prisma.client.findUnique({
      where: { id: clientId },
    });
  } catch (err) {
    logger.error('[NewCalculationPage] Ошибка запроса к БД', { clientId, error: err });
    notFound();
  }

  if (!client) {
    logger.warn('[NewCalculationPage] Клиент не найден', { clientId });
    notFound();
  }

  const initialWindows = parseWindowItems(client.items);

  const initialClientData: ClientFormData = {
    fio: client.fio,
    phone: client.phone,
    address: client.address,
    source: client.source,
    status: client.status,
    totalPrice: client.totalPrice,
    advance: client.advance,
    balance: client.balance,
    paymentType: client.paymentType,
    measurementDate: formatDateForInput(client.measurementDate),
    installDate: formatDateForInput(client.installDate),
    managerComment: client.managerComment,
    engineerComment: client.engineerComment,
    mountingConfig: (client.mountingConfig ?? null) as MountingConfig | null,
  };

  return (
    <CalculationClient
      clientId={clientId}
      initialClientData={initialClientData}
      initialWindows={initialWindows}
      isReadOnly={isReadOnly}
    />
  );
}