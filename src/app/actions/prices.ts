'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/requireAuth';
import { DEFAULT_PRICE_ROWS } from '@/constants/defaultPrices';
import { logger } from '@/lib/logger';

/**
 * Получение цен с автоматической инициализацией
 */
export async function getPrices() {
  try {
    const user = await requireAuth();
    const orgId = user.organizationId;

    // Проверяем наличие записей. Если пусто — наполняем из эталона
    const existingPrices = await prisma.price.findMany({
      where: { organizationId: orgId },
      select: { slug: true },
    });

    const existingSlugs = new Set(existingPrices.map((p) => p.slug));

    const missingPrices = DEFAULT_PRICE_ROWS.filter((p) => !existingSlugs.has(p.slug));

    if (missingPrices.length > 0) {
      logger.info('[getPrices] Добавляем недостающие цены для организации', { orgId, count: missingPrices.length });

      await prisma.price.createMany({
        data: missingPrices.map((p) => ({
          organizationId: orgId,
          slug: p.slug,
          name: p.name,
          value: p.value,
          unit: p.unit,
          category: p.category,
        })),
        skipDuplicates: true,
      });
    }

    const prices = await prisma.price.findMany({
      where: { organizationId: orgId },
      orderBy: { category: 'asc' },
    });

    return { success: true, data: prices };
  } catch (error) {
    logger.error('[getPrices] Ошибка загрузки цен', error);
    return { success: false, error: 'Ошибка загрузки цен', data: [] };
  }
}

/**
 * Только обновление цен (value), структура (slug) неприкосновенна
 */
export async function updatePrices(data: any[]) {
  try {
    const user = await requireAuth();
    const orgId = user.organizationId;

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

    revalidatePath('/dashboard/prices');
    return { success: true };
  } catch (error) {
    logger.error('[updatePrices] Ошибка сохранения цен', error);
    return { success: false, error: 'Не удалось сохранить изменения' };
  }
}