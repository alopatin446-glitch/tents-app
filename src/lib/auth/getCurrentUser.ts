import { cookies } from 'next/headers';
import type { User } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { SESSION_COOKIE_NAME } from './constants';
import { hashSessionToken } from './session';

/**
 * Расширенный тип пользователя, включающий массив разрешений.
 * Используем его везде, где нужна проверка прав.
 */
export type AuthenticatedUser = User & {
  permissions: string[];
};

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) return null;

    const tokenHash = hashSessionToken(token);

    // Находим сессию и подтягиваем связанные данные пользователя
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { 
        user: true 
      },
    });

    if (!session) return null;

    // 1. Проверка на "протухшую" сессию
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } }).catch((error) => {
        logger.error('[getCurrentUser] Не удалось удалить просроченную сессию', error);
      });
      return null;
    }

    // 2. Проверка статуса пользователя (блокировка)
    if (session.user.status !== 'ACTIVE') {
      logger.warn('[getCurrentUser] Попытка входа заблокированного пользователя', {
        userId: session.user.id,
        status: session.user.status,
      });
      return null;
    }

    /**
     * Возвращаем пользователя, принудительно приводя к AuthenticatedUser.
     * Prisma вытягивает все поля из таблицы User (включая массив permissions).
     */
    return session.user as AuthenticatedUser;
  } catch (error) {
    logger.error('[getCurrentUser] Критическая ошибка получения пользователя', error);
    return null;
  }
}