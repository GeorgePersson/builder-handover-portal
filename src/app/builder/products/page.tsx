import Link from "next/link";
import { FileUp, PackageCheck } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { StatusBanner } from "@/components/status-banner";
import { getProductVersions } from "@/lib/server/queries";
import { formatDate } from "@/lib/utils";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; storage?: string; error?: string }>;
}) {
  const params = await searchParams;
  const productVersions = await getProductVersions();

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-cyan-700">Phase 4-5</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">Product library</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Builder-visible product records come from specification extraction and admin-approved
              global records. New products should start with a spec upload, not manual entry.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white"
              href="/builder/specifications/new"
            >
              <FileUp className="size-4" />
              Upload specification
            </Link>
          </div>
        </header>
        <StatusBanner draft={params.draft} error={params.error} storage={params.storage} />

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          {productVersions.map((product) => (
            <article className="rounded-lg border border-slate-200 bg-white p-5" key={product.id}>
              <div className="flex items-start justify-between gap-3">
                <PackageCheck className="size-5 text-cyan-700" />
                <StatusPill variant={product.status} />
              </div>
              <h2 className="mt-4 text-lg font-semibold">{product.productName}</h2>
              <p className="mt-1 text-sm text-slate-600">{product.brand} - {product.category}</p>
              <p className="mt-4 text-sm leading-6 text-slate-600">{product.maintenanceSummary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusPill variant={product.confidenceLabel} />
                <span className="inline-flex h-7 items-center rounded-md border border-slate-200 px-2.5 text-xs text-slate-600">
                  {product.confidenceScore}%
                </span>
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Checked {formatDate(product.checkedAt)} - {product.sources.length} sources
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
