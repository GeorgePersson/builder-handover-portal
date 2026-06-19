import Link from "next/link";
import {
  CalendarCheck2,
  FileText,
  PackageCheck,
  Sparkles,
  Send,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBanner } from "@/components/status-banner";
import { getAcceptedHandoverPackagePreview } from "@/lib/server/queries";

export default async function HandoverPackagePage({
  searchParams,
}: {
  searchParams: Promise<{ published?: string; storage?: string; error?: string }>;
}) {
  const params = await searchParams;
  const preview = await getAcceptedHandoverPackagePreview();
  const project = preview.project;
  const total =
    preview.products.length + preview.documents.length + preview.maintenance.length;

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          actions={
            <>
              <Link
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                href="/builder/specifications/review"
              >
                <Sparkles className="size-4" />
                Review extracted items
              </Link>
              <Link
                className={`inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-white ${
                  total === 0 ? "pointer-events-none bg-slate-300" : "bg-cyan-700 hover:bg-cyan-800"
                }`}
                href="/builder/projects"
                aria-disabled={total === 0}
              >
                <Send className="size-4" />
                Open final send checks
              </Link>
            </>
          }
          description="This preview shows package-ready items: known database matches, project-only builder approvals, and globally approved admin records."
          eyebrow={project?.name || "Generated handover"}
          icon={Send}
          title="Handover package preview"
        />
        <StatusBanner
          draft={params.published ? "saved" : undefined}
          error={params.error}
          storage={params.storage}
        />

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <Metric label="Accepted items" value={total} />
          <Metric label="Products" value={preview.products.length} />
          <Metric label="Documents" value={preview.documents.length} />
          <Metric label="Maintenance" value={preview.maintenance.length} />
        </section>

        {total === 0 ? (
          <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5">
            <p className="font-semibold text-amber-950">No package-ready extraction items yet.</p>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              Upload a specification PDF. Known matches can be pre-approved, while new items can be
              approved for this project by the builder or globally by platform admin.
            </p>
          </section>
        ) : null}

        <section className="mt-6 grid gap-5 xl:grid-cols-3">
          <PackageSection
            empty="Accepted products will appear here."
            icon={PackageCheck}
            items={preview.products}
            title="Products and warranties"
          />
          <PackageSection
            empty="Accepted document requests will appear here."
            icon={FileText}
            items={preview.documents}
            title="Documents"
          />
          <PackageSection
            empty="Accepted maintenance tasks will appear here."
            icon={CalendarCheck2}
            items={preview.maintenance}
            title="Maintenance"
          />
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-5 text-cyan-700" />
            <div>
              <h2 className="font-semibold text-slate-950">Builder review checkpoint</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                The builder should confirm product identities, official source documents,
                maintenance frequencies, and warranty wording before publishing this package to
                the homeowner portal. Builder-approved new items remain project-specific until
                platform admin approves them into the global database.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">{value}</p>
    </div>
  );
}

function PackageSection({
  empty,
  icon: Icon,
  items,
  title,
}: {
  empty: string;
  icon: React.ComponentType<{ className?: string }>;
  items: Array<{
    id: string;
    title: string;
    category: string;
    location: string;
    extractedText: string;
    confidenceScore: number;
  }>;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        <Icon className="size-4 text-cyan-700" />
        <h2 className="font-semibold text-slate-950">{title}</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {items.length === 0 ? (
          <p className="p-5 text-sm leading-6 text-slate-500">{empty}</p>
        ) : null}
        {items.map((item) => (
          <article className="p-5" key={item.id}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">
                {item.confidenceScore}% confidence
              </span>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                {item.category}
              </span>
            </div>
            <h3 className="mt-3 font-semibold text-slate-950">{item.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{item.location || "No location captured"}</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">{item.extractedText}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
