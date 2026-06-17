import Link from "next/link";
import { Building2, Home, ShieldCheck } from "lucide-react";

const portals = [
  {
    title: "Platform admin",
    description:
      "Operate the SaaS product, monitor builders, review low-confidence AI work, and manage global approval queues.",
    href: "/admin",
    icon: ShieldCheck,
    cta: "Open admin",
  },
  {
    title: "Builder portal",
    description:
      "Upload specification PDFs, manage projects, review extracted handover items, and publish packages to clients.",
    href: "/builder",
    icon: Building2,
    cta: "Open builder portal",
  },
  {
    title: "Client portal",
    description:
      "Homeowners see approved handover information only, with a simple request path for missing products or documents.",
    href: "/client/portal",
    icon: Home,
    cta: "Open client portal",
  },
];

export default function PortalSwitchboardPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-3xl">
          <p className="text-sm font-semibold text-cyan-700">Builder Handover Platform</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
            Three separate portals for the product you are building
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Admin tools, builder workflows, and homeowner access are split so clients never see
            review queues, AI confidence, or manual product management.
          </p>
        </header>

        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          {portals.map((portal) => (
            <article className="rounded-lg border border-slate-200 bg-white p-5" key={portal.href}>
              <div className="flex size-11 items-center justify-center rounded-lg bg-cyan-700 text-white">
                <portal.icon className="size-5" />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-slate-950">{portal.title}</h2>
              <p className="mt-2 min-h-24 text-sm leading-6 text-slate-600">{portal.description}</p>
              <Link
                className="mt-5 inline-flex h-10 items-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800"
                href={portal.href}
              >
                {portal.cta}
              </Link>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-950">Access model</h2>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            Client routes should stay read-only except for requests. Builder routes belong to builder
            companies. Admin routes belong to the platform owner and handle approvals, confidence
            issues, subscriptions, and operational oversight.
          </p>
        </section>
      </div>
    </main>
  );
}
