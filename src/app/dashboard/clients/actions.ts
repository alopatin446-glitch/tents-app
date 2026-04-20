'use server'

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

// Универсальная функция обновления клиента
export async function updateClientAction(id: string, data: any) {
  try {
    await prisma.client.update({
      where: { id },
      data: {
        // Мы берем входящие данные и обновляем их. 
        // Prisma сама проигнорирует undefined, но сохранит null (пустые поля).
        ...data
      }
    });
    // Заставляем Next.js обновить страницу, чтобы данные на доске были свежими
    revalidatePath('/dashboard/clients');
    return { success: true };
  } catch (error) {
    console.error('Ошибка при обновлении клиента:', error);
    return { success: false, error: 'Не удалось сохранить данные' };
  }
}

// Удаление клиента
export async function deleteClientAction(id: string) {
  try {
    await prisma.client.delete({ where: { id } });
    revalidatePath('/dashboard/clients');
    return { success: true };
  } catch (error) {
    console.error('Ошибка при удалении:', error);
    return { success: false };
  }
}