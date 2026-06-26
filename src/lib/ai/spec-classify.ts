import type { ProposedSpecItem } from "@/lib/ai/spec-extract";

export type SpecReviewLane =
  | "known_match"
  | "general_finish"
  | "needs_builder_context"
  | "needs_model_or_code"
  | "needs_source_document"
  | "admin_review"
  | "maintenance";

export type ClassificationInput = {
  itemType: ProposedSpecItem["item_type"];
  title: string;
  category: string;
  rowText: string;
  manufacturer: string;
  productCode: string;
};

export function classifySpecRow(input: ClassificationInput): SpecReviewLane {
  const text = `${input.title} ${input.category} ${input.rowText}`.toLowerCase();
  const hasIdentifier = Boolean(input.manufacturer || input.productCode);

  if (input.itemType === "maintenance") {
    return "maintenance";
  }

  if (input.itemType === "document" || /quote|manual|warrant|certificate|producer statement|ps\d|ccc|source document/.test(text)) {
    return "needs_source_document";
  }

  if (!hasIdentifier && /heating|cooling|air\s*conditioning|airconditioning|under\s*floor|underfloor|ducted|hvac/.test(text)) {
    return "needs_model_or_code";
  }

  if (/tile|tiling|splashback|paint|colour|color|carpet|flooring|door|hinge|handle|hardware/.test(text)) {
    if (/builder'?s range|selected|tbc|tba|to confirm|as per|quote|supplier|range/.test(text) && !input.productCode) {
      return "needs_builder_context";
    }

    return "general_finish";
  }

  if (/^(fittings|pipe work|kitchen|scullery|laundry|bathroom&|please note:?|doors tops)$/i.test(input.title.trim())) {
    return "needs_builder_context";
  }

  if (/tbc|tba|to confirm|selected|builder'?s range|as per/i.test(text) && !input.productCode) {
    return "needs_builder_context";
  }

  if (!hasIdentifier && /appliance|fixture|tap|mixer|vanity|basin|toilet|shower|light|heating|cooling|air\s*conditioning|airconditioning|ducted|hvac|electrical|plumbing/i.test(text)) {
    return "needs_model_or_code";
  }

  if (!input.productCode && !/floor|tile|paint|cladding|concrete|gib|carpet|membrane|door|light|hardware/i.test(input.category)) {
    return "needs_model_or_code";
  }

  return "admin_review";
}

export function reviewLaneToRecommendedAction(lane: SpecReviewLane): ProposedSpecItem["recommended_action"] {
  switch (lane) {
    case "known_match":
      return "attach_existing_product";
    case "maintenance":
      return "manual_review";
    case "needs_builder_context":
      return "request_more_context";
    case "needs_model_or_code":
      return "needs_model_code";
    case "needs_source_document":
      return "needs_source_document";
    case "general_finish":
    case "admin_review":
    default:
      return "review_new_product";
  }
}

export function getReviewReasonForLane(item: ProposedSpecItem) {
  if (item.matched_existing_record) {
    return `Matched existing record ${item.matched_existing_record}.`;
  }

  if (item.recommended_action === "needs_source_document" || item.recommended_action === "request_document") {
    return "Request source document: this row references a quote, warranty, manual, certificate, or supporting document that should be uploaded or linked before approval.";
  }

  if (item.recommended_action === "needs_model_code") {
    return "Request model/code: the item appears real, but needs brand, supplier, model, product code, or clearer identifier before matching manuals/warranties.";
  }

  if (item.recommended_action === "request_more_context") {
    return "Request more context: keep this source-backed candidate in review, but ask the builder to confirm whether it is a true handover item, location, or project-specific selection.";
  }

  if (/tiles|paint|flooring|doors and hardware/i.test(item.category)) {
    return "General finish item: confirm the supplier/range, colour, location, or project selection where available. Warranty documents may not be required before this can be included as builder-reviewed handover context.";
  }

  return "Needs review because no reusable source-backed record matched this extracted item.";
}
