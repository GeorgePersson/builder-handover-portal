import Link from "next/link";
import { Bot, Check, ExternalLink, Pencil, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatusPill } from "@/components/status-pill";
import { getClientRequests, getExtractedHandoverItems, getProductVersions } from "@/lib/server/queries";
import {
  approveExtractedItemGloballyAction,
  convertClientRequestToReviewAction,
  rejectAdminReviewItemAction,
  rejectClientRequestAction,
} from "@/lib/server/actions";
import {
  describeClientRequestStatus,
  describeExtractedItemStatus,
  formatStatus,
} from "@/lib/status-labels";
import { formatDate } from "@/lib/utils";

export default async function AdminReviewPage() {
  const [products, extractedItems, clientRequests] = await Promise.all([
    getProductVersions(),
    getExtractedHandoverItems(),
    getClientRequests(),
  ]);
  const productQueue = products.filter((product) => product.confidenceLabel !== "high");
  const extractedQueue = extractedItems.filter((item) =>
    ["admin_review", "builder_approved", "edited", "proposed"].includes(item.status),
  );

  return (
    <main className="px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          description="Platform-level queue for low-confidence AI matches, vague product requests, and items that need human approval before appearing in builder or client surfaces."
          eyebrow="AI governance"
          icon={Bot}
          title="Admin approval queue"
        />

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <Metric label="Product records" value={productQueue.length} />
          <Metric label="Spec extracted items" value={extractedQueue.length} />
          <Metric label="Client requests" value={clientRequests.length} />
        </section>

        <section className="mt-6 rounded-lg border border-cyan-200 bg-cyan-50 p-5">
          <div className="flex items-start gap-3">
            <Bot className="mt-0.5 size-5 text-cyan-700" />
            <div>
              <h2 className="font-semibold text-slate-950">Hands-off builder workflow</h2>
              <p className="mt-2 text-sm leading-6 text-cyan-900">
                Builders upload specs and only step in when they choose to approve a new item for one
                project. New reusable products and homeowner requests stay here until platform admin
                approves them for the global database.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-slate-950">Low-confidence product records</h2>
              <p className="mt-1 text-sm text-slate-500">These stay internal until source quality improves.</p>
            </div>
            <div className="divide-y divide-slate-100">
              {productQueue.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">No low-confidence product records.</p>
              ) : null}
              {productQueue.map((product) => (
                <article className="p-5" key={product.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-950">{product.productName}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {product.brand} - {product.category} - {product.location || "No location"}
                      </p>
                    </div>
                    <StatusPill variant={product.confidenceLabel} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{product.reviewReason}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      href="/builder/products"
                    >
                      <ExternalLink className="size-3.5" />
                      Open builder record
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-slate-950">Extracted items needing admin eyes</h2>
              <p className="mt-1 text-sm text-slate-500">
                New products stay here until platform admin approval promotes them globally.
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {extractedQueue.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">No extracted items need admin review.</p>
              ) : null}
              {extractedQueue.map((item) => (
                <article className="p-5" key={item.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-950">{item.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {item.itemType} - {item.category} - {item.location || "No location"}
                      </p>
                    </div>
                    <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                      {item.confidenceScore}% confidence
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold capitalize text-slate-700">
                      {formatStatus(item.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    {describeExtractedItemStatus(item.status)}
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
                  <div className="mt-4 flex flex-wrap gap-2">
                    <form action={approveExtractedItemGloballyAction}>
                      <input name="itemId" type="hidden" value={item.id} />
                      <button className="inline-flex h-9 items-center gap-2 rounded-md bg-cyan-700 px-3 text-xs font-semibold text-white hover:bg-cyan-800">
                        <Check className="size-3.5" />
                        Approve globally
                      </button>
                    </form>
                    <form action={rejectAdminReviewItemAction}>
                      <input name="itemId" type="hidden" value={item.id} />
                      <button className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                        <X className="size-3.5" />
                        Reject
                      </button>
                    </form>
                    <Link
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      href={`/builder/specifications/review/${item.id}/edit`}
                    >
                      <Pencil className="size-3.5" />
                      Edit before approval
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-slate-950">Client missing-item requests</h2>
              <p className="mt-1 text-sm text-slate-500">
                Requests should feed AI lookup, then admin or builder approval.
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {clientRequests.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">No client requests yet.</p>
              ) : null}
              {clientRequests.map((request) => (
                <article className="p-5" key={request.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-950">{request.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {request.requestType} - {request.location || "No location"}
                      </p>
                    </div>
                    <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                      {request.confidenceScore}% initial confidence
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{request.details || "No details supplied."}</p>
                  {request.attachmentName ? (
                    <p className="mt-2 text-xs text-slate-500">Attachment: {request.attachmentName}</p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold capitalize text-slate-700">
                      {formatStatus(request.status)}
                    </span>
                    <span className="text-xs text-slate-500">Submitted {formatDate(request.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    {describeClientRequestStatus(request.status)}
                  </p>
                  {request.status === "admin_review" || request.status === "submitted" ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <form action={convertClientRequestToReviewAction}>
                        <input name="requestId" type="hidden" value={request.id} />
                        <button className="inline-flex h-9 items-center gap-2 rounded-md bg-cyan-700 px-3 text-xs font-semibold text-white hover:bg-cyan-800">
                          <Bot className="size-3.5" />
                          Send to AI review
                        </button>
                      </form>
                      <form action={rejectClientRequestAction}>
                        <input name="requestId" type="hidden" value={request.id} />
                        <button className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                          <X className="size-3.5" />
                          Reject request
                        </button>
                      </form>
                    </div>
                  ) : null}
                </article>
              ))}
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
