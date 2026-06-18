import Link from "next/link";
import { Bot, FileUp, PackageCheck, Search } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { StatusBanner } from "@/components/status-banner";
import {
  getExtractedHandoverItems,
  getProductVersions,
  getProjects,
  getSpecificationUploads,
} from "@/lib/server/queries";
import { cn, formatDate } from "@/lib/utils";

const filters = [
  { label: "All", value: "all" },
  { label: "Approved", value: "approved" },
  { label: "Awaiting global approval", value: "awaiting" },
];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; storage?: string; error?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const [productVersions, extractedItems, specifications, projects] = await Promise.all([
    getProductVersions(),
    getExtractedHandoverItems(),
    getSpecificationUploads(),
    getProjects(),
  ]);
  const activeFilter = filters.some((filter) => filter.value === params.filter) ? params.filter || "all" : "all";
  const awaitingItems = extractedItems.filter((item) => ["admin_review", "edited", "proposed"].includes(item.status));
  const visibleProducts = productVersions.filter((product) => {
    if (activeFilter === "approved") {
      return product.status === "approved";
    }

    if (activeFilter === "awaiting") {
      return product.status !== "approved";
    }

    return true;
  });

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-cyan-700">Builder workspace</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">Product library</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Search approved global records and keep an eye on project items still waiting for admin approval.
            </p>
          </div>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white"
            href="/builder/projects"
          >
            <FileUp className="size-4" />
            Add through project
          </Link>
        </header>
        <StatusBanner draft={params.draft} error={params.error} storage={params.storage} />

        <div className="mt-6 flex flex-wrap gap-2">
          {filters.map((filter) => (
            <Link
              className={cn(
                "inline-flex h-10 items-center rounded-md border px-3 text-sm font-semibold",
                activeFilter === filter.value
                  ? "border-cyan-700 bg-cyan-700 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              )}
              href={`/builder/products?filter=${filter.value}`}
              key={filter.value}
            >
              {filter.label}
            </Link>
          ))}
        </div>

        {activeFilter !== "approved" ? (
          <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-center gap-2">
              <Bot className="size-5 text-amber-700" />
              <h2 className="font-semibold text-amber-950">Requested or awaiting global approval</h2>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {awaitingItems.length ? (
                awaitingItems.map((item) => {
                  const specification = specifications.find((candidate) => candidate.id === item.specificationId);
                  const project = projects.find((candidate) => candidate.id === specification?.projectId);

                  return (
                    <article className="rounded-md border border-amber-200 bg-white p-4" key={item.id}>
                      <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {project?.name || "Project"} - {item.category} - {item.confidenceScore}%
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {item.reviewReason || item.extractedText}
                      </p>
                    </article>
                  );
                })
              ) : (
                <p className="text-sm text-amber-900">No project items are waiting on admin right now.</p>
              )}
            </div>
          </section>
        ) : null}

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          {visibleProducts.map((product) => (
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

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <Search className="size-5 text-cyan-700" />
            <h2 className="font-semibold text-slate-950">Manual search path</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Product search and request buttons now live inside each project create/edit modal so the item is tied to a project before admin checks it.
          </p>
        </section>
      </div>
    </main>
  );
}
