import { notFound } from "next/navigation";
import { Save } from "lucide-react";
import { TextAreaField, TextField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBanner } from "@/components/status-banner";
import { updateExtractedItemAction } from "@/lib/server/actions";
import { getExtractedHandoverItems } from "@/lib/server/queries";

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
          description="Adjust the extracted record before accepting it into the handover package."
          eyebrow="Specification review"
          title="Edit extracted item"
        />
        <StatusBanner error={query.error} />

        <form action={updateExtractedItemAction} className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <input name="itemId" type="hidden" value={item.id} />
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="Title" name="title" defaultValue={item.title} required />
            <TextField label="Category" name="category" defaultValue={item.category} required />
            <TextField label="Location" name="location" defaultValue={item.location} />
            <TextField
              label="Confidence score"
              name="confidenceScore"
              defaultValue={String(item.confidenceScore)}
              required
              type="number"
            />
          </div>
          <div className="mt-5">
            <TextAreaField
              label="Extracted note"
              name="extractedText"
              defaultValue={item.extractedText}
              required
            />
          </div>
          <div className="mt-6 flex justify-end">
            <SubmitButton icon={Save} label="Save changes" />
          </div>
        </form>
      </div>
    </main>
  );
}
