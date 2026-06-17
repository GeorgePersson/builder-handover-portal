import { NextResponse } from "next/server";
import { getInitialExtractedItemStatus } from "@/lib/ai/spec-extract";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveLocalExtraction } from "@/lib/server/local-store/specifications";

type SaveExtractionRequest = {
  projectId?: string;
  fileName?: string;
  proposedItems?: Array<{
    item_type: "product" | "document" | "maintenance";
    title: string;
    category: string;
    location: string;
    extracted_text: string;
    matched_existing_record: string | null;
    confidence_score: number;
  }>;
};

function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function isMissingReviewReasonColumn(error: { message?: string } | null) {
  return Boolean(error?.message?.includes("review_reason"));
}

export async function POST(request: Request) {
  const body = (await request.json()) as SaveExtractionRequest;

  if (!body.projectId || !body.fileName || !body.proposedItems?.length) {
    return NextResponse.json(
      { error: "projectId, fileName, and proposedItems are required." },
      { status: 400 },
    );
  }

  if (!hasSupabaseConfig()) {
    const saved = await saveLocalExtraction({
      projectId: body.projectId,
      fileName: body.fileName,
      proposedItems: body.proposedItems,
    });

    return NextResponse.json({
      storage: "local",
      specification_id: saved.specification.id,
      saved_count: saved.extractedItems.length,
    });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: specification, error: specificationError } = await supabase
    .from("specification_uploads")
    .insert({
      project_id: body.projectId,
      uploaded_by: user.id,
      file_name: body.fileName,
      storage_path: `preview/${Date.now()}-${body.fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}`,
      status: "needs_review",
    })
    .select("id")
    .single();

  if (specificationError || !specification) {
    return NextResponse.json({ error: "Could not save specification." }, { status: 500 });
  }

  const itemRows = body.proposedItems.map((item) => ({
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
          saved_count: body.proposedItems.length,
        });
      }
    }

    return NextResponse.json({ error: "Could not save extracted items." }, { status: 500 });
  }

  return NextResponse.json({
    storage: "supabase",
    specification_id: specification.id,
    saved_count: body.proposedItems.length,
  });
}
