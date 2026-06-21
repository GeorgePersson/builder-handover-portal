import { NextResponse } from "next/server";
import { buildSpecificationProposals, getInitialExtractedItemStatus } from "@/lib/ai/spec-extract";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { extractDocumentContext } from "@/lib/server/document-context";
import { buildSpecificationExtractionResponse } from "@/lib/server/specification-response";
import { saveLocalExtraction } from "@/lib/server/local-store/specifications";
import { prepareSpecificationPdf, saveLocalUpload } from "@/lib/server/upload-utils";

export const runtime = "nodejs";

function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function isMissingReviewReasonColumn(error: { message?: string } | null) {
  return Boolean(error?.message?.includes("review_reason"));
}

function getStorageErrorMessage(error: { message?: string; name?: string; statusCode?: string | number } | null) {
  if (!error) {
    return "Unknown storage error.";
  }

  return [error.name, error.statusCode, error.message].filter(Boolean).join(" - ") || "Unknown storage error.";
}

async function uploadSpecificationPdf(storagePath: string, bytes: Buffer, contentType: string) {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createSupabaseAdminClient();
    return admin.storage.from("handover-documents").upload(storagePath, bytes, {
      contentType,
      upsert: false,
    });
  }

  const supabase = await createSupabaseServerClient();
  return supabase.storage.from("handover-documents").upload(storagePath, bytes, {
    contentType,
    upsert: false,
  });
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

  const parsed = await extractDocumentContext({
    bytes: upload.bytes,
    fileName: upload.fileName,
    mimeType: upload.type,
  });
  const proposedItems = buildSpecificationProposals(parsed.text);

  if (!hasSupabaseConfig()) {
    await saveLocalUpload(upload.storagePath, upload.bytes);
    const saved = await saveLocalExtraction({
      projectId: projectId.trim(),
      fileName: upload.fileName,
      proposedItems,
    });

    return NextResponse.json(
      buildSpecificationExtractionResponse({
        storage: "local",
        specificationId: saved.specification.id,
            savedCount: saved.extractedItems.length,
            parsed,
            proposedItems,
        file: {
          name: upload.fileName,
          size: upload.size,
        },
      }),
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { error: uploadError } = await uploadSpecificationPdf(upload.storagePath, upload.bytes, upload.type);

  if (uploadError) {
    console.error("Specification PDF storage upload failed", {
      bucket: "handover-documents",
      storagePath: upload.storagePath,
      error: getStorageErrorMessage(uploadError),
    });
    return NextResponse.json(
      {
        error: "Could not upload specification PDF.",
        detail: getStorageErrorMessage(uploadError),
      },
      { status: 500 },
    );
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
        return NextResponse.json(
          buildSpecificationExtractionResponse({
            storage: "supabase",
            specificationId: specification.id,
            savedCount: proposedItems.length,
            parsed,
            proposedItems,
            file: {
              name: upload.fileName,
              size: upload.size,
            },
          }),
        );
      }
    }

    return NextResponse.json({ error: "Could not save extracted items." }, { status: 500 });
  }

  return NextResponse.json(
    buildSpecificationExtractionResponse({
      storage: "supabase",
      specificationId: specification.id,
      savedCount: proposedItems.length,
      parsed,
      proposedItems,
      file: {
        name: upload.fileName,
        size: upload.size,
      },
    }),
  );
}
