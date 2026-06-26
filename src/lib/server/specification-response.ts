import type { SpecExtractionCandidate } from "@/lib/ai/spec-candidates";
import type { ProposedSpecItem } from "@/lib/ai/spec-extract";
import type { FinalEvidenceCleanupResult } from "@/lib/ai/spec-final-cleanup";
import type { SpecLlmClassifyResult } from "@/lib/ai/spec-llm";
import type { SpecTextNormalizationResult } from "@/lib/ai/spec-text-normalizer";
import type { DocumentContextResult } from "@/lib/server/document-context";
import type { ExtractedPdf } from "@/lib/server/pdf-extract";

type SpecificationExtractionResponseInput = {
  parsed: ExtractedPdf | DocumentContextResult;
  proposedItems: ProposedSpecItem[];
  file: {
    name: string;
    size?: number;
  };
  storage?: "local" | "supabase";
  specificationId?: string;
  savedCount?: number;
  includeScaffoldNote?: boolean;
  candidates?: SpecExtractionCandidate[];
  llmResult?: SpecLlmClassifyResult | null;
  normalizationResult?: SpecTextNormalizationResult | null;
  finalEvidenceCleanupResult?: FinalEvidenceCleanupResult | null;
};

function isDocumentContextResult(parsed: ExtractedPdf | DocumentContextResult): parsed is DocumentContextResult {
  return "provider" in parsed;
}


function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function getRejectedValidationErrors(llmResult: SpecLlmClassifyResult | null | undefined) {
  const errors: string[] = [];
  for (const classification of llmResult?.classifications || []) {
    if (classification.accepted) continue;
    errors.push(...classification.validation_errors);
  }
  return countBy(errors);
}

function getProviderLabel(provider: DocumentContextResult["provider"]) {
  switch (provider) {
    case "llamacloud_parse":
      return "LlamaCloud";
    case "docling_local":
      return "local Docling";
    case "docling_http":
      return "Docling service";
    case "local_pdf":
    default:
      return "local PDF extraction";
  }
}

export function buildSpecificationExtractionResponse({
  parsed,
  proposedItems,
  file,
  storage,
  specificationId,
  savedCount,
  includeScaffoldNote = false,
  candidates,
  llmResult,
  normalizationResult,
  finalEvidenceCleanupResult,
}: SpecificationExtractionResponseInput) {
  const matchedCount = proposedItems.filter((item) => item.matched_existing_record).length;
  const isContext = isDocumentContextResult(parsed);
  const text = parsed.text;
  const pageCount = isContext ? parsed.diagnostics.pageCount : parsed.pages;
  const tableCount = isContext ? parsed.diagnostics.tableCount || 0 : parsed.diagnostics.tableCount;
  const chunkCount = isContext ? parsed.diagnostics.chunkCount || 1 : parsed.diagnostics.chunkCount;
  const warnings = isContext ? parsed.diagnostics.warnings : parsed.diagnostics.warnings;
  const notes = [
    isContext
      ? `Parsed with ${getProviderLabel(parsed.provider)}.`
      : `Parsed locally from ${parsed.pages} PDF page${parsed.pages === 1 ? "" : "s"}.`,
    `Prepared ${chunkCount} analysis chunk${chunkCount === 1 ? "" : "s"} and ${tableCount} table extract${tableCount === 1 ? "" : "s"}.`,
  ];

  if (includeScaffoldNote) {
    notes.push("Proposal generation is deterministic scaffold logic until provider-backed AI is connected.");
  }

  if (proposedItems.length === 0) {
    notes.push(
      llmResult
        ? "No valid handover items were found after LLM validity review. The extracted candidates were treated as non-item/admin/supporting text."
        : "No valid handover items were found in the supplied document.",
    );
  }

  return {
    ...(storage ? { storage } : {}),
    ...(specificationId ? { specification_id: specificationId } : {}),
    ...(typeof savedCount === "number" ? { saved_count: savedCount } : {}),
    file: {
      name: file.name,
      size: file.size,
      pages: pageCount,
      text_length: text.length,
    },
    text_preview: text.slice(0, 1200),
    extraction: {
      provider: isContext ? parsed.provider : "local_pdf",
      external_job_id: isContext ? parsed.diagnostics.externalJobId : undefined,
      table_count: tableCount,
      chunk_count: chunkCount,
      average_characters_per_page:
        isContext || !pageCount ? undefined : parsed.diagnostics.averageCharactersPerPage,
      ocr_page_count: isContext ? undefined : parsed.diagnostics.ocrPageCount,
      ocr_character_count: isContext ? undefined : parsed.diagnostics.ocrCharacterCount,
      warnings,
    },
    ai_text_normalizer: {
      enabled: Boolean(normalizationResult),
      input_row_count: normalizationResult?.inputRowCount || 0,
      selected_row_count: normalizationResult?.selectedRowCount || 0,
      accepted_count: normalizationResult?.acceptedCount || 0,
      rejected_count: normalizationResult?.rejectedCount || 0,
      token_usage: normalizationResult?.tokenUsage || null,
      changed_row_count: normalizationResult?.rows.filter((row) => row.accepted && row.normalized_text !== row.source_text).length || 0,
      rejected_validation_errors: countBy((normalizationResult?.rows || [])
        .filter((row) => !row.accepted)
        .flatMap((row) => row.validation_errors)),
    },
    ai_classifier: {
      enabled: Boolean(llmResult),
      candidate_count: candidates?.length || 0,
      needs_llm_count: candidates?.filter((candidate) => candidate.needs_llm).length || 0,
      sent_candidate_count: llmResult?.sentCandidateCount || 0,
      accepted_count: llmResult?.acceptedCount || 0,
      rejected_count: llmResult?.rejectedCount || 0,
      token_usage: llmResult?.tokenUsage || null,
      eligible_by_reason: countBy((candidates || [])
        .filter((candidate) => candidate.needs_llm)
        .map((candidate) => candidate.eligibility_reason)),
      skipped_by_reason: countBy((candidates || [])
        .filter((candidate) => !candidate.needs_llm)
        .map((candidate) => candidate.eligibility_reason)),
      sent_candidate_ids: llmResult?.sentCandidateIds || [],
      accepted_by_lane: countBy((llmResult?.classifications || [])
        .filter((classification) => classification.accepted)
        .map((classification) => classification.review_lane)),
      rejected_validation_errors: getRejectedValidationErrors(llmResult),
    },
    final_evidence_cleanup: {
      enabled: Boolean(finalEvidenceCleanupResult?.enabled),
      mode: finalEvidenceCleanupResult?.mode || "off",
      dirty_before_count: finalEvidenceCleanupResult?.dirtyBeforeCount || 0,
      sent_count: finalEvidenceCleanupResult?.sentCount || 0,
      accepted_count: finalEvidenceCleanupResult?.acceptedCount || 0,
      rejected_count: finalEvidenceCleanupResult?.rejectedCount || 0,
      repair_retry_sent_count: finalEvidenceCleanupResult?.repairRetrySentCount || 0,
      repair_retry_accepted_count: finalEvidenceCleanupResult?.repairRetryAcceptedCount || 0,
      llm_proofread_sent_count: finalEvidenceCleanupResult?.llmProofreadSentCount || 0,
      llm_proofread_accepted_count: finalEvidenceCleanupResult?.llmProofreadAcceptedCount || 0,
      dirty_after_count: finalEvidenceCleanupResult?.dirtyAfterCount || 0,
      token_usage: finalEvidenceCleanupResult?.tokenUsage || null,
      errors: countBy(finalEvidenceCleanupResult?.errors || []),
    },
    final_quality_audit: {
      enabled: Boolean(finalEvidenceCleanupResult?.qualityAudit?.enabled),
      checked_count: finalEvidenceCleanupResult?.qualityAudit?.checkedCount || 0,
      pass_count: finalEvidenceCleanupResult?.qualityAudit?.passCount || 0,
      needs_cleanup_count: finalEvidenceCleanupResult?.qualityAudit?.needsCleanupCount || 0,
      needs_human_review_count: finalEvidenceCleanupResult?.qualityAudit?.needsHumanReviewCount || 0,
      unresolved_quality_count: finalEvidenceCleanupResult?.unresolvedQualityCount || 0,
      issue_counts: finalEvidenceCleanupResult?.qualityAudit?.issueCounts || {},
      flagged_items: (finalEvidenceCleanupResult?.qualityAudit?.items || [])
        .filter((item) => item.status !== "pass")
        .slice(0, 20),
    },
    summary: {
      extracted_count: proposedItems.length,
      matched_existing_count: matchedCount,
      new_item_count: proposedItems.length - matchedCount,
      notes,
    },
    proposed_items: proposedItems,
  };
}
