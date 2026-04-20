'use server';

import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

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

  const normalized =
    typeof value === 'string' ? value.replace(',', '.').trim() : value;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toJsonItems(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  return value;
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

// 1. ПОЛУЧЕНИЕ КЛИЕНТА ПО ID
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

// 2. ОБНОВЛЕНИЕ КЛИЕНТА
export async function updateClientDeal(id: string, data: any) {
  console.log('--- СЕРВЕР: ОБНОВЛЕНИЕ ДАННЫХ ---', id);

  try {
    const cleanData = buildCleanClientData(data);

    const updatedClient = await prisma.client.update({
      where: { id },
      data: cleanData,
    });

    revalidatePath('/dashboard/clients');
    revalidatePath('/dashboard/new-calculation');

    return { success: true, id: updatedClient.id };
  } catch (error: any) {
    console.error('Ошибка updateClientDeal:', error);
    return { success: false, error: 'Ошибка при обновлении записи' };
  }
}

// 3. СОЗДАНИЕ КЛИЕНТА
export async function createClientDeal(data: any) {
  console.log('--- СЕРВЕР: ПОЛУЧЕНЫ ДАННЫЕ (NEW) ---', data);

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