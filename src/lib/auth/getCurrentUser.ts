import { cookies } from 'next/headers';
import type { User } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { SESSION_COOKIE_NAME } from './constants';
import { hashSessionToken } from './session';

/**
 * Расширяем тип: теперь пользователь ОБЯЗАТЕЛЬНО несет в себе organizationId
 */
export type AuthenticatedUser = User & {
  permissions: string[];
  organizationId: string; // <--- Теперь это поле официально существует для TS
};

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) return null;

    const tokenHash = hashSessionToken(token);

    // Находим сессию и подтягиваем пользователя
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { 
        user: true 
      },
    });

    if (!session || !session.user) return null;

    // 1. Проверка на просроченную сессию
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } }).catch((error) => {
        logger.error('[getCurrentUser] Не удалось удалить просроченную сессию', error);
      });
      return null;
    }

    // 2. Проверка блокировки
    if (session.user.status !== 'ACTIVE') {
      logger.warn('[getCurrentUser] Вход заблокирован', { userId: session.user.id });
      return null;
    }

    // 3. Проверка наличия организации (КРИТИЧНО для безопасности)
    if (!session.user.organizationId) {
      logger.error('[getCurrentUser] У пользователя не привязана организация', { userId: session.user.id });
      return null;
    }

    return session.user as AuthenticatedUser;
  } catch (error) {
    logger.error('[getCurrentUser] Ошибка получения пользователя', error);
    return null;
  }
}