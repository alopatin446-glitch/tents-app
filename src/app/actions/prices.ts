'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/requireAuth';
import { DEFAULT_PRICE_ROWS } from '@/constants/defaultPrices';

async function ensureDefaultPrices(organizationId: string) {
  if (DEFAULT_PRICE_ROWS.length === 0) return;

  await prisma.$transaction(
    DEFAULT_PRICE_ROWS.map((price) =>
      prisma.price.upsert({
        where: {
          slug_organizationId: {
            slug: price.slug,
            organizationId,
          },
        },
        update: {},
        create: {
          organizationId,
          slug: price.slug,
          name: price.name,
          value: price.value,
          unit: price.unit,
          category: price.category,
        },
      }),
    ),
  );
}

// Получение цен
export async function getPrices() {
  try {
    const user = await requireAuth();
    const orgId = user.organizationId;
    await ensureDefaultPrices(orgId);

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
    await prisma.$transaction([
      prisma.price.deleteMany({
        where: {
          category,
          organizationId: orgId,
        },
      }),

      ...(data.length > 0
        ? [
          prisma.price.createMany({
            data: data.map((item) => ({
              organizationId: orgId,
              name: item.name || '',
              value: Number(item.value) || 0,
              unit: item.unit || '',
              category,
              slug: item.slug || '',
              metadata: item.metadata ?? undefined,
            })),
          }),
        ]
        : []),
    ]);

    revalidatePath('/dashboard/prices');

    return { success: true };
  } catch (error) {
    console.error('Ошибка сохранения цен:', error);
    return { success: false, error: 'Ошибка сохранения' };
  }
}