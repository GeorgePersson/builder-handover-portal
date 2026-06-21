import Link from "next/link";
import { Check, FileUp, Pencil, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBanner } from "@/components/status-banner";
import { getExtractedHandoverItems, getSpecificationUploads } from "@/lib/server/queries";
import { acceptExtractedItemAction, rejectExtractedItemAction } from "@/lib/server/actions";
import { describeExtractedItemStatus, formatStatus } from "@/lib/status-labels";

export default async function SpecificationReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; storage?: string; error?: string }>;
}) {
  const params = await searchParams;
  const [specifications, items] = await Promise.all([
    getSpecificationUploads(),
    getExtractedHandoverItems(),
  ]);
  const activeSpec = specifications[0];
  const packageReadyCount = items.filter((item) =>
    ["accepted", "auto_approved", "builder_approved", "global_approved"].includes(item.status),
  ).length;
  const rejectedCount = items.filter((item) => item.status === "rejected").length;
  const contextRequestCount = items.filter((item) =>
    ["request_more_context", "needs_source_document", "needs_model_code"].includes(item.status) ||
    item.reviewReason?.startsWith("Request "),
  ).length;
  const adminReviewCount = items.filter((item) =>
    ["admin_review", "edited", "proposed"].includes(item.status),
  ).length;
  const sortedItems = [...items].sort((a, b) => {
    const statusRank = {
      admin_review: 0,
      request_more_context: 1,
      needs_source_document: 2,
      needs_model_code: 3,
      proposed: 4,
      edited: 5,
      auto_approved: 6,
      builder_approved: 7,
      global_approved: 8,
      accepted: 9,
      rejected: 10,
    } as Record<string, number>;
    return (statusRank[a.status] ?? 0) - (statusRank[b.status] ?? 0);
  });

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          actions={
            <>
              <Link
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                href="/builder/specifications/new"
              >
                <FileUp className="size-4" />
                Upload another spec
              </Link>
              <Link
                className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white hover:bg-cyan-800"
                href="/builder/handover-package"
              >
                Preview handover package
              </Link>
            </>
          }
          description="Known database matches are pre-approved. New or uncertain items are checked by platform admin, while builders can approve them for this project only."
          eyebrow={activeSpec ? activeSpec.fileName : "Specification review"}
          title="Review extracted handover package"
        />
        <StatusBanner draft={params.draft === "accepted" || params.draft === "rejected" ? "saved" : params.draft} error={params.error} storage={params.storage} />

        <section className="mt-6 grid gap-4 md:grid-cols-5">
          <Metric label="Review items" value={items.length} />
          <Metric label="Admin/new item review" value={adminReviewCount} />
          <Metric label="Context requests" value={contextRequestCount} />
          <Metric label="Package-ready" value={packageReadyCount} />
          <Metric label="Rejected" value={rejectedCount} />
        </section>

        <section className="mt-6 space-y-4">
          {items.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
              <p className="font-semibold text-amber-950">No extracted items waiting for review.</p>
              <p className="mt-2 text-sm leading-6 text-amber-800">
                Upload and process a specification PDF to generate proposed products, documents,
                and maintenance tasks for builder approval.
              </p>
              <Link
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white hover:bg-cyan-800"
                href="/builder/specifications/new"
              >
                <FileUp className="size-4" />
                Upload specification
              </Link>
            </div>
          ) : null}

          {sortedItems.map((item) => (
            <article className="rounded-lg border border-slate-200 bg-white p-5" key={item.id}>
              <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-600">
                      {item.itemType}
                    </span>
                    <span className="rounded-md bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-800">
                      {item.confidenceScore}% confidence
                    </span>
                    {item.matchedExistingRecord ? (
                      <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
                        Matched existing
                      </span>
                    ) : (
                      <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                        New item
                      </span>
                    )}
                    <span className="rounded-md bg-slate-50 px-2 py-1 text-xs font-semibold capitalize text-slate-700">
                      {formatStatus(item.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    {describeExtractedItemStatus(item.status)}
                  </p>
                  <ContextFlag status={item.status} reviewReason={item.reviewReason} />
                  <h2 className="mt-3 text-lg font-semibold text-slate-950">{item.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {item.category} - {item.location || "No location captured"}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.extractedText}</p>
                  {item.sourceSnippet ? (
                    <div className="mt-3 rounded-md border border-cyan-100 bg-cyan-50 p-3 text-sm leading-6 text-cyan-900">
                      <p className="font-semibold text-cyan-950">
                        Source context{item.sourcePage ? ` - page ${item.sourcePage}` : ""}
                      </p>
                      <p className="mt-1">{item.sourceSnippet}</p>
                    </div>
                  ) : null}
                  {item.reviewReason ? (
                    <div className="mt-3 rounded-md border border-amber-100 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                      <p className="font-semibold text-amber-950">Review note</p>
                      <p className="mt-1">{item.reviewReason}</p>
                    </div>
                  ) : null}
                  {item.matchedExistingRecord ? (
                    <p className="mt-3 text-sm text-emerald-700">Matched to {item.matchedExistingRecord}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 lg:flex-col">
                  {!["auto_approved", "builder_approved", "global_approved", "accepted"].includes(item.status) ? (
                    <form action={acceptExtractedItemAction}>
                      <input name="itemId" type="hidden" value={item.id} />
                      <button className="inline-flex h-9 w-full items-center gap-2 rounded-md bg-cyan-700 px-3 text-xs font-semibold text-white">
                        <Check className="size-3.5" />
                        Approve for project
                      </button>
                    </form>
                  ) : null}
                  <Link
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700"
                    href={`/builder/specifications/review/${item.id}/edit`}
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </Link>
                  {item.status !== "rejected" ? (
                    <form action={rejectExtractedItemAction}>
                      <input name="itemId" type="hidden" value={item.id} />
                      <button className="inline-flex h-9 w-full items-center gap-2 rounded-md border border-rose-200 px-3 text-xs font-semibold text-rose-700">
                        <X className="size-3.5" />
                        Reject
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function ContextFlag({ status, reviewReason }: { status: string; reviewReason?: string }) {
  const label = getContextFlagLabel(status, reviewReason);

  if (!label) {
    return null;
  }

  return (
    <div className="mt-3 inline-flex max-w-3xl rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">
      {label}
    </div>
  );
}

function getContextFlagLabel(status: string, reviewReason?: string) {
  if (status === "needs_model_code" || reviewReason?.startsWith("Request model/code")) {
    return "Needs brand, model, supplier, or code before source search.";
  }

  if (status === "needs_source_document" || reviewReason?.startsWith("Request source document")) {
    return "Needs quote, manual, warranty, certificate, or source document before approval.";
  }

  if (status === "request_more_context" || reviewReason?.startsWith("Request more context")) {
    return "Needs builder context before source search.";
  }

  return "";
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">{value}</p>
    </div>
  );
}
