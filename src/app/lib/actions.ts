'use server';

import { PrismaClient, Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ОЧИСТКИ (ТВОЯ ЛОГИКА) ---

function toNullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized === '' ? null : normalized;
}

function toRequiredString(value: unknown, fallback = ''): string {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim();
  return normalized === '' ? fallback : normalized;
}

function toNumberValue(value: unknown, fallback = 0): number {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = typeof value === 'string' ? value.replace(',', '.').trim() : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toJsonItems(value: unknown): Prisma.InputJsonValue {
  if (value === undefined || value === null || value === '') {
    // Двойное приведение: сначала в unknown, потом в нужный тип
    return (Prisma.JsonNull as unknown) as Prisma.InputJsonValue;
  }
  return value as Prisma.InputJsonValue;
}

function buildCleanClientData(data: any) {
  const totalPrice = toNumberValue(data.totalPrice, 0);
  const advance = toNumberValue(data.advance, 0);

  const hasExplicitBalance =
    data.balance !== undefined &&
    data.balance !== null &&
    String(data.balance).trim() !== '';

  const balance = hasExplicitBalance
    ? toNumberValue(data.balance, 0)
    : totalPrice - advance;

  return {
    fio: toRequiredString(data.fio, 'Без имени'),
    phone: toRequiredString(data.phone, ''),
    address: toNullableString(data.address),
    source: toNullableString(data.source),
    status: toRequiredString(data.status, 'special_case'),
    totalPrice,
    advance,
    balance,
    paymentType: toNullableString(data.paymentType),
    measurementDate: toNullableDate(data.measurementDate),
    installDate: toNullableDate(data.installDate),
    items: toJsonItems(data.items),
    managerComment: toNullableString(data.managerComment),
    engineerComment: toNullableString(data.engineerComment),
  };
}

// --- ОСНОВНЫЕ ЭКШЕНЫ ---

// 1. Получение количества архивных заказов (Для главной страницы)
export async function getArchiveOrdersCount() {
  try {
    const count = await prisma.client.count({
      where: {
        status: {
          in: ['completed', 'rejected'],
        },
      },
    });
    return { success: true, count };
  } catch (error: any) {
    console.error('Ошибка getArchiveOrdersCount:', error);
    return { success: false, count: 0 };
  }
}

// 2. Поиск клиента по ID
export async function getClientById(id: string) {
  try {
    const client = await prisma.client.findUnique({
      where: { id },
    });
    if (!client) {
      return { success: false, error: 'Клиент не найден' };
    }
    return { success: true, data: client };
  } catch (error: any) {
    console.error('Ошибка getClientById:', error);
    return { success: false, error: 'Не удалось загрузить данные из базы' };
  }
}

// 3. Обновление клиента
export async function updateClientDeal(id: string, data: any) {
  try {
    const cleanData = buildCleanClientData(data);
    const updatedClient = await prisma.client.update({
      where: { id },
      data: cleanData,
    });
    revalidatePath('/dashboard/clients');
    revalidatePath('/dashboard/new-calculation');
    revalidatePath('/dashboard/archive'); // Добавили ревалидацию архива
    return { success: true, id: updatedClient.id };
  } catch (error: any) {
    console.error('Ошибка updateClientDeal:', error);
    return { success: false, error: 'Ошибка при обновлении записи' };
  }
}

// 4. Создание клиента
export async function createClientDeal(data: any) {
  try {
    const cleanData = buildCleanClientData(data);
    const newClient = await prisma.client.create({
      data: cleanData,
    });
    revalidatePath('/dashboard/clients');
    revalidatePath('/dashboard/new-calculation');
    return { success: true, id: newClient.id };
  } catch (error: any) {
    console.error('Ошибка createClientDeal:', error);
    return { success: false, error: error.message || 'Ошибка при создании записи' };
  }
}