import { AdminSidebar } from "@/components/layout/admin-sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-slate-50 text-slate-950 lg:grid-cols-[280px_1fr]">
      <AdminSidebar />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
