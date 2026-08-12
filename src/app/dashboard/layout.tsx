import { requireAuth } from '@/lib/auth/requireAuth';
import DashboardSidebar from '@/components/layout/DashboardSidebar';
import styles from './dashboard.module.css';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();

  return (
    <div className={styles.shell}>
      <DashboardSidebar userName={user.name} userRole={user.role} />
      <div className={styles.shellMain}>{children}</div>
    </div>
  );
}