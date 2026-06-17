import Link from "next/link";
import { Bot, PackageCheck, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusPill } from "@/components/status-pill";
import { getProductVersions } from "@/lib/server/queries";
import { formatDate } from "@/lib/utils";

export default async function AdminProductsPage() {
  const products = await getProductVersions();
  const approvedProducts = products.filter((product) => product.status === "approved");
  const needsEnrichment = products.filter((product) => product.status !== "approved");

  return (
    <main className="px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          actions={
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white hover:bg-cyan-800"
              href="/admin/review"
            >
              <Bot className="size-4" />
              Review queue
            </Link>
          }
          description="Reusable product records approved by platform admin. Builders can attach these with minimal review when specs match confidently."
          eyebrow="Global database"
          icon={PackageCheck}
          title="Global product library"
        />

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <Metric label="Total records" value={products.length} />
          <Metric label="Approved" value={approvedProducts.length} />
          <Metric label="Needs enrichment" value={needsEnrichment.length} />
        </section>

        <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Confidence</th>
                  <th className="px-5 py-3">Sources</th>
                  <th className="px-5 py-3">Checked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-950">{product.productName}</p>
                      <p className="mt-1 text-xs text-slate-500">{product.brand}</p>
                      <p className="mt-2 max-w-md text-xs leading-5 text-slate-500">{product.reviewReason}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{product.category}</td>
                    <td className="px-5 py-4">
                      <StatusPill variant={product.status} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill variant={product.confidenceLabel} />
                        <span className="text-xs text-slate-500">{product.confidenceScore}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="size-4 text-cyan-700" />
                          <span>{product.sources.length} source{product.sources.length === 1 ? "" : "s"}</span>
                        </div>
                        {product.sources.length > 0 ? (
                          <div className="space-y-1">
                            {product.sources.slice(0, 2).map((source) => (
                              <a
                                className="block max-w-[18rem] truncate text-xs font-medium text-cyan-700 hover:text-cyan-900"
                                href={source.url}
                                key={`${product.id}-${source.title}`}
                                rel="noreferrer"
                                target="_blank"
                              >
                                {source.title}
                              </a>
                            ))}
                          </div>
                        ) : null}
                        {product.missingFields.length > 0 ? (
                          <p className="max-w-[18rem] text-xs leading-5 text-amber-700">
                            Missing: {product.missingFields.join(", ")}
                          </p>
                        ) : (
                          <p className="text-xs text-emerald-700">Source-backed</p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(product.checkedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
