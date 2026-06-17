"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, FileText, PackageCheck, Save, Wrench } from "lucide-react";
import { TextAreaField, TextField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { updateExtractedItemAction } from "@/lib/server/actions";
import type { ExtractedHandoverItem } from "@/lib/types";

type ItemType = ExtractedHandoverItem["itemType"];

const itemTypeOptions = [
  { label: "Product or material", value: "product" },
  { label: "Document", value: "document" },
  { label: "Maintenance task", value: "maintenance" },
];

const categoryOptionsByType: Record<ItemType, Array<{ label: string; value: string }>> = {
  product: [
    { label: "Cladding", value: "Cladding" },
    { label: "Appliance", value: "Appliance" },
    { label: "Electrical", value: "Electrical" },
    { label: "Heating/cooling", value: "Heating/cooling" },
    { label: "Plumbing", value: "Plumbing" },
    { label: "Roofing", value: "Roofing" },
    { label: "Product to review", value: "To review" },
  ],
  document: [
    { label: "Code compliance certificate", value: "Code compliance certificate" },
    { label: "Producer statement", value: "Producer statement" },
    { label: "Warranty document", value: "Warranty document" },
    { label: "Manual or care guide", value: "Manual or care guide" },
    { label: "Compliance document", value: "Compliance document" },
    { label: "Photo record", value: "Photo record" },
    { label: "Document", value: "Document" },
  ],
  maintenance: [
    { label: "Cleaning", value: "Cleaning" },
    { label: "Servicing", value: "Servicing" },
    { label: "Inspection", value: "Inspection" },
    { label: "Filter replacement", value: "Filter replacement" },
    { label: "Warranty condition", value: "Warranty condition" },
    { label: "Maintenance", value: "Maintenance" },
  ],
};

const typeGuidance: Record<
  ItemType,
  {
    icon: typeof PackageCheck;
    heading: string;
    checklist: string[];
    extractedLabel: string;
    extractedPlaceholder: string;
    snippetPlaceholder: string;
  }
> = {
  product: {
    icon: PackageCheck,
    heading: "Product review details",
    checklist: [
      "Name the product, material, or fixture as specifically as the specification allows.",
      "Keep the location tied to where the item appears in the project.",
      "Use the source snippet to capture brand, model, supplier, or material wording.",
    ],
    extractedLabel: "Product evidence note",
    extractedPlaceholder: "Summarise the product/material wording extracted from the specification.",
    snippetPlaceholder: "Paste the spec line or table row that names the product, brand, model, or material.",
  },
  document: {
    icon: FileText,
    heading: "Document review details",
    checklist: [
      "Use the document title the builder or homeowner would recognise.",
      "Choose the document category that matches the required handover evidence.",
      "Capture the source wording that says the document is required.",
    ],
    extractedLabel: "Document evidence note",
    extractedPlaceholder: "Summarise the required document and why it belongs in the handover package.",
    snippetPlaceholder: "Paste the spec sentence or schedule row that requires this document.",
  },
  maintenance: {
    icon: Wrench,
    heading: "Maintenance review details",
    checklist: [
      "Write the task as an action the homeowner can understand.",
      "Keep cadence, trigger, or warranty condition details in the evidence note.",
      "Connect the task to the relevant product, area, or system in the source snippet.",
    ],
    extractedLabel: "Maintenance evidence note",
    extractedPlaceholder: "Summarise the task, frequency, trigger, or warranty condition.",
    snippetPlaceholder: "Paste the spec line that supports the maintenance requirement.",
  },
};

function getStatusAdvice(item: ExtractedHandoverItem) {
  if (item.status === "auto_approved") {
    return "This item matched an existing record. Keep edits limited to source context unless the extracted wording is clearly wrong.";
  }

  if (item.status === "admin_review") {
    return "This item still needs admin review. Strong source snippets and conservative confidence make that decision easier.";
  }

  if (item.status === "builder_approved" || item.status === "global_approved") {
    return "This item has already been approved. Re-check the source before changing title, category, or confidence.";
  }

  if (item.status === "rejected") {
    return "Saving this item will mark it as edited again. Only revive it if the source evidence supports the change.";
  }

  return "Review the extracted wording, source context, and confidence before sending this item back to the queue.";
}

function getCategoryOptions(itemType: ItemType, currentCategory: string) {
  const options = categoryOptionsByType[itemType];

  if (!currentCategory || options.some((option) => option.value === currentCategory)) {
    return options;
  }

  return [{ label: currentCategory, value: currentCategory }, ...options];
}

export function ExtractedItemEditForm({ item }: { item: ExtractedHandoverItem }) {
  const [itemType, setItemType] = useState<ItemType>(item.itemType);
  const initialCategory = item.category || "To review";
  const [category, setCategory] = useState(initialCategory);
  const guidance = typeGuidance[itemType];
  const GuidanceIcon = guidance.icon;
  const categoryOptions = useMemo(
    () => getCategoryOptions(itemType, category),
    [category, itemType],
  );

  function handleTypeChange(nextType: string) {
    if (nextType !== "product" && nextType !== "document" && nextType !== "maintenance") {
      return;
    }

    setItemType(nextType);
    setCategory(categoryOptionsByType[nextType][0].value);
  }

  return (
    <form action={updateExtractedItemAction} className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
      <input name="itemId" type="hidden" value={item.id} />

      <div className="rounded-md border border-cyan-200 bg-cyan-50 p-4">
        <div className="flex items-start gap-3">
          <GuidanceIcon className="mt-0.5 size-5 shrink-0 text-cyan-700" />
          <div>
            <h2 className="text-sm font-semibold text-slate-950">{guidance.heading}</h2>
            <p className="mt-1 text-sm leading-6 text-cyan-900">{getStatusAdvice(item)}</p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {guidance.checklist.map((check) => (
            <div
              className="flex items-start gap-2 rounded-md border border-cyan-100 bg-white px-3 py-2 text-xs leading-5 text-slate-600"
              key={check}
            >
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-cyan-700" />
              {check}
            </div>
          ))}
        </div>
      </div>

      {item.confidenceScore < 50 || !item.sourceSnippet ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              {item.confidenceScore < 50
                ? "Low-confidence item: keep the score conservative unless the source wording is clear."
                : "No source snippet is attached yet. Add one before approval so the review decision stays traceable."}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Item type</span>
          <select
            className="mt-2 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none ring-cyan-700/20 focus:border-cyan-700 focus:ring-4"
            name="itemType"
            onChange={(event) => handleTypeChange(event.target.value)}
            required
            value={itemType}
          >
            {itemTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Category</span>
          <select
            className="mt-2 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none ring-cyan-700/20 focus:border-cyan-700 focus:ring-4"
            name="category"
            onChange={(event) => setCategory(event.target.value)}
            required
            value={category}
          >
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
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
          label={guidance.extractedLabel}
          name="extractedText"
          defaultValue={item.extractedText}
          placeholder={guidance.extractedPlaceholder}
          required
        />
        <TextAreaField
          label="Source snippet"
          name="sourceSnippet"
          defaultValue={item.sourceSnippet || item.extractedText}
          placeholder={guidance.snippetPlaceholder}
        />
      </div>
      <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-slate-500">
        <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-cyan-700" />
        Keep wording source-backed and builder-reviewed. If the item is uncertain, lower the
        confidence score and leave enough source context for admin review.
      </p>
      <div className="mt-6 flex justify-end">
        <SubmitButton icon={Save} label="Save changes" />
      </div>
    </form>
  );
}
