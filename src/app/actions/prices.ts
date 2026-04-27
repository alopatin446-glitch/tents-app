'use server'

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function updatePrices(pricesList: any[], category: string) {
  try {
    await prisma.price.deleteMany({
      where: { category: category }
    });

    if (pricesList.length > 0) {
      await prisma.price.createMany({
        data: pricesList.map((item) => ({
          organizationId: 'default_org_id', // <--- КАЖДОЙ ЦЕНЕ НУЖЕН ЭТОТ ID
          slug: item.slug || '',      // ТЕПЕРЬ СОХРАНЯЕМ СЛАГ
          name: item.name || '',
          value: parseFloat(item.value) || 0,
          unit: item.unit || 'м2',
          category: category,
        })),
      });
    }

    revalidatePath('/dashboard/prices');
    return { success: true };
  } catch (error) {
    console.error('КРИТИЧЕСКАЯ ОШИБКА СОХРАНЕНИЯ:', error);
    return { success: false, error: String(error) };
  }
}

export async function getPrices() {
  try {
    const allPrices = await prisma.price.findMany({
      orderBy: { name: 'asc' }
    });
    // Сериализация для Next.js
    return { success: true, data: JSON.parse(JSON.stringify(allPrices)) };
  } catch (error) {
    console.error('Ошибка загрузки цен:', error);
    return { success: false, error: 'Не удалось загрузить цены' };
  }
}