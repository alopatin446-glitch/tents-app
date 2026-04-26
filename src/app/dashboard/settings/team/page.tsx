/**
 * Страница управления командой.
 * Маршрут: /dashboard/settings/team
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { requireRole } from '@/lib/auth/requireAuth';
import TeamClient from './TeamClient';

export const dynamic = 'force-dynamic';

// Описываем форму данных, которую мы вытягиваем из Prisma
interface UserWithPermissions {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  isOwnerAdmin: boolean;
  lastLoginAt: Date | null;
  permissions: {
    permission: {
      key: string;
    };
  }[];
}

export default async function TeamPage() {
  // Проверка роли — вернет пользователя или редиректнет
  const currentUser = await requireRole(['ADMIN']);

  let users: UserWithPermissions[] = [];

  try {
    // Явно указываем тип возвращаемых данных через as any (или через интерфейс ниже)
    const rawUsers = await prisma.user.findMany({
      orderBy: [
        { isOwnerAdmin: 'desc' },
        { role: 'asc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        isOwnerAdmin: true,
        lastLoginAt: true,
        permissions: {
          select: {
            permission: {
              select: { key: true },
            },
          },
        },
      },
    });
    
    users = rawUsers as unknown as UserWithPermissions[];
    
  } catch (error) {
    logger.error('[TeamPage] Ошибка загрузки пользователей', error);
    users = [];
  }

  // Трансформируем данные для клиента, убирая вложенность permissions
  const userRows = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    isOwnerAdmin: u.isOwnerAdmin,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    // Теперь TS видит, что p.permission.key существует
    permissions: u.permissions.map((p) => p.permission.key),
  }));

  return (
    <TeamClient
      users={userRows}
      currentUserId={currentUser.id}
      currentUserIsOwnerAdmin={currentUser.isOwnerAdmin}
    />
  );
}