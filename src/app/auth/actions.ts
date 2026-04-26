'use server';

import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyPassword } from '@/lib/auth/crypto';
import {
  generateSessionToken,
  getSessionExpiry,
  hashSessionToken,
} from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/constants';

type LoginResult = { success: true } | { success: false; error: string };

export async function loginAction(
  email: string,
  password: string
): Promise<LoginResult> {
  try {
    const cookieStore = await cookies();
    
    // 1. Предварительная очистка
    cookieStore.delete(SESSION_COOKIE_NAME);

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Поиск пользователя
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return { success: false, error: 'Неверный email или пароль' };
    }

    if (user.status !== 'ACTIVE') {
      return { success: false, error: 'Аккаунт заблокирован' };
    }

    // 3. Проверка пароля
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return { success: false, error: 'Неверный email или пароль' };
    }

    // 4. Генерация токена
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = getSessionExpiry();

    // 5. Запись в базу
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // 6. Установка куки
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    console.log(`[AUTH] Успешный вход: ${user.email}`);
    return { success: true };

  } catch (error) {
    console.error('[AUTH_ERROR]', error);
    return { success: false, error: 'Ошибка сервера' };
  }
}

// ЭТОЙ ФУНКЦИИ НЕ ХВАТАЛО
export async function logoutAction(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      const tokenHash = hashSessionToken(token);
      await prisma.session.deleteMany({
        where: { tokenHash },
      });
    }

    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch (error) {
    console.error('[logoutAction] Error:', error);
  }
}