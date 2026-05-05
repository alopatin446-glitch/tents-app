import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });

  let organizationName = '';
  try {
    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { name: true },
    });
    organizationName = org?.name ?? '';
  } catch {
    // При ошибке БД возвращаем пустую строку — не ломаем авторизацию
  }

  return NextResponse.json({
    user: {
      name: user.name,
      organizationName,
      role: user.role,
    },
  });
}