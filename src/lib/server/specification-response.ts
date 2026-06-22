import type { SpecExtractionCandidate } from "@/lib/ai/spec-candidates";
import type { ProposedSpecItem } from "@/lib/ai/spec-extract";
import type { SpecLlmClassifyResult } from "@/lib/ai/spec-llm";
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
};

function isDocumentContextResult(parsed: ExtractedPdf | DocumentContextResult): parsed is DocumentContextResult {
  return "provider" in parsed;
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
    ai_classifier: {
      enabled: Boolean(llmResult),
      candidate_count: candidates?.length || 0,
      needs_llm_count: candidates?.filter((candidate) => candidate.needs_llm).length || 0,
      sent_candidate_count: llmResult?.sentCandidateCount || 0,
      accepted_count: llmResult?.acceptedCount || 0,
      rejected_count: llmResult?.rejectedCount || 0,
      token_usage: llmResult?.tokenUsage || null,
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
