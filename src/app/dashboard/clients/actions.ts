'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

function normalizeStatus(status: unknown) {
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

export async function updateClientAction(id: string, data: any) {
  try {
    const normalizedData = {
      ...data,
      ...(data?.status !== undefined
        ? { status: normalizeStatus(data.status) }
        : {}),
    };

    await prisma.client.update({
      where: { id },
      data: normalizedData,
    });

    revalidatePath('/dashboard/clients');
    revalidatePath('/dashboard/archive');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error) {
    console.error('Ошибка при обновлении клиента:', error);
    return { success: false, error: 'Не удалось сохранить данные' };
  }
}

export async function deleteClientAction(id: string) {
  try {
    await prisma.client.delete({ where: { id } });

    revalidatePath('/dashboard/clients');
    revalidatePath('/dashboard/archive');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (error) {
    console.error('Ошибка при удалении:', error);
    return { success: false };
  }
}