import type { ProposedSpecItem } from "@/lib/ai/spec-extract";
import { getInitialExtractedItemReviewReason } from "@/lib/ai/spec-extract";

export type SpecExtractionCandidate = {
  id: string;
  source_text: string;
  normalized_text: string;
  nearby_heading: string;
  source_page: number | null;
  source_kind: "deterministic_proposal" | "table_row" | "paragraph" | "heading_block";
  deterministic_title: string;
  deterministic_item_type: ProposedSpecItem["item_type"];
  deterministic_category: string;
  deterministic_action: ProposedSpecItem["recommended_action"];
  deterministic_confidence: number;
  deterministic_review_reason: string;
  needs_llm: boolean;
  llm_reason: string;
};

const llmCandidateActions = new Set<ProposedSpecItem["recommended_action"]>([
  "request_more_context",
  "needs_model_code",
  "needs_source_document",
  "manual_review",
  "review_new_product",
]);

function estimateNeedsLlm(item: ProposedSpecItem) {
  const text = `${item.title} ${item.category} ${item.extracted_text} ${item.source_snippet || ""}`.toLowerCase();

  if (item.matched_existing_record && item.confidence_score >= 75) {
    return { needs_llm: false, llm_reason: "High-confidence existing record match." };
  }

  if (item.recommended_action === "attach_existing_task" || item.recommended_action === "attach_existing_product") {
    return { needs_llm: false, llm_reason: "Already attached to an existing record." };
  }

  if (item.item_type === "document" || item.recommended_action === "request_document") {
    return { needs_llm: false, llm_reason: "Deterministic document/source-document classification is sufficient." };
  }

  if (/^(please note:?|note:?|general|n\/a)$/i.test(item.title.trim())) {
    return { needs_llm: false, llm_reason: "Likely note/noise row; do not spend LLM tokens." };
  }

  if (item.confidence_score < 70 && llmCandidateActions.has(item.recommended_action)) {
    return { needs_llm: true, llm_reason: "Low-confidence source-backed candidate needs semantic classification." };
  }

  if (
    item.confidence_score < 82 &&
    /product to review|bathroom fixtures|electrical|tapware|plumbing fixtures|heating\/cooling|appliance/i.test(item.category) &&
    !/productcode:|model|\b[A-Z]{1,5}\s?\d{2,6}\b/.test(item.extracted_text)
  ) {
    return { needs_llm: true, llm_reason: "Potential model/code item without a clear deterministic identifier." };
  }

  if (item.confidence_score < 75 && /builder'?s range|selected|to confirm|as per|quote|supplier/.test(text)) {
    return { needs_llm: true, llm_reason: "Selection/source-context language may need semantic review lane confirmation." };
  }

  return { needs_llm: false, llm_reason: "Deterministic classification is sufficiently clear." };
}

export function buildSpecExtractionCandidates(proposals: ProposedSpecItem[]): SpecExtractionCandidate[] {
  return proposals.map((item, index) => {
    const llmGate = estimateNeedsLlm(item);
    const sourceText = item.source_snippet || item.extracted_text;

    return {
      id: `candidate_${String(index + 1).padStart(3, "0")}`,
      source_text: sourceText,
      normalized_text: item.extracted_text,
      nearby_heading: item.category,
      source_page: item.source_page ?? null,
      source_kind: "deterministic_proposal",
      deterministic_title: item.title,
      deterministic_item_type: item.item_type,
      deterministic_category: item.category,
      deterministic_action: item.recommended_action,
      deterministic_confidence: item.confidence_score,
      deterministic_review_reason: getInitialExtractedItemReviewReason(item),
      needs_llm: llmGate.needs_llm,
      llm_reason: llmGate.llm_reason,
    };
  });
}
