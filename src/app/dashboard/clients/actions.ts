'use server';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

function normalizeStatus(status: unknown): string {
  const raw = String(status || '').trim();

  const statusMap: Record<string, string> = {
    negotiation: 'negotiation',
    waiting_measure: 'waiting_measure',
    promised_pay: 'promised_pay',
    waiting_production: 'waiting_production',
    waiting_install: 'waiting_install',
    special_case: 'special_case',
    completed: 'completed',
    rejected: 'rejected',

    'Общение с клиентом': 'negotiation',
    'Ожидает замер': 'waiting_measure',
    'Обещал заплатить': 'promised_pay',
    'Ожидает изделия': 'waiting_production',
    'Ожидает монтаж': 'waiting_install',
    'Особые случаи': 'special_case',
    'Сделка успешна': 'completed',
    'Успешно': 'completed',
    'Отказ': 'rejected',
    'Провалено': 'rejected',
  };

  return statusMap[raw] || 'special_case';
}

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

function toJsonItems(value: unknown): Prisma.InputJsonValue {
  if (value === undefined || value === null || value === '') {
    return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
  }

  return value as Prisma.InputJsonValue;
}

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

function buildUpdateClientData(data: UpdateClientPayload) {
  const normalizedData: Record<string, unknown> = {};

  if (data.fio !== undefined) {
    normalizedData.fio = toRequiredString(data.fio, 'Без имени');
  }

  if (data.phone !== undefined) {
    normalizedData.phone = toRequiredString(data.phone, '');
  }

  if (data.address !== undefined) {
    normalizedData.address = toNullableString(data.address);
  }

  if (data.source !== undefined) {
    normalizedData.source = toNullableString(data.source);
  }

  if (data.status !== undefined) {
    normalizedData.status = normalizeStatus(data.status);
  }

  const hasTotalPrice = data.totalPrice !== undefined;
  const hasAdvance = data.advance !== undefined;
  const hasBalance =
    data.balance !== undefined &&
    data.balance !== null &&
    String(data.balance).trim() !== '';

  const nextTotalPrice = hasTotalPrice ? toNumberValue(data.totalPrice, 0) : undefined;
  const nextAdvance = hasAdvance ? toNumberValue(data.advance, 0) : undefined;

  if (hasTotalPrice) {
    normalizedData.totalPrice = nextTotalPrice;
  }

  if (hasAdvance) {
    normalizedData.advance = nextAdvance;
  }

  if (hasBalance) {
    normalizedData.balance = toNumberValue(data.balance, 0);
  } else if (hasTotalPrice || hasAdvance) {
    normalizedData.balance = (nextTotalPrice ?? 0) - (nextAdvance ?? 0);
  }

  if (data.paymentType !== undefined) {
    normalizedData.paymentType = toNullableString(data.paymentType);
  }

  if (data.measurementDate !== undefined) {
    normalizedData.measurementDate = toNullableDate(data.measurementDate);
  }

  if (data.installDate !== undefined) {
    normalizedData.installDate = toNullableDate(data.installDate);
  }

  if (data.items !== undefined) {
    normalizedData.items = toJsonItems(data.items);
  }

  if (data.managerComment !== undefined) {
    normalizedData.managerComment = toNullableString(data.managerComment);
  }

  if (data.engineerComment !== undefined) {
    normalizedData.engineerComment = toNullableString(data.engineerComment);
  }

  return normalizedData;
}

export async function updateClientAction(id: string, data: UpdateClientPayload) {
  try {
    const normalizedData = buildUpdateClientData(data);

    await prisma.client.update({
      where: { id },
      data: normalizedData,
    });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/clients');
    revalidatePath('/dashboard/archive');
    revalidatePath('/dashboard/new-calculation');

    return { success: true };
  } catch (error) {
    console.error('Ошибка при обновлении клиента:', error);
    return { success: false, error: 'Не удалось сохранить данные' };
  }
}

export async function deleteClientAction(id: string) {
  try {
    await prisma.client.delete({
      where: { id },
    });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/clients');
    revalidatePath('/dashboard/archive');
    revalidatePath('/dashboard/new-calculation');

    return { success: true };
  } catch (error) {
    console.error('Ошибка при удалении клиента:', error);
    return { success: false, error: 'Не удалось удалить клиента' };
  }
}