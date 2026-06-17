import type { ProposedSpecItem } from "@/lib/ai/spec-extract";
import type { ExtractedPdf } from "@/lib/server/pdf-extract";

type SpecificationExtractionResponseInput = {
  parsed: ExtractedPdf;
  proposedItems: ProposedSpecItem[];
  file: {
    name: string;
    size?: number;
  };
  storage?: "local" | "supabase";
  specificationId?: string;
  savedCount?: number;
  includeScaffoldNote?: boolean;
};

export function buildSpecificationExtractionResponse({
  parsed,
  proposedItems,
  file,
  storage,
  specificationId,
  savedCount,
  includeScaffoldNote = false,
}: SpecificationExtractionResponseInput) {
  const matchedCount = proposedItems.filter((item) => item.matched_existing_record).length;
  const notes = [
    `Parsed locally from ${parsed.pages} PDF page${parsed.pages === 1 ? "" : "s"}.`,
    `Prepared ${parsed.chunks.length} analysis chunk${parsed.chunks.length === 1 ? "" : "s"} and ${parsed.tables.length} table extract${parsed.tables.length === 1 ? "" : "s"}.`,
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
      pages: parsed.pages,
      text_length: parsed.text.length,
    },
    text_preview: parsed.text.slice(0, 1200),
    extraction: {
      table_count: parsed.diagnostics.tableCount,
      chunk_count: parsed.diagnostics.chunkCount,
      average_characters_per_page: parsed.diagnostics.averageCharactersPerPage,
      ocr_page_count: parsed.diagnostics.ocrPageCount,
      ocr_character_count: parsed.diagnostics.ocrCharacterCount,
      warnings: parsed.diagnostics.warnings,
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
