import { NextResponse } from "next/server";
import { buildSpecificationProposals } from "@/lib/ai/spec-extract";
import { extractPdfText } from "@/lib/server/pdf-extract";

export const runtime = "nodejs";

const maxPdfSizeBytes = 30 * 1024 * 1024;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("specificationPdf");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "A specification PDF is required." }, { status: 400 });
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files can be extracted." }, { status: 400 });
  }

  if (file.size > maxPdfSizeBytes) {
    return NextResponse.json({ error: "PDF must be 30 MB or smaller." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await extractPdfText(buffer);
  const extractedText = parsed.text;
  const proposedItems = buildSpecificationProposals(extractedText);
  const matchedCount = proposedItems.filter((item) => item.matched_existing_record).length;

  return NextResponse.json({
    file: {
      name: file.name,
      size: file.size,
      pages: parsed.pages,
      text_length: extractedText.length,
    },
    text_preview: extractedText.slice(0, 1200),
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
      notes: [
        `Parsed locally from ${parsed.pages} PDF page${parsed.pages === 1 ? "" : "s"}.`,
        `Prepared ${parsed.chunks.length} analysis chunk${parsed.chunks.length === 1 ? "" : "s"} and ${parsed.tables.length} table extract${parsed.tables.length === 1 ? "" : "s"}.`,
        "Proposal generation is deterministic scaffold logic until provider-backed AI is connected.",
      ],
    },
    proposed_items: proposedItems,
  });
}
