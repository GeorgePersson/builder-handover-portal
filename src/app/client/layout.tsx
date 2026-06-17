import Link from "next/link";
import { Home, Send } from "lucide-react";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link className="flex items-center gap-3" href="/client/portal">
            <div className="flex size-9 items-center justify-center rounded-lg bg-cyan-700 text-white">
              <Home className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">Home manual</p>
              <p className="text-xs text-slate-500">Client portal</p>
            </div>
          </Link>
          <Link
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            href="/client/request-product"
          >
            <Send className="size-3.5" />
            Request item
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
