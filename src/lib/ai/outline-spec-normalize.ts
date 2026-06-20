import type { ProposedSpecItem } from "@/lib/ai/spec-extract";
import {
  getStrongestIdentity,
  type OutlineSpecExtractedItem,
  type OutlineSpecExtraction,
} from "@/lib/extraction/outline-spec-schema";

function clampConfidence(value: unknown) {
  const number = typeof value === "number" && Number.isFinite(value) ? value : 35;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function compact(parts: Array<string | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function getItemType(item: OutlineSpecExtractedItem): ProposedSpecItem["item_type"] {
  const classification = item.Review?.ContextClassification;
  const category = item.ItemName.Category?.toLowerCase() || "";
  const name = item.ItemName.Name?.toLowerCase() || "";

  if (classification === "project_document") {
    return "document";
  }

  if (
    category.includes("maintenance") ||
    name.includes("maintenance") ||
    name.includes("clean") ||
    name.includes("service")
  ) {
    return "maintenance";
  }

  return "product";
}

function getRecommendedAction(item: OutlineSpecExtractedItem): ProposedSpecItem["recommended_action"] {
  const classification = item.Review?.ContextClassification;

  if (classification === "project_document") {
    return "request_document";
  }

  if (
    classification === "builder_input_needed" ||
    classification === "generic_allowance" ||
    classification === "admin_or_contract" ||
    classification === "not_handover_relevant"
  ) {
    return "manual_review";
  }

  return item.ItemName.HasIdentifier ? "review_new_product" : "manual_review";
}

function getTitle(item: OutlineSpecExtractedItem) {
  return compact([
    item.ItemName.Manufacturer,
    item.ItemName.ProductRange,
    item.ItemName.ModelName,
    item.ItemName.ProductCode,
    item.ItemName.Name,
  ]) || "Unclassified specification item";
}

function getExtractedText(item: OutlineSpecExtractedItem) {
  return [
    item.Evidence?.SourceSnippet,
    item.ItemName.Description,
    item.ItemName.Notes,
    getStrongestIdentity(item.ItemName) ? `Identity: ${getStrongestIdentity(item.ItemName)}` : "",
    item.Review?.MissingFields?.length ? `Missing: ${item.Review.MissingFields.join(", ")}` : "",
    item.Review?.BuilderQuestions?.length ? `Builder questions: ${item.Review.BuilderQuestions.join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function normalizeOutlineSpecExtraction(extraction: OutlineSpecExtraction): ProposedSpecItem[] {
  return extraction.Items.map((item) => ({
    item_type: getItemType(item),
    title: getTitle(item),
    category: item.ItemName.Category || "To review",
    location: item.ItemName.Location || "Project",
    extracted_text: getExtractedText(item),
    matched_existing_record: null,
    confidence_score: clampConfidence(item.Evidence?.Confidence),
    recommended_action: getRecommendedAction(item),
  }));
}
