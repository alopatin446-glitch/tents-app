'use server';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { normalizeStatus } from '@/lib/logic/statusDictionary';
import { toFinancialNumber, calculateClientBalance } from '@/lib/logic/financialCalculations';
import { parseWindowItems } from '@/types';
import { logger } from '@/lib/logger';
import { MountingConfig } from '@/types/mounting';
import { requireAuth } from '@/lib/auth/requireAuth'; // ПРОВЕРКА АВТОРИЗАЦИИ

import { cookies } from 'next/headers';
import { verifyPassword } from '@/lib/auth/crypto';
import {
  generateSessionToken,
  getSessionExpiry,
  hashSessionToken,
} from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/constants';

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
  mountingConfig?: MountingConfig;
  preliminaryPrice?: unknown;
  costPrice?: unknown;
  overspending?: unknown;
  productionCost?: unknown;
  mountingCost?: unknown;
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
  if (data.mountingConfig !== undefined) out.mountingConfig = data.mountingConfig;
  if (data.preliminaryPrice !== undefined) out.preliminaryPrice = toFinancialNumber(data.preliminaryPrice as string | number | null | undefined, 0);
  if (data.costPrice !== undefined) out.costPrice = toFinancialNumber(data.costPrice as string | number | null | undefined, 0);
  if (data.overspending !== undefined) out.overspending = toFinancialNumber(data.overspending as string | number | null | undefined, 0);
  if (data.productionCost !== undefined) out.productionCost = toFinancialNumber(data.productionCost as string | number | null | undefined, 0);
  if (data.mountingCost !== undefined) out.mountingCost = toFinancialNumber(data.mountingCost as string | number | null | undefined, 0);

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
    const user = await requireAuth(); // Получаем данные пользователя из сессии
    let finalId: string;

    if (!id || id.trim() === '') {
      // СОЗДАНИЕ НОВОГО КЛИЕНТА
      const newClient = await prisma.client.create({
        data: {
          organizationId: user.organizationId, // Привязываем к реальной организации
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
          mountingConfig: data.mountingConfig ? (data.mountingConfig as any) : Prisma.JsonNull,
          measurementDate: data.measurementDate ? new Date(data.measurementDate as any) : null,
          installDate: data.installDate ? new Date(data.installDate as any) : null,
          createdById: user.id,
          createdByName: user.name,
          createdByRole: user.role,

          updatedById: user.id,
          updatedByName: user.name,
          updatedByRole: user.role,
          contentUpdatedAt: new Date(),
        },
      });
      finalId = newClient.id;
      logger.info('[updateClientAction] Создан новый клиент', { id: finalId, orgId: user.organizationId });
    } else {
      // ОБНОВЛЕНИЕ СУЩЕСТВУЮЩЕГО КЛИЕНТА
      // Добавляем проверку, что клиент принадлежит организации пользователя
      const prismaData = {
        ...buildUpdateClientData(data),
        updatedById: user.id,
        updatedByName: user.name,
        updatedByRole: user.role,
        contentUpdatedAt: new Date(),
      };
      const updatedClient = await prisma.client.update({
        where: {
          id,
          organizationId: user.organizationId // Безопасность: обновляем только своего
        },
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
    const user = await requireAuth();

    const fio = toRequiredString(data.fio, 'Без имени');
    const phone = toRequiredString(data.phone, '');
    const address = toNullableString(data.address);
    const source = toNullableString(data.source);
    const status = normalizeStatus(data.status ?? 'negotiation');
    const totalPrice = toFinancialNumber(data.totalPrice as string | number | null | undefined, 0);
    const advance = toFinancialNumber(data.advance as string | number | null | undefined, 0);
    const balance = calculateClientBalance(totalPrice, advance);

    const created = await prisma.client.create({
      data: {
        organizationId: user.organizationId,
        fio,
        phone,
        address,
        source,
        status,
        totalPrice,
        advance,
        balance,

        createdById: user.id,
        createdByName: user.name,
        createdByRole: user.role,

        updatedById: user.id,
        updatedByName: user.name,
        updatedByRole: user.role,
        contentUpdatedAt: new Date(),
      },
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
    const user = await requireAuth();
    const count = await prisma.client.count({
      where: {
        status: { in: ['completed', 'rejected'] },
        organizationId: user.organizationId // Считаем только своих
      },
    });
    return { success: true, count };
  } catch (error) {
    logger.error('[getArchiveOrdersCount] Ошибка', error);
    return { success: false, error: 'Не удалось получить количество' };
  }
}

export async function deleteClientAction(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    if (!id) return { success: false, error: 'ID не предоставлен' };
    const user = await requireAuth();

    // Удаляем только если клиент принадлежит нашей организации
    await prisma.client.delete({
      where: {
        id,
        organizationId: user.organizationId
      }
    });

    logger.info('[deleteClientAction] Клиент удален', { id, orgId: user.organizationId });
    revalidateClientPaths();
    return { success: true };
  } catch (error) {
    logger.error('[deleteClientAction] Ошибка при удалении', error);
    return { success: false, error: 'Не удалось удалить клиента' };
  }
}

export async function loginAction(
  email: string,
  password: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user || user.status !== 'ACTIVE') {
      return { success: false, error: 'Неверный email или аккаунт заблокирован' };
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) return { success: false, error: 'Неверный пароль' };

    const token = generateSessionToken();
    const expiresAt = getSessionExpiry();

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashSessionToken(token),
        expiresAt,
      },
    });

    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires: expiresAt,
      path: '/',
    });

    return { success: true };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Ошибка сервера' };
  }
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}