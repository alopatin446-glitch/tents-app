'use client';

import { useRouter } from 'next/navigation';
import { TEST_USER } from '@/core/auth/mockUser';

export const useAuth = () => {
  const router = useRouter();

  const login = (email: string, pass: string) => {
    if (email === TEST_USER.email && pass === TEST_USER.password) {
      localStorage.setItem('isAuth', 'true');
      router.push('/');
      return true;
    }

    return false;
  };

  const logout = () => {
    localStorage.removeItem('isAuth');
    router.push('/login');
  };

  const checkAuth = () => {
    return typeof window !== 'undefined' && localStorage.getItem('isAuth') === 'true';
  };

  return { login, logout, checkAuth };
};