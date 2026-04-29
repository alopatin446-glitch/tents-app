/**
 * Страница управления командой.
 * Маршрут: /dashboard/settings/team
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { requireRole } from '@/lib/auth/requireAuth';
import TeamClient from './TeamClient';

export const dynamic = 'force-dynamic';

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
  const currentUser = await requireRole(['ADMIN']);

  let users: UserWithPermissions[] = [];
  let teamMembers: {
    id: string;
    name: string;
    phone: string | null;
    category: string;
    userId: string | null;
  }[] = [];

  try {
    const rawUsers = await prisma.user.findMany({
      where: {
        organizationId: currentUser.organizationId,
      },
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

    const rawTeamMembers = await prisma.teamMember.findMany({
      where: {
        organizationId: currentUser.organizationId,
        status: 'active',
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        name: true,
        phone: true,
        category: true,
        userId: true,
      },
    });

    users = rawUsers as unknown as UserWithPermissions[];
    teamMembers = rawTeamMembers;
  } catch (error) {
    logger.error('[TeamPage] Ошибка загрузки команды', error);
    users = [];
    teamMembers = [];
  }

  const userRows = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    isOwnerAdmin: u.isOwnerAdmin,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    permissions: u.permissions.map((p) => p.permission.key),
  }));

  return (
    <TeamClient
      users={userRows}
      teamMembers={teamMembers}
      currentUserId={currentUser.id}
      currentUserIsOwnerAdmin={currentUser.isOwnerAdmin}
    />
  );
}