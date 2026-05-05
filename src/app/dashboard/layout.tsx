import { ClientProvider } from "@/providers/ClientProvider";
import ToastContainer from "@/components/ui/ToastContainer";

/** * Layout для /dashboard/
 * Теперь он правильно оборачивает все страницы в ClientProvider
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientProvider>
      <div className="dashboard-wrapper">
        {children}
      </div>
      <ToastContainer />
    </ClientProvider>
  );
}