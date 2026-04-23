'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Хук авторизации.
 *
 * ИСПРАВЛЕНИЯ:
 *
 * 1. Все функции обёрнуты в useCallback с явными зависимостями.
 *    БЕЗ useCallback каждый вызов useAuth() создавал новые экземпляры
 *    функций. Поскольку checkAuth использовалась в useEffect([checkAuth, router]),
 *    это вызывало бесконечный цикл перезапуска эффекта.
 *
 * 2. login и logout также стабилизированы — они захватывают router
 *    в зависимостях, что корректно для React 19.
 *
 * 3. checkAuth не имеет зависимостей (не использует state/props),
 *    поэтому [] — правильный список deps. Функция стабильна на всё
 *    время жизни компонента.
 */
export const useAuth = () => {
  const router = useRouter();

  const login = useCallback(
    (email: string, pass: string): boolean => {
      if (email === 'admin@test.com' && pass === 'admin') {
        localStorage.setItem('isAuth', 'true');
        router.push('/dashboard');
        return true;
      }
      return false;
    },
    [router]
  );

  const logout = useCallback((): void => {
    localStorage.removeItem('isAuth');
    // Жёсткий редирект с перезагрузкой — намеренно, чтобы сбросить
    // весь клиентский state (провайдеры, кэши, etc.)
    window.location.href = '/';
  }, []);

  /**
   * Проверяет, авторизован ли пользователь.
   * Стабильная ссылка ([] deps) — не зависит от внешнего state.
   * Безопасна для SSR: возвращает false если window недоступен.
   */
  const checkAuth = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('isAuth') === 'true';
  }, []);

  return {
    login,
    logout,
    checkAuth,
    userName: 'Антон',
    userOrg: 'Tents App',
  };
};