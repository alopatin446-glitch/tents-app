'use server';

import { prisma } from '@/lib/prisma'; // ЕДИНЫЙ МОЗГ: Используем правильный инстанс
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/requireAuth';
import { DEFAULT_PRICE_ROWS } from '@/constants/defaultPrices'; // ГРОССБУХ: Ссылка на эталон[cite: 3, 4]

/**
 * Получение цен с автоматической инициализацией
 */
export async function getPrices() {
  console.log('--- [START] getPrices ---');
  try {
    const user = await requireAuth();
    const orgId = user.organizationId;

    // ТАМОЖНЯ: Проверяем наличие записей. Если пусто — наполняем из эталона[cite: 3]
    const count = await prisma.price.count({ where: { organizationId: orgId } });
    
    if (count === 0 && DEFAULT_PRICE_ROWS.length > 0) {
      console.log('--- [INIT] Creating default prices for org:', orgId);
      await prisma.price.createMany({
        data: DEFAULT_PRICE_ROWS.map(p => ({
          organizationId: orgId,
          slug: p.slug,
          name: p.name,
          value: p.value,
          unit: p.unit,
          category: p.category,
        }))
      });
    }

    const prices = await prisma.price.findMany({
      where: { organizationId: orgId },
      orderBy: { category: 'asc' },
    });

    console.log('--- [SUCCESS] Prices loaded ---');
    return { success: true, data: prices };
  } catch (error) {
    console.error('--- [CRITICAL ERROR] getPrices:', error);
    return { success: false, error: 'Ошибка загрузки цен', data: [] };
  }
}

/**
 * ПОГРАНИЧНИК-СИНТАКСИС: Восстанавливаем экспорт для устранения ошибки 2305
 * ТАМОЖНЯ: Только обновление цен (value), структура (slug) неприкосновенна[cite: 3]
 */
export async function updatePrices(data: any[]) {
  console.log('--- [START] updatePrices ---');
  try {
    const user = await requireAuth();
    const orgId = user.organizationId;

    // Используем транзакцию для массового обновления
    await prisma.$transaction(
      data.map((item) =>
        prisma.price.update({
          where: {
            slug_organizationId: {
              slug: item.slug,
              organizationId: orgId,
            },
          },
          data: {
            value: Number(item.value) || 0,
          },
        })
      )
    );

    console.log('--- [SUCCESS] Prices updated ---');
    revalidatePath('/dashboard/prices');
    return { success: true };
  } catch (error) {
    console.error('--- [ERROR] updatePrices:', error);
    return { success: false, error: 'Не удалось сохранить изменения' };
  }
}