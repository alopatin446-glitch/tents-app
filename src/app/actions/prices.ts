'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/requireAuth';

// Получение цен
export async function getPrices() {
  try {
    const user = await requireAuth();
    const orgId = user.organizationId;

    const prices = await prisma.price.findMany({
      where: {
        organizationId: orgId,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return { success: true, data: prices };
  } catch (error) {
    console.error('Ошибка загрузки цен:', error);
    return { success: false, error: 'Ошибка загрузки цен', data: [] };
  }
}

// Обновление цен
export async function updatePrices(data: any[], category: string) {
  try {
    const user = await requireAuth();
    const orgId = user.organizationId;

    // удаляем только внутри организации
    await prisma.price.deleteMany({
      where: {
        category,
        organizationId: orgId,
      },
    });

    if (data.length > 0) {
      await prisma.price.createMany({
        data: data.map((item) => ({
          organizationId: orgId,
          name: item.name || '',
          value: Number(item.value) || 0,
          unit: item.unit || '',
          category,
          slug: item.slug || '',
          metadata: item.metadata ?? undefined,
        })),
      });
    }

    revalidatePath('/dashboard/prices');

    return { success: true };
  } catch (error) {
    console.error('Ошибка сохранения цен:', error);
    return { success: false, error: 'Ошибка сохранения' };
  }
}