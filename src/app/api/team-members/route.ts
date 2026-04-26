/**
 * GET /api/team-members
 *
 * Возвращает список активных членов монтажной бригады в формате TeamMemberConfig[].
 * Используется клиентскими компонентами (MountingStep, CalendarClient) для получения
 * актуального списка монтажников из БД.
 *
 * Логика fallback делегирована в getActiveTeamMembers() (teamMemberService.ts).
 *
 * Auth: требует активного пользователя (ACTIVE статус).
 *
 * @module src/app/api/team-members/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { getActiveTeamMembers } from '@/lib/services/teamMemberService';
import { logger } from '@/lib/logger';

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();

    if (!user || user.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const members = await getActiveTeamMembers();

    return NextResponse.json(members);
  } catch (error) {
    logger.error('[GET /api/team-members] Ошибка получения списка монтажников', error);

    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 },
    );
  }
}