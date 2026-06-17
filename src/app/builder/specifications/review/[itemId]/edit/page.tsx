import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ExtractedItemEditForm } from "@/components/forms/extracted-item-edit-form";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBanner } from "@/components/status-banner";
import { getExtractedHandoverItems } from "@/lib/server/queries";
import { describeExtractedItemStatus, formatStatus } from "@/lib/status-labels";

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
        <StatusBanner error={query.error} />

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
          {item.matchedExistingRecord ? (
            <p className="mt-2 text-sm font-medium text-emerald-700">Matched to {item.matchedExistingRecord}</p>
          ) : null}
        </section>

        <ExtractedItemEditForm item={item} />
      </div>
    </main>
  );
}
