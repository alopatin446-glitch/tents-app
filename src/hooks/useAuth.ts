'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction, logoutAction } from '@/app/actions';
import { useAuthContext } from '@/providers/ClientProvider';

export const useAuth = () => {
  const router = useRouter();
  const { user, isLoading } = useAuthContext();

  const login = useCallback(
    async (email: string, pass: string) => {
      const result = await loginAction(email, pass);
      if (result.success) {
        // Используем редирект через window, чтобы гарантированно обновить состояние сессии
        window.location.href = '/dashboard';
        return true;
      }
      return false;
    },
    []
  );

  const logout = useCallback(async () => {
    await logoutAction();
    window.location.href = '/';
  }, []);

  const checkAuth = useCallback(() => {
    // Если загрузка завершена, а пользователя нет — значит не авторизован
    return !isLoading && !!user;
  }, [user, isLoading]);

  return {
    login,
    logout,
    checkAuth,
    isLoading,
    userName: user?.name || 'Пользователь',
    userOrg: user?.organizationName || 'EASY MO',
  };
};