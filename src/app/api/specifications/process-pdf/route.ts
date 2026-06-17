import { NextResponse } from "next/server";
import { buildSpecificationProposals, getInitialExtractedItemStatus } from "@/lib/ai/spec-extract";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractPdfText } from "@/lib/server/pdf-extract";
import { saveLocalExtraction } from "@/lib/server/local-store/specifications";
import { prepareSpecificationPdf, saveLocalUpload } from "@/lib/server/upload-utils";

export const runtime = "nodejs";

function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function isMissingReviewReasonColumn(error: { message?: string } | null) {
  return Boolean(error?.message?.includes("review_reason"));
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const projectId = formData.get("projectId");

  if (typeof projectId !== "string" || projectId.trim().length === 0) {
    return NextResponse.json({ error: "projectId is required." }, { status: 400 });
  }

  const upload = await prepareSpecificationPdf(formData);

  if (!upload) {
    return NextResponse.json({ error: "Choose a specification PDF first." }, { status: 400 });
  }

  const parsed = await extractPdfText(upload.bytes);
  const proposedItems = buildSpecificationProposals(parsed.text);
  const matchedCount = proposedItems.filter((item) => item.matched_existing_record).length;

  if (!hasSupabaseConfig()) {
    await saveLocalUpload(upload.storagePath, upload.bytes);
    const saved = await saveLocalExtraction({
      projectId: projectId.trim(),
      fileName: upload.fileName,
      proposedItems,
    });

    return NextResponse.json({
      storage: "local",
      specification_id: saved.specification.id,
      saved_count: saved.extractedItems.length,
      file: {
        name: upload.fileName,
        size: upload.size,
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
        notes: [
          `Parsed locally from ${parsed.pages} PDF page${parsed.pages === 1 ? "" : "s"}.`,
          `Prepared ${parsed.chunks.length} analysis chunk${parsed.chunks.length === 1 ? "" : "s"} and ${parsed.tables.length} table extract${parsed.tables.length === 1 ? "" : "s"}.`,
        ],
      },
      proposed_items: proposedItems,
    });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { error: uploadError } = await supabase.storage
    .from("handover-documents")
    .upload(upload.storagePath, upload.bytes, {
      contentType: upload.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: "Could not upload specification PDF." }, { status: 500 });
  }

  const { data: specification, error: specificationError } = await supabase
    .from("specification_uploads")
    .insert({
      project_id: projectId.trim(),
      uploaded_by: user.id,
      file_name: upload.fileName,
      storage_path: upload.storagePath,
      status: "needs_review",
    })
    .select("id")
    .single();

  if (specificationError || !specification) {
    return NextResponse.json({ error: "Could not save specification." }, { status: 500 });
  }

  const itemRows = proposedItems.map((item) => ({
      specification_upload_id: specification.id,
      item_type: item.item_type,
      title: item.title,
      category: item.category,
      location: item.location,
      extracted_text: item.extracted_text,
      review_reason: item.matched_existing_record
        ? `Matched existing record ${item.matched_existing_record}.`
        : "Needs review because no reusable source-backed record matched this extracted item.",
      matched_existing_record: item.matched_existing_record,
      confidence_score: item.confidence_score,
      status: getInitialExtractedItemStatus(item),
    }));
  const { error: itemsError } = await supabase.from("extracted_handover_items").insert(itemRows);

  if (itemsError) {
    if (isMissingReviewReasonColumn(itemsError)) {
      const legacyRows = itemRows.map((item) => ({
        specification_upload_id: item.specification_upload_id,
        item_type: item.item_type,
        title: item.title,
        category: item.category,
        location: item.location,
        extracted_text: item.extracted_text,
        matched_existing_record: item.matched_existing_record,
        confidence_score: item.confidence_score,
        status: item.status,
      }));
      const { error: legacyItemsError } = await supabase.from("extracted_handover_items").insert(legacyRows);

      if (!legacyItemsError) {
        return NextResponse.json({
          storage: "supabase",
          specification_id: specification.id,
          saved_count: proposedItems.length,
          file: {
            name: upload.fileName,
            size: upload.size,
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
            notes: [
              `Parsed locally from ${parsed.pages} PDF page${parsed.pages === 1 ? "" : "s"}.`,
              `Prepared ${parsed.chunks.length} analysis chunk${parsed.chunks.length === 1 ? "" : "s"} and ${parsed.tables.length} table extract${parsed.tables.length === 1 ? "" : "s"}.`,
            ],
          },
          proposed_items: proposedItems,
        });
      }
    }

    return NextResponse.json({ error: "Could not save extracted items." }, { status: 500 });
  }

  return NextResponse.json({
    storage: "supabase",
    specification_id: specification.id,
    saved_count: proposedItems.length,
    file: {
      name: upload.fileName,
      size: upload.size,
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
      notes: [
        `Parsed locally from ${parsed.pages} PDF page${parsed.pages === 1 ? "" : "s"}.`,
        `Prepared ${parsed.chunks.length} analysis chunk${parsed.chunks.length === 1 ? "" : "s"} and ${parsed.tables.length} table extract${parsed.tables.length === 1 ? "" : "s"}.`,
      ],
    },
    proposed_items: proposedItems,
  });
}
