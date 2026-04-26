'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction, logoutAction } from '@/app/actions';
import { useAuthContext } from '@/providers/ClientProvider';

export const useAuth = () => {
  const router = useRouter();
  const { user, isLoading } = useAuthContext();

  const login = useCallback(async (email: string, pass: string) => {
    const result = await loginAction(email, pass);
    if (result.success) {
      window.location.href = '/dashboard';
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(async () => {
    await logoutAction();
    window.location.href = '/';
  }, []);

  const checkAuth = useCallback(() => {
    return !isLoading && !!user;
  }, [user, isLoading]);

  return {
    login,
    logout,
    checkAuth,
    isLoading,
    userName: user?.name || 'Пользователь',
    userOrg: user?.organizationName || 'EASY MO',
    // ВОТ ЭТО ОБЯЗАТЕЛЬНО ДОЛЖНО БЫТЬ ТУТ:
    role: (user as any)?.role || 'USER',
    permissions: (user as any)?.permissions || [],
  };
};