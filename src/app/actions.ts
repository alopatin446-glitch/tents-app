'use server';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { normalizeStatus } from '@/lib/logic/statusDictionary';
import { toFinancialNumber, calculateClientBalance } from '@/lib/logic/financialCalculations';
import { parseWindowItems } from '@/types';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Локальные утилиты нормализации (серверная граница)
// ---------------------------------------------------------------------------

function toNullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

function toRequiredString(value: unknown, fallback = ''): string {
  if (value === undefined || value === null) return fallback;
  const s = String(value).trim();
  return s === '' ? fallback : s;
}

function toNullableDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toJsonItems(value: unknown): Prisma.InputJsonValue {
  if (value === undefined || value === null || value === '') {
    return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
  }
  const validated = parseWindowItems(value);
  if (validated.length === 0 && Array.isArray(value) && value.length > 0) {
    logger.warn('[actions.toJsonItems] Ни один элемент не прошёл валидацию', value);
    return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
  }
  return validated as unknown as Prisma.InputJsonValue;
}

// ---------------------------------------------------------------------------
// Тип полезной нагрузки
// ---------------------------------------------------------------------------

type UpdateClientPayload = {
  fio?: unknown;
  phone?: unknown;
  address?: unknown;
  source?: unknown;
  status?: unknown;
  totalPrice?: unknown;
  advance?: unknown;
  balance?: unknown;
  paymentType?: unknown;
  measurementDate?: unknown;
  installDate?: unknown;
  items?: unknown;
  managerComment?: unknown;
  engineerComment?: unknown;
};

function buildUpdateClientData(data: UpdateClientPayload): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if (data.fio !== undefined) out.fio = toRequiredString(data.fio, 'Без имени');
  if (data.phone !== undefined) out.phone = toRequiredString(data.phone, '');
  if (data.address !== undefined) out.address = toNullableString(data.address);
  if (data.source !== undefined) out.source = toNullableString(data.source);
  if (data.paymentType !== undefined) out.paymentType = toNullableString(data.paymentType);
  if (data.managerComment !== undefined) out.managerComment = toNullableString(data.managerComment);
  if (data.engineerComment !== undefined) out.engineerComment = toNullableString(data.engineerComment);
  if (data.status !== undefined) out.status = normalizeStatus(data.status);

  const hasTotalPrice = data.totalPrice !== undefined;
  const hasAdvance = data.advance !== undefined;
  const hasExplicitBalance =
    data.balance !== undefined &&
    data.balance !== null &&
    String(data.balance).trim() !== '';

  const nextTotalPrice = hasTotalPrice
    ? toFinancialNumber(data.totalPrice as string | number | null | undefined, 0)
    : undefined;
  const nextAdvance = hasAdvance
    ? toFinancialNumber(data.advance as string | number | null | undefined, 0)
    : undefined;

  if (hasTotalPrice) out.totalPrice = nextTotalPrice;
  if (hasAdvance) out.advance = nextAdvance;

  if (hasExplicitBalance) {
    out.balance = toFinancialNumber(data.balance as string | number | null | undefined, 0);
  } else if (hasTotalPrice || hasAdvance) {
    out.balance = calculateClientBalance(nextTotalPrice ?? 0, nextAdvance ?? 0);
  }

  if (data.measurementDate !== undefined) out.measurementDate = toNullableDate(data.measurementDate);
  if (data.installDate !== undefined) out.installDate = toNullableDate(data.installDate);
  if (data.items !== undefined) out.items = toJsonItems(data.items);

  return out;
}

const REVALIDATION_PATHS = [
  '/dashboard',
  '/dashboard/clients',
  '/dashboard/archive',
  '/dashboard/new-calculation',
] as const;

function revalidateClientPaths(): void {
  for (const path of REVALIDATION_PATHS) revalidatePath(path);
}

// ---------------------------------------------------------------------------
// Публичные экшены
// ---------------------------------------------------------------------------


export async function updateClientAction(
  id: string,
  data: UpdateClientPayload
): Promise<{ success: true; clientId?: string } | { success: false; error: string }> {
  try {
    let finalId: string;

    if (!id || id.trim() === '') {
      // СОЗДАНИЕ: Принудительно приводим типы (as string / as number), чтобы заткнуть TS
      const newClient = await prisma.client.create({
        data: {
          fio: (data.fio as string) || 'Новый клиент',
          phone: (data.phone as string) || '',
          address: (data.address as string) || '',
          source: (data.source as string) || '',
          status: (data.status as string) || 'new',
          totalPrice: Number(data.totalPrice) || 0,
          advance: Number(data.advance) || 0,
          balance: Number(data.balance) || 0,
          paymentType: (data.paymentType as string) || '',
          managerComment: (data.managerComment as string) || '',
          engineerComment: (data.engineerComment as string) || '',
          items: data.items ? (data.items as any) : [],
          measurementDate: data.measurementDate ? new Date(data.measurementDate as any) : null,
          installDate: data.installDate ? new Date(data.installDate as any) : null,
        },
      });
      finalId = newClient.id;
      logger.info('[updateClientAction] Создан новый клиент', { id: finalId });
    } else {
      // ОБНОВЛЕНИЕ
      const prismaData = buildUpdateClientData(data);
      const updatedClient = await prisma.client.update({
        where: { id },
        data: prismaData,
      });
      finalId = updatedClient.id;
      logger.info('[updateClientAction] Клиент обновлен', { id: finalId });
    }

    revalidateClientPaths();
    return { success: true, clientId: finalId };
  } catch (error) {
    logger.error('[updateClientAction] Ошибка', error);
    return { success: false, error: 'Не удалось сохранить данные' };
  }
}

export async function createClientAction(data: {
  fio: unknown;
  phone: unknown;
  address?: unknown;
  source?: unknown;
  totalPrice?: unknown;
  advance?: unknown;
  status?: unknown;
}): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const fio = toRequiredString(data.fio, 'Без имени');
    const phone = toRequiredString(data.phone, '');
    const address = toNullableString(data.address);
    const source = toNullableString(data.source);
    const status = normalizeStatus(data.status ?? 'negotiation');
    const totalPrice = toFinancialNumber(data.totalPrice as string | number | null | undefined, 0);
    const advance = toFinancialNumber(data.advance as string | number | null | undefined, 0);
    const balance = calculateClientBalance(totalPrice, advance);

    const created = await prisma.client.create({
      data: { fio, phone, address, source, status, totalPrice, advance, balance },
    });

    revalidateClientPaths();
    return { success: true, id: created.id };
  } catch (error) {
    logger.error('[createClientAction] Ошибка', error);
    return { success: false, error: 'Не удалось создать клиента' };
  }
}

export async function getArchiveOrdersCount(): Promise<
  { success: true; count: number } | { success: false; error: string }
> {
  try {
    const count = await prisma.client.count({
      where: { status: { in: ['completed', 'rejected'] } },
    });
    return { success: true, count };
  } catch (error) {
    logger.error('[getArchiveOrdersCount] Ошибка', error);
    return { success: false, error: 'Не удалось получить количество' };
  }
}

/**
 * Удаляет клиента из базы данных
 */
export async function deleteClientAction(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    if (!id) {
      return { success: false, error: 'ID не предоставлен' };
    }

    await prisma.client.delete({
      where: { id },
    });

    logger.info('[deleteClientAction] Клиент удален', { id });
    
    // Инвалидируем пути, чтобы список клиентов обновился везде
    revalidateClientPaths();
    
    return { success: true };
  } catch (error) {
    logger.error('[deleteClientAction] Ошибка при удалении', error);
    return { success: false, error: 'Не удалось удалить клиента' };
  }
}