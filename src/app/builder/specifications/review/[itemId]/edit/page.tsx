import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { SelectField, TextAreaField, TextField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBanner } from "@/components/status-banner";
import { updateExtractedItemAction } from "@/lib/server/actions";
import { getExtractedHandoverItems } from "@/lib/server/queries";
import { describeExtractedItemStatus, formatStatus } from "@/lib/status-labels";

const itemTypeOptions = [
  { label: "Product or material", value: "product" },
  { label: "Document", value: "document" },
  { label: "Maintenance task", value: "maintenance" },
];

const categoryOptions = [
  { label: "Appliance", value: "Appliance" },
  { label: "Cladding", value: "Cladding" },
  { label: "Compliance document", value: "Compliance document" },
  { label: "Document", value: "Document" },
  { label: "Electrical", value: "Electrical" },
  { label: "Heating/cooling", value: "Heating/cooling" },
  { label: "Maintenance", value: "Maintenance" },
  { label: "Plumbing", value: "Plumbing" },
  { label: "Roofing", value: "Roofing" },
  { label: "To review", value: "To review" },
];

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

  const categoryValue = item.category || "To review";
  const categorySelectOptions = categoryOptions.some((option) => option.value === categoryValue)
    ? categoryOptions
    : [{ label: categoryValue, value: categoryValue }, ...categoryOptions];

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

        <form action={updateExtractedItemAction} className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <input name="itemId" type="hidden" value={item.id} />
          <div className="grid gap-5 md:grid-cols-2">
            <SelectField
              label="Item type"
              name="itemType"
              options={itemTypeOptions}
              defaultValue={item.itemType}
              required
            />
            <SelectField
              label="Category"
              name="category"
              options={categorySelectOptions}
              defaultValue={categoryValue}
              required
            />
            <TextField label="Title" name="title" defaultValue={item.title} required />
            <TextField label="Location" name="location" defaultValue={item.location} />
            <TextField
              label="Confidence score"
              name="confidenceScore"
              defaultValue={String(item.confidenceScore)}
              required
              type="number"
              min="0"
              max="100"
            />
            <TextField
              label="Source page"
              name="sourcePage"
              defaultValue={item.sourcePage ? String(item.sourcePage) : ""}
              type="number"
              min="1"
            />
          </div>
          <div className="mt-5 grid gap-5">
            <TextAreaField
              label="Extracted note"
              name="extractedText"
              defaultValue={item.extractedText}
              required
            />
            <TextAreaField
              label="Source snippet"
              name="sourceSnippet"
              defaultValue={item.sourceSnippet || item.extractedText}
              placeholder="Paste the spec sentence, table row, or source excerpt this decision should rely on."
            />
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-500">
            Keep wording source-backed and builder-reviewed. If the item is uncertain, lower the
            confidence score and leave enough source context for admin review.
          </p>
          <div className="mt-6 flex justify-end">
            <SubmitButton icon={Save} label="Save changes" />
          </div>
        </form>
      </div>
    </main>
  );
}
