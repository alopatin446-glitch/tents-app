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

/**
 * Валидирует снапшот прайса перед записью в БД.
 *
 * Контракт возврата:
 *   Record<string, number> — объект валиден, можно писать в поле savedPrices.
 *   undefined               — данные невалидны; поле savedPrices НЕ включается в data.
 *
 * Принцип: мы не очищаем существующий снапшот принудительно.
 * Либо запишем проверенный объект — либо вообще не тронем поле.
 * Prisma.JsonNull здесь не используется: это исключает случайную
 * потерю снапшота при невалидном вводе (пустом объекте, сетевом сбое и т.п.).
 *
 * Невалидные случаи (все возвращают undefined):
 *   — undefined / null
 *   — не объект (число, строка, массив)
 *   — пустой объект {}
 *   — объект с нечисловыми или бесконечными значениями
 */
function normalizeSavedPrices(value: unknown): Record<string, number> | undefined {
  if (value === undefined || value === null) return undefined;

  if (typeof value !== 'object' || Array.isArray(value)) {
    logger.warn(
      '[actions.normalizeSavedPrices] Некорректный тип — ожидается объект',
      { type: typeof value },
    );
    return undefined;
  }

  const obj  = value as Record<string, unknown>;
  const keys = Object.keys(obj);

  if (keys.length === 0) return undefined;

  const hasInvalidValues = keys.some(
    (k) => typeof obj[k] !== 'number' || !Number.isFinite(obj[k] as number),
  );

  if (hasInvalidValues) {
    logger.warn(
      '[actions.normalizeSavedPrices] savedPrices содержит нечисловые значения — поле не будет обновлено',
    );
    return undefined;
  }

  return obj as Record<string, number>;
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
  mountingConfig?: MountingConfig | null;
  preliminaryPrice?: unknown;
  costPrice?: unknown;
  overspending?: unknown;
  productionCost?: unknown;
  mountingCost?: unknown;
  /**
   * Итоговые расходы из расчётного ядра: windowsExpenses + extrasCost + mountingCost.
   * Передаётся только для открытых заказов (не completed/rejected).
   */
  totalExpenses?: unknown;
  /**
   * Снапшот прайса: плоский объект { slug: number }.
   * Попадает в БД только если прошёл normalizeSavedPrices.
   * При невалидном значении поле не обновляется (существующий снапшот сохраняется).
   */
  savedPrices?: unknown;

  // ── Price Lock ────────────────────────────────────────────────────────────
  isPriceLocked?: unknown;
  priceLockedAt?: unknown;
  priceLockReason?: unknown;
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
  if (data.totalExpenses !== undefined) out.totalExpenses = toFinancialNumber(data.totalExpenses as string | number | null | undefined, 0);

  // savedPrices попадает в out только если normalizeSavedPrices вернул валидный объект.
  // При undefined — поле не включается в data, Prisma не трогает существующее значение в БД.
  const validSavedPrices = normalizeSavedPrices(data.savedPrices);
  if (validSavedPrices !== undefined) out.savedPrices = validSavedPrices;

  // ── Price Lock ────────────────────────────────────────────────────────────
  if (data.isPriceLocked !== undefined) {
    out.isPriceLocked = Boolean(data.isPriceLocked);
  }
  if (data.priceLockedAt !== undefined) {
    out.priceLockedAt = data.priceLockedAt
      ? new Date(data.priceLockedAt as string)
      : null;
  }
  if (data.priceLockReason !== undefined) {
    out.priceLockReason = data.priceLockReason
      ? String(data.priceLockReason)
      : null;
  }

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

    // Валидируем снапшот один раз до ветвления.
    // undefined → снапшот невалиден или не передан → поле не записывается ни в create, ни в update.
    const validSavedPrices = normalizeSavedPrices(data.savedPrices);

    if (!id || id.trim() === '') {
      // СОЗДАНИЕ НОВОГО КЛИЕНТА
      const newClient = await prisma.client.create({
        data: {
          organizationId: user.organizationId, // Привязываем к реальной организации
          fio: (data.fio as string) || 'Новый клиент',
          phone: (data.phone as string) || '',
          address: (data.address as string) || '',
          source: (data.source as string) || '',
          status: normalizeStatus(data.status ?? 'negotiation'),
          totalPrice: Number(data.totalPrice) || 0,
          advance: Number(data.advance) || 0,
          balance: Number(data.balance) || 0,
          paymentType: (data.paymentType as string) || '',
          managerComment: (data.managerComment as string) || '',
          engineerComment: (data.engineerComment as string) || '',
          items: toJsonItems(data.items),
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

          // savedPrices включается только если снапшот валиден.
          // Если не передан или невалиден — поле остаётся NULL (Prisma default для Json?).
          ...(validSavedPrices !== undefined ? { savedPrices: validSavedPrices } : {}),
        },
      });
      finalId = newClient.id;
      logger.info('[updateClientAction] Создан новый клиент', { id: finalId, orgId: user.organizationId });
    } else {
      // ОБНОВЛЕНИЕ СУЩЕСТВУЮЩЕГО КЛИЕНТА

      // ── Server-side freeze protection ────────────────────────────────
      // Читаем текущее состояние из БД для определения frozen-статуса.
      // Client-side защита (CalculationClient) необходима, но недостаточна:
      // прямой вызов action может попытаться перезаписать frozen fields.
      const existingClient = await prisma.client.findFirst({
        where: { id, organizationId: user.organizationId },
        select: { status: true, isPriceLocked: true, priceLockedAt: true },
      });

      if (!existingClient) {
        return { success: false, error: 'Клиент не найден или доступ запрещён' };
      }

      const FROZEN_STATUSES = ['completed', 'rejected'] as const;
      const wasHistorical = FROZEN_STATUSES.includes(existingClient.status as 'completed' | 'rejected');
      const wasPriceLocked = existingClient.isPriceLocked;

      // isClosingNow: статус меняется на completed/rejected впервые.
      // При этом необходимо записать финальный financial snapshot — не защищаем.
      const incomingStatus = typeof data.status === 'string' ? data.status : existingClient.status;
      const isClosingNow = !wasHistorical && FROZEN_STATUSES.includes(incomingStatus as 'completed' | 'rejected');

      // isAlreadyFrozen: заказ уже был historical при этом запросе.
      //   — wasHistorical: статус в DB уже completed/rejected
      //   — wasPriceLocked && priceLockedAt: price lock уже был зафиксирован
      // isClosingNow НЕ входит в isAlreadyFrozen: при нём snapshot записывается в первый раз.
      const isAlreadyFrozen = wasHistorical || (wasPriceLocked && Boolean(existingClient.priceLockedAt));

      // buildUpdateClientData вызывает normalizeSavedPrices внутри себя — идемпотентно.
      const prismaData: Record<string, unknown> = {
        ...buildUpdateClientData(data),
        updatedById: user.id,
        updatedByName: user.name,
        updatedByRole: user.role,
        contentUpdatedAt: new Date(),
      };

      // Для уже-frozen заказов: удаляем финансовые snapshot-поля из апдейта.
      // isClosingNow=true → isAlreadyFrozen=false → поля НЕ удаляются (финальный snapshot).
      // wasHistorical=true → snapshot уже зафиксирован → защищаем.
      if (isAlreadyFrozen) {
        // ── Себестоимость и производство ─────────────────────────────────
        delete prismaData['costPrice'];
        delete prismaData['productionCost'];
        delete prismaData['overspending'];
        delete prismaData['totalExpenses'];
        delete prismaData['savedPrices'];
        // ── Экономика сделки ──────────────────────────────────────────────
        // totalPrice: розничная цена зафиксирована при закрытии/блокировке.
        // mountingCost: стоимость монтажа — часть исторического snapshot.
        delete prismaData['totalPrice'];
        delete prismaData['mountingCost'];
        // ── Оплата (намеренно оставлена редактируемой) ────────────────────
        // advance и balance НЕ защищаются: оплата может поступать после
        // закрытия заказа (рассрочка, постоплата, корректировка аванса).
        // Изменение advance/balance не влияет на финансовый snapshot расчётов.
        logger.info('[updateClientAction] Frozen order: financial snapshot fields protected', {
          id,
          wasHistorical,
          wasPriceLocked,
          isClosingNow,
        });
      }

      const updatedClient = await prisma.client.update({
        where: {
          id,
          organizationId: user.organizationId,
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
  status?: unknown;
  totalPrice?: unknown;
  advance?: unknown;
  paymentType?: unknown;
  measurementDate?: unknown;
  installDate?: unknown;
  costPrice?: unknown;
  overspending?: unknown;
  productionCost?: unknown;
  mountingCost?: unknown;
  managerComment?: unknown;
  engineerComment?: unknown;
}): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    const user = await requireAuth();

    const fio          = toRequiredString(data.fio, 'Без имени');
    const phone        = toRequiredString(data.phone, '');
    const address      = toNullableString(data.address);
    const source       = toNullableString(data.source);
    const status       = normalizeStatus(data.status ?? 'negotiation');
    const paymentType  = toNullableString(data.paymentType);
    const managerComment  = toNullableString(data.managerComment);
    const engineerComment = toNullableString(data.engineerComment);

    const totalPrice     = toFinancialNumber(data.totalPrice     as string | number | null | undefined, 0);
    const advance        = toFinancialNumber(data.advance        as string | number | null | undefined, 0);
    const costPrice      = toFinancialNumber(data.costPrice      as string | number | null | undefined, 0);
    const overspending   = toFinancialNumber(data.overspending   as string | number | null | undefined, 0);
    const productionCost = toFinancialNumber(data.productionCost as string | number | null | undefined, 0);
    const mountingCost   = toFinancialNumber(data.mountingCost   as string | number | null | undefined, 0);
    const balance        = calculateClientBalance(totalPrice, advance);

    const measurementDate = toNullableDate(data.measurementDate);
    const installDate     = toNullableDate(data.installDate);

    const created = await prisma.client.create({
      data: {
        organizationId: user.organizationId,
        fio,
        phone,
        address,
        source,
        status,
        paymentType,
        managerComment,
        engineerComment,
        totalPrice,
        advance,
        balance,
        costPrice,
        overspending,
        productionCost,
        mountingCost,
        measurementDate,
        installDate,

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