import { cookies } from 'next/headers';
import type { User } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { SESSION_COOKIE_NAME } from './constants';
import { hashSessionToken } from './session';

export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) return null;

    const tokenHash = hashSessionToken(token);

    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) return null;

    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } }).catch((error) => {
        logger.error('[getCurrentUser] Не удалось удалить просроченную сессию', error);
      });

      return null;
    }

    if (session.user.status !== 'ACTIVE') {
      logger.warn('[getCurrentUser] Пользователь заблокирован', {
        userId: session.user.id,
        status: session.user.status,
      });

      return null;
    }

    return session.user;
  } catch (error) {
    logger.error('[getCurrentUser] Ошибка получения пользователя', error);
    return null;
  }
}