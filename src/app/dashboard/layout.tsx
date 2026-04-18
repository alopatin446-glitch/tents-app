import { ClientProvider } from './clients/ClientContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientProvider>
      <div className="dashboard-wrapper">
        {/* Тут твой сайдбар или шапка */}
        {children}
      </div>
    </ClientProvider>
  );
}