/**
 * Layout для /dashboard/*
 *
 * ИСПРАВЛЕНИЕ: ClientProvider убран из этого лэйаута.
 *
 * ПОЧЕМУ это вызывало крэш:
 *   DashboardLayout — Server Component (нет 'use client').
 *   ClientProvider — Client Component ('use client').
 *   В React 19 + Next.js 16 + Turbopack, когда Server Component
 *   оборачивает children в Client Component-границу, RSC-сериализатор
 *   упаковывает всё дерево. dashboard/page.tsx импортирует Server Action
 *   (getArchiveOrdersCount), который сериализуется как объект-ссылка
 *   { $$typeof, $$id, ... }. При прохождении через эту RSC-границу
 *   объект попадал в React children → "Objects are not valid as React child".
 *
 * ПРАВИЛЬНАЯ АРХИТЕКТУРА:
 *   - Страницы, которым нужен ClientProvider, подключают его сами.
 *   - /dashboard/clients/page.tsx уже делает это правильно.
 *   - /dashboard/page.tsx — не использует useClients() вообще.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-wrapper">
      {children}
    </div>
  );
}