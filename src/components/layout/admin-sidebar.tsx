import Link from "next/link";
import {
  Activity,
  Bot,
  Building2,
  ClipboardCheck,
  CreditCard,
  Home,
  LayoutDashboard,
  PackageCheck,
  ShieldCheck,
  Users,
} from "lucide-react";

const navItems = [
  { label: "Admin dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "AI approval queue", href: "/admin/review", icon: Bot },
  { label: "Global products", href: "/admin/products", icon: PackageCheck },
  { label: "Billing", href: "/admin/billing", icon: CreditCard },
  { label: "Builder companies", href: "/admin#builders", icon: Building2 },
  { label: "Client activity", href: "/admin#clients", icon: Users },
  { label: "Audit trail", href: "/admin#audit", icon: ClipboardCheck },
  { label: "Portal switchboard", href: "/", icon: Home },
];

export function AdminSidebar() {
  return (
    <aside className="border-r border-slate-200 bg-white px-5 py-6">
      <Link className="flex items-center gap-3" href="/admin">
        <div className="flex size-10 items-center justify-center rounded-lg bg-slate-950 text-white">
          <ShieldCheck className="size-5" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-5">Platform Admin</p>
          <p className="text-xs text-slate-500">Operator portal</p>
        </div>
      </Link>

      <nav className="mt-8 space-y-1">
        {navItems.map((item) => (
          <Link
            className="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950"
            href={item.href}
            key={item.href}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-8 rounded-lg border border-cyan-200 bg-cyan-50 p-4">
        <div className="flex items-start gap-3">
          <Activity className="mt-0.5 size-5 text-cyan-700" />
          <div>
            <p className="text-sm font-semibold text-cyan-950">Admin only</p>
            <p className="mt-1 text-xs leading-5 text-cyan-800">
              Builders and clients should never see platform-level queues, confidence triage, or
              tenant controls.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
