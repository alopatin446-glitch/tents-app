import { NextRequest, NextResponse } from 'next/server';
// Импортируем имя куки из твоих же констант
import { SESSION_COOKIE_NAME } from '@/lib/auth/constants';

export function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isDashboardPage = request.nextUrl.pathname.startsWith('/dashboard');

  // Если пользователь лезет в дашборд без токена — на логин
  if (isDashboardPage && !token) {
    const loginUrl = new URL('/login', request.url);
    // Добавляем параметр, чтобы после логина знать куда вернуть (опционально)
    // loginUrl.searchParams.set('from', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Если пользователь залогинен и пытается зайти на /login — кидаем в дашборд
  if (request.nextUrl.pathname === '/login' && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

// Защищаем только дашборд и страницу логина
export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};