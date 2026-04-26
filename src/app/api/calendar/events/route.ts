import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEventType(value: unknown): 'personal' | 'dayOff' {
  return value === 'dayOff' ? 'dayOff' : 'personal';
}

function normalizeDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET() {
  try {
    // any нужен до полной пересборки Prisma Client после миграции.
    const events = await (prisma as any).calendarEvent.findMany({
      orderBy: { date: 'asc' },
    });

    return NextResponse.json(Array.isArray(events) ? events : []);
  } catch (error) {
    console.error('Ошибка загрузки событий календаря:', error);
    return NextResponse.json(
      { error: 'Ошибка загрузки событий календаря' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const date = normalizeDate(body.date);

    if (!date) {
      return NextResponse.json(
        { error: 'Не указана корректная дата события' },
        { status: 400 },
      );
    }

    const type = normalizeEventType(body.type);
    const isGlobal = Boolean(body.isGlobal);
    const memberId = isGlobal ? null : normalizeString(body.memberId);

    const event = await (prisma as any).calendarEvent.create({
      data: {
        type,
        title: normalizeString(body.title) || (type === 'dayOff' ? 'Выходной' : 'Личное событие'),
        description: normalizeString(body.description),
        date,
        startTime: normalizeString(body.startTime) || '09:00',
        endTime: normalizeString(body.endTime) || '18:00',
        durationDays: Math.max(1, Number(body.durationDays || 1)),
        isGlobal,
        memberId,
      },
    });

    return NextResponse.json(event);
  } catch (error) {
    console.error('Ошибка создания события календаря:', error);
    return NextResponse.json(
      { error: 'Ошибка создания события календаря' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const id = normalizeString(body.id);

    if (!id) {
      return NextResponse.json(
        { error: 'Не указан ID события' },
        { status: 400 },
      );
    }

    await (prisma as any).calendarEvent.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ошибка удаления события календаря:', error);
    return NextResponse.json(
      { error: 'Ошибка удаления события календаря' },
      { status: 500 },
    );
  }
}
