import { requireRole } from '@/lib/auth/requireAuth';

/**
 * Серверный layout для /dashboard/prices.
 * Закрывает всю секцию для ролей ENGINEER и INSTALLER:
 * requireRole перенаправит на /dashboard при недостаточных правах.
 * ADMIN и MANAGER проходят без ограничений.
 */
export default async function PricesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(['ADMIN', 'MANAGER']);
  return <>{children}</>;
}