import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { captureCurrentPriceSnapshot } from '@/lib/logic/mountingCalculations';
import type { MountingConfig, TeamCategory } from '@/types/mounting';
import { requireAuth } from '@/lib/auth/requireAuth';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TEAM_CATEGORIES: TeamCategory[] = ['pro', 'mid', 'junior'];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTeamCategory(value: unknown): TeamCategory {
  return TEAM_CATEGORIES.includes(value as TeamCategory) ? (value as TeamCategory) : 'mid';
}

function normalizeMountingConfig(value: unknown): MountingConfig | null {
  if (!isObject(value)) return null;

  const rawTeam = isObject(value.team) ? value.team : {};
  const category = normalizeTeamCategory(rawTeam.category);
  const memberId = typeof rawTeam.memberId === 'string' ? rawTeam.memberId : '';

  return {
    ...(value as unknown as MountingConfig),
    enabled: value.enabled === true,
    team: {
      category,
      memberId,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const clientId = typeof body?.clientId === 'string' ? body.clientId.trim() : '';
    const newDate = typeof body?.newDate === 'string' ? body.newDate.trim() : '';
    const memberId = typeof body?.memberId === 'string' ? body.memberId.trim() : undefined;

    if (!clientId) {
      return NextResponse.json({ error: 'Не указан clientId' }, { status: 400 });
    }

    if (!DATE_RE.test(newDate)) {
      return NextResponse.json({ error: 'Некорректный формат даты. Нужен YYYY-MM-DD' }, { status: 400 });
    }

    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId: user.organizationId,
      },
      select: {
        id: true,
        mountingConfig: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 });
    }

    const currentConfig = normalizeMountingConfig(client.mountingConfig);

    if (!currentConfig?.enabled) {
      return NextResponse.json({ error: 'Монтаж не активен у клиента' }, { status: 400 });
    }

    const nextTeam = {
      ...currentConfig.team,
      memberId: memberId ?? currentConfig.team.memberId,
      category: normalizeTeamCategory(currentConfig.team.category),
    };

    const prices = await prisma.price.findMany({
      where: {
        organizationId: user.organizationId,
      },
      select: {
        slug: true,
        value: true,
      },
    });

    const priceMap: Record<string, number> = {};

    for (const price of prices) {
      priceMap[price.slug] = Number(price.value);
    }

    const updatedConfig: MountingConfig = {
      ...currentConfig,
      mountingDate: newDate,
      team: nextTeam,
      mountingSnapshot:
        currentConfig.mountingSnapshot ?? captureCurrentPriceSnapshot(nextTeam.category, priceMap),
    };

    await prisma.client.update({
      where: {
        id: clientId,
        organizationId: user.organizationId,
      },
      data: {
        mountingConfig: updatedConfig as any,
        installDate: new Date(`${newDate}T00:00:00.000Z`),
      },
    });

    logger.info('[reschedule] Дата монтажа обновлена', {
      clientId,
      newDate,
      memberId: nextTeam.memberId,
    });

    return NextResponse.json({
      success: true,
      clientId,
      mountingDate: newDate,
      memberId: nextTeam.memberId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';

    logger.error('[reschedule] Ошибка обновления даты монтажа', {
      message,
      error,
    });

    return NextResponse.json(
      {
        error: 'Внутренняя ошибка сервера при переносе монтажа',
        details: message,
      },
      { status: 500 },
    );
  }
}
