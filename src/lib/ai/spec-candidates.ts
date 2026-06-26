import type { ProposedSpecItem } from "@/lib/ai/spec-extract";
import { getInitialExtractedItemReviewReason } from "@/lib/ai/spec-extract";

export type SpecLlmEligibilityReason =
  | "already_matched_existing_record"
  | "already_attached_existing_record"
  | "deterministic_source_document"
  | "obvious_note_or_noise"
  | "low_information_source"
  | "source_backed_unmatched_candidate"
  | "selection_or_context_candidate"
  | "model_or_code_candidate";

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
  eligibility_reason: SpecLlmEligibilityReason;
  spend_priority: number;
};

type LlmEligibility = {
  needs_llm: boolean;
  llm_reason: string;
  eligibility_reason: SpecLlmEligibilityReason;
};

function hasMeaningfulSource(item: ProposedSpecItem) {
  const source = `${item.source_snippet || ""} ${item.extracted_text || ""}`.trim();
  const wordCount = source.match(/[a-z0-9]+/gi)?.length || 0;
  return source.length >= 30 && wordCount >= 5;
}

function isObviousNoise(item: ProposedSpecItem) {
  const text = `${item.title} ${item.category} ${item.extracted_text} ${item.source_snippet || ""}`.toLowerCase();

  if (/^(please note:?|note:?|general|n\/a)$/i.test(item.title.trim())) {
    return true;
  }

  return /progress payment|deposit|contract price|insurance|scaffolding|temporary works|health and safety|council fees|preliminar(?:y|ies)|site setup/.test(text) &&
    !/warranty|manual|certificate|producer statement|maintenance|product|finish|selected|builder'?s range/.test(text);
}

function estimateNeedsLlm(item: ProposedSpecItem): LlmEligibility {
  if (item.matched_existing_record && item.confidence_score >= 75) {
    return {
      needs_llm: false,
      llm_reason: "Already matched existing source-backed record.",
      eligibility_reason: "already_matched_existing_record",
    };
  }

  if (item.recommended_action === "attach_existing_task" || item.recommended_action === "attach_existing_product") {
    return {
      needs_llm: false,
      llm_reason: "Already attached to an existing record.",
      eligibility_reason: "already_attached_existing_record",
    };
  }

  if (!hasMeaningfulSource(item)) {
    return {
      needs_llm: false,
      llm_reason: "Low-information source; skipped before LLM spend.",
      eligibility_reason: "low_information_source",
    };
  }

  if (isObviousNoise(item)) {
    return {
      needs_llm: false,
      llm_reason: "Obvious note/admin/noise row; skipped before LLM spend.",
      eligibility_reason: "obvious_note_or_noise",
    };
  }

  if (item.item_type === "document" || item.recommended_action === "request_document") {
    return {
      needs_llm: true,
      llm_reason: "Deterministic source-document candidate needs LLM validity adjudication so broad admin document bundles are not saved as handover items.",
      eligibility_reason: "deterministic_source_document",
    };
  }

  if (item.recommended_action === "needs_model_code") {
    return {
      needs_llm: true,
      llm_reason: "Source-backed candidate likely needs model/code confirmation.",
      eligibility_reason: "model_or_code_candidate",
    };
  }

  if (item.recommended_action === "request_more_context") {
    return {
      needs_llm: true,
      llm_reason: "Source-backed candidate needs builder-context lane confirmation.",
      eligibility_reason: "selection_or_context_candidate",
    };
  }

  if (/builder'?s range|selected|to confirm|as per|quote|supplier|range/i.test(`${item.title} ${item.extracted_text} ${item.source_snippet || ""}`)) {
    return {
      needs_llm: true,
      llm_reason: "Source-backed selection/context candidate needs LLM review lane confirmation.",
      eligibility_reason: "selection_or_context_candidate",
    };
  }

  return {
    needs_llm: true,
    llm_reason: "Unmatched source-backed candidate needs LLM review; deterministic confidence is not a final trust signal.",
    eligibility_reason: "source_backed_unmatched_candidate",
  };
}

function estimateSpendPriority(item: ProposedSpecItem, eligibility: LlmEligibility) {
  if (!eligibility.needs_llm) return 0;

  const text = `${item.title} ${item.category} ${item.extracted_text} ${item.source_snippet || ""}`.toLowerCase();

  if (item.recommended_action === "needs_model_code" || /appliance|fixture|tapware|tap|mixer|electrical|plumbing|heating|cooling|air\s*conditioning|airconditioning|ducted|hvac|underfloor/.test(text)) {
    return 100;
  }

  if (item.recommended_action === "request_more_context" || /builder'?s range|selected|as per|quote|to confirm|tbc|tba|supplier/.test(text)) {
    return 90;
  }

  if (item.item_type === "document" || item.recommended_action === "request_document" || /producer statement|code compliance|certificate|manual|warranty|source document|ccc\b|ps\d\b/.test(text)) {
    return 85;
  }

  if (/joinery|cladding|waterproofing|structural|foundation|lining|linings|gib|membrane|roof|window|door joinery/.test(text)) {
    return 80;
  }

  if (/tile|tiling|paint|carpet|flooring|door|hardware|hinge|handle|finish|finishes/.test(text)) {
    return 70;
  }

  return 50;
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
      eligibility_reason: llmGate.eligibility_reason,
      spend_priority: estimateSpendPriority(item, llmGate),
    };
  });
}
