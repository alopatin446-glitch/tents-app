'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

const DEFAULT_ORGANIZATION_ID = 'default_org_id';

function normalizeSlug(rawSlug: unknown, category: string, index: number, used: Set<string>): string {
  const base =
    typeof rawSlug === 'string' && rawSlug.trim().length > 0
      ? rawSlug.trim()
      : `${category}_${index + 1}`;

  let slug = base;
  let counter = 2;

  while (used.has(slug)) {
    slug = `${base}_${counter}`;
    counter += 1;
  }

  used.add(slug);
  return slug;
}

async function ensureDefaultOrganization() {
  await prisma.organization.upsert({
    where: {
      id: DEFAULT_ORGANIZATION_ID,
    },
    update: {},
    create: {
      id: DEFAULT_ORGANIZATION_ID,
      name: 'Default Organization',
    },
  });
}

export async function updatePrices(pricesList: any[], category: string) {
  try {
    await ensureDefaultOrganization();

    await prisma.price.deleteMany({
      where: {
        category,
        organizationId: DEFAULT_ORGANIZATION_ID,
      },
    });

    if (pricesList.length > 0) {
      const usedSlugs = new Set<string>();

      await prisma.price.createMany({
        data: pricesList.map((item, index) => ({
          organizationId: DEFAULT_ORGANIZATION_ID,
          slug: normalizeSlug(item.slug, category, index, usedSlugs),
          name: String(item.name || ''),
          value: Number(item.value) || 0,
          unit: String(item.unit || 'м2'),
          category,
          metadata: item.metadata ?? undefined,
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
    await ensureDefaultOrganization();

    const allPrices = await prisma.price.findMany({
      where: {
        organizationId: DEFAULT_ORGANIZATION_ID,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return {
      success: true,
      data: JSON.parse(JSON.stringify(allPrices)),
    };
  } catch (error) {
    console.error('Ошибка загрузки цен:', error);

    return {
      success: false,
      error: 'Не удалось загрузить цены',
      data: [],
    };
  }
}