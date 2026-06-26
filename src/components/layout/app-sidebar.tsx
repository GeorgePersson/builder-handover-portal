import Link from "next/link";
import {
  Activity,
  Building2,
  CalendarCheck2,
  ClipboardCheck,
  Home,
  PackageCheck,
  Settings,
  ShieldCheck,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/builder", icon: Activity },
  { label: "Projects", href: "/builder/projects", icon: Building2 },
  { label: "Product Library", href: "/builder/products", icon: PackageCheck },
  { label: "Maintenance", href: "/builder/maintenance", icon: CalendarCheck2 },
  { label: "Settings", href: "/builder/settings", icon: Settings },
  { label: "Portal Switchboard", href: "/", icon: ClipboardCheck },
];

export function AppSidebar() {
  return (
    <aside className="border-r border-slate-200 bg-white px-5 py-6">
      <Link className="flex items-center gap-3" href="/">
        <div className="flex size-10 items-center justify-center rounded-lg bg-slate-950 text-white">
          <Home className="size-5" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-5">Builder Handover</p>
          <p className="text-xs text-slate-500">AI-assisted portal</p>
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

      <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 text-amber-700" />
          <div>
            <p className="text-sm font-semibold text-amber-950">Review before approval</p>
            <p className="mt-1 text-xs leading-5 text-amber-800">
              AI drafts stay source-backed and builder-reviewed before homeowners see them.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
