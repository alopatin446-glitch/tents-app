import { redirect } from 'next/navigation';
import type { User, UserRole } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getCurrentUser } from './getCurrentUser';

export type AuthenticatedUser = User & {
  organizationId: string;
};

export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();

  if (!user || !user.organizationId) {
    redirect('/login');
  }

  return user as AuthenticatedUser;
}

export async function requireRole(
  allowedRoles: UserRole[]
): Promise<AuthenticatedUser> {
  const user = await requireAuth();

  if (user.role === 'ADMIN') {
    return user;
  }

  if (!allowedRoles.includes(user.role)) {
    logger.warn('[requireRole] Недостаточно прав', {
      userId: user.id,
      role: user.role,
      allowedRoles,
    });

    redirect('/dashboard');
  }

  return user;
}

export async function requirePermission(
  permissionKey: string
): Promise<AuthenticatedUser> {
  const user = await requireAuth();

  if (user.role === 'ADMIN') {
    return user;
  }

  const permission = await prisma.userPermission.findFirst({
    where: {
      userId: user.id,
      permission: {
        key: permissionKey,
      },
    },
  });

  if (!permission) {
    logger.warn('[requirePermission] Нет разрешения', {
      userId: user.id,
      permissionKey,
    });

    redirect('/dashboard');
  }

  return user;
}