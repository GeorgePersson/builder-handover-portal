import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { ExtractedItemEditForm } from "@/components/forms/extracted-item-edit-form";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBanner } from "@/components/status-banner";
import { overrideContextForSourceSearchAction } from "@/lib/server/actions";
import { getExtractedHandoverItems } from "@/lib/server/queries";
import { describeExtractedItemStatus, formatStatus } from "@/lib/status-labels";


function getReviewAsk(item: { status: string; reviewReason?: string }) {
  if (item.status === "needs_model_code" || item.reviewReason?.startsWith("Request model/code")) {
    return {
      title: "What this needs",
      body: "Ask for a brand, model, supplier, SKU, product code, or clearer identifier before matching manuals and warranties.",
    };
  }

  if (item.status === "needs_source_document" || item.reviewReason?.startsWith("Request source document")) {
    return {
      title: "What this needs",
      body: "Ask for the quote, manual, warranty, certificate, producer statement, or other source document before approval.",
    };
  }

  if (item.status === "request_more_context" || item.reviewReason?.startsWith("Request more context")) {
    return {
      title: "What this needs",
      body: "Ask the builder to confirm the selection/context before source search. This is usually a real item, but the spec does not contain enough detail yet.",
    };
  }

  if (item.status === "admin_review" || item.status === "edited" || item.status === "proposed") {
    return {
      title: "Review decision needed",
      body: "Check whether this source-backed row is a true handover item, then approve, edit, or reject it.",
    };
  }

  return null;
}

function canTrySourceSearch(item: { status: string; reviewReason?: string; itemType: string }) {
  if (item.itemType !== "product" || item.reviewReason?.includes("[source-search-attempted]")) {
    return false;
  }

  return ["request_more_context", "needs_source_document", "needs_model_code"].includes(item.status) ||
    Boolean(item.reviewReason?.startsWith("Request "));
}

const editErrorMessages: Record<string, string> = {
  "source-search-already-used": "This item has already used its one source-search attempt. Add the product details manually.",
  "source-search-products-only": "Source search override is only available for product items.",
  "source-search-update-failed": "The source-search attempt could not be saved.",
  "check-required-fields": "Check the required fields before saving this item.",
  "document-category-required": "Choose a specific document category before saving.",
  "document-source-required": "Add enough source wording to show why this document belongs in the handover package.",
  "maintenance-action-required": "Maintenance items need a clear care action, such as clean, inspect, service, replace, or test.",
  "maintenance-detail-required": "Add the maintenance detail, cadence, trigger, or source wording before saving.",
  "product-identity-required": "Product items need a specific product, material, fixture, brand, or model name before saving.",
  "product-location-required": "Product items need a project location before saving.",
  "review-reason-required": "Low-confidence edits need a reviewer note explaining why the item is still uncertain.",
  "source-context-required": "High-confidence edits need a source page or source snippet so the decision stays traceable.",
  "update-item-failed": "The item could not be updated. Check the saved data path and try again.",
};

export default async function EditExtractedItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ itemId }, query] = await Promise.all([params, searchParams]);
  const items = await getExtractedHandoverItems();
  const item = items.find((candidate) => candidate.id === itemId);

  if (!item) {
    notFound();
  }

  const reviewAsk = getReviewAsk(item);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          actions={
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href="/builder/specifications/review"
            >
              <ArrowLeft className="size-4" />
              Back to review
            </Link>
          }
          description="Adjust type, category, confidence, and source context before this item is approved or rejected."
          eyebrow="Specification review"
          title="Edit extracted item"
        />
        <StatusBanner error={query.error} errorMessages={editErrorMessages} />

        <section className="mt-6 rounded-lg border border-cyan-200 bg-cyan-50 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold uppercase text-cyan-800">
              {item.itemType}
            </span>
            <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-cyan-800">
              {item.confidenceScore}% confidence
            </span>
            <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold capitalize text-cyan-800">
              {formatStatus(item.status)}
            </span>
          </div>
          <h2 className="mt-3 font-semibold text-slate-950">{item.title}</h2>
          <p className="mt-2 text-sm leading-6 text-cyan-900">{describeExtractedItemStatus(item.status)}</p>
          {reviewAsk ? (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
              <p className="font-semibold text-amber-950">{reviewAsk.title}</p>
              <p className="mt-1">{reviewAsk.body}</p>
              {item.reviewReason ? (
                <p className="mt-2 border-t border-amber-200 pt-2 text-amber-950">{item.reviewReason}</p>
              ) : null}
              {canTrySourceSearch(item) ? (
                <form action={overrideContextForSourceSearchAction} className="mt-3 border-t border-amber-200 pt-3">
                  <input name="itemId" type="hidden" value={item.id} />
                  <button className="inline-flex h-9 items-center gap-2 rounded-md border border-cyan-200 bg-white px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-50">
                    <Search className="size-3.5" />
                    Try source search once
                  </button>
                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    Use this when the product name should be enough. If nothing source-backed is found, add the details manually.
                  </p>
                </form>
              ) : null}
            </div>
          ) : item.reviewReason ? (
            <div className="mt-4 rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">
              <p className="font-semibold text-slate-950">Reviewer note</p>
              <p className="mt-1">{item.reviewReason}</p>
            </div>
          ) : null}
          {item.matchedExistingRecord ? (
            <p className="mt-2 text-sm font-medium text-emerald-700">Matched to {item.matchedExistingRecord}</p>
          ) : null}
        </section>

        <ExtractedItemEditForm item={item} />
      </div>
    </main>
  );
}
