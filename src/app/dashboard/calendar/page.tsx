/**
 * Глобальный календарь монтажей и дополнительных событий.
 * Route: /dashboard/calendar
 */

import { prisma } from '@/lib/prisma';
import { calculateMounting } from '@/lib/logic/mountingCalculations';
import { parseWindowItems } from '@/types';
import { calculateTotalArea } from '@/lib/logic/windowCalculations';
import { logger } from '@/lib/logger';
import CalendarClient from './CalendarClient';
import type { MountingConfig, MountingStatus } from '@/types/mounting';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getActiveTeamMembers } from '@/lib/services/teamMemberService';
import { getPrices } from '@/app/actions/prices';

function normalizeDate(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function isMountingConfig(value: unknown): value is MountingConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const cfg = value as Partial<MountingConfig>;
  return cfg.enabled === true && Boolean(cfg.mountingDate);
}

async function fetchCalendarEvents(
  organizationId: string,
  priceMap: Record<string, number>,
) {
  try {
    const clients = await prisma.client.findMany({
      where: { organizationId },
      select: {
        id: true,
        fio: true,
        address: true,
        mountingConfig: true,
        items: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const extraEvents = await prisma.calendarEvent.findMany({
      where: { organizationId },
      orderBy: { date: 'asc' },
    });

    const mountingEvents = clients
      .filter((client) => isMountingConfig(client.mountingConfig))
      .map((client) => {
        const cfg = client.mountingConfig as unknown as MountingConfig;
        const parsedItems = parseWindowItems(client.items ?? []);
        const areaM2 = calculateTotalArea(parsedItems);
        const calculation = calculateMounting(cfg, areaM2, priceMap);
        const memberId = cfg.team?.memberId || '';

        return {
          id: `installation-${client.id}`,
          type: 'installation' as const,
          clientId: client.id,
          clientName: client.fio || 'Клиент без имени',
          address: client.address || '',
          mountingDate: normalizeDate(cfg.mountingDate),
          durationDays: Number(cfg.durationDays || 1),
          startTime: cfg.startTime || '09:00',
          endTime: cfg.endTime || '18:00',
          memberId,
          status: (cfg.status || 'pending') as MountingStatus,
          retailFinal: calculation.retailFinal || 0,
          isConflict: false,
        };
      })
      .filter((event) => Boolean(event.mountingDate));

    const calendarEvents = (Array.isArray(extraEvents) ? extraEvents : [])
      .map((event: any) => {
        const type = event.type === 'dayOff' || event.type === 'personal'
          ? event.type
          : 'personal';

        return {
          id: String(event.id || ''),
          type: type as 'personal' | 'dayOff',
          clientId: '',
          clientName: '',
          address: '',
          title: event.title || (type === 'dayOff' ? 'Выходной' : 'Личное событие'),
          description: event.description || '',
          mountingDate: normalizeDate(event.date),
          durationDays: Number(event.durationDays || 1),
          startTime: event.startTime || '09:00',
          endTime: event.endTime || '18:00',
          memberId: event.memberId || null,
          isGlobal: Boolean(event.isGlobal),
          status: undefined,
          retailFinal: 0,
          isConflict: false,
        };
      })
      .filter((event: any) => Boolean(event.mountingDate));

    return [...mountingEvents, ...calendarEvents];
  } catch (error) {
    logger.error('[CalendarPage] Ошибка загрузки календаря', error);
    return [];
  }
}

export default async function CalendarPage() {
  const user = await requireAuth();

  const pricesResult = await getPrices();

  let priceMap: Record<string, number> = {};

  if (pricesResult.success && Array.isArray(pricesResult.data)) {
    for (const price of pricesResult.data) {
      priceMap[price.slug] = Number(price.value);
    }
  }

  const [events, teamMembers] = await Promise.all([
    fetchCalendarEvents(user.organizationId, priceMap),
    getActiveTeamMembers(user.organizationId),
  ]);

  return <CalendarClient initialEvents={events} teamMembers={teamMembers} />;
}