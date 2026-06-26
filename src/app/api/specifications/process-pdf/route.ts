import { NextResponse } from "next/server";
import {
  buildSpecificationProposals,
  getInitialExtractedItemReviewReason,
  getInitialExtractedItemStatus,
  type ProposedSpecItem,
} from "@/lib/ai/spec-extract";
import { buildSpecExtractionCandidates } from "@/lib/ai/spec-candidates";
import { maybeEnhanceSpecificationProposalsWithLlm } from "@/lib/ai/spec-llm";
import { maybeNormalizeSpecTextWithLlm } from "@/lib/ai/spec-text-normalizer";
import { cleanFinalSpecificationEvidence } from "@/lib/ai/spec-final-cleanup";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildProjectHandoverChecklistItem } from "@/lib/project-handover-checklist";
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

function isUnsupportedContextStatus(error: { message?: string } | null) {
  return Boolean(error?.message?.includes("invalid input value for enum") && error.message.includes("extracted_item_status"));
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

function normalizeMatchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getStructuredField(text: string, label: string) {
  const pattern = new RegExp(`${label}:\\s*([^\\n]+)`, "i");
  return text.match(pattern)?.[1]?.trim() || "";
}

type ExistingProductMatch = {
  canonical_name: string;
  brand: string | null;
  manufacturer: string | null;
  category: string | null;
};

type SavedLegacySpecificationItem = {
  id: string;
  item_type: "product" | "document" | "maintenance";
  title: string;
  category: string | null;
  location: string | null;
  extracted_text: string | null;
  source_snippet: string | null;
  source_page: number | null;
  review_reason: string | null;
  matched_existing_record: string | null;
  confidence_score: number;
  status: string;
};

type LegacyChecklistPayload = ReturnType<typeof getChecklistInsertPayload> & {
  legacy_extracted_handover_item_id?: string;
  updated_at: string;
};

function getChecklistInsertPayload(item: ReturnType<typeof buildProjectHandoverChecklistItem>) {
  return {
    project_id: item.projectId,
    source_document_id: item.sourceDocumentId || null,
    extraction_job_id: item.extractionJobId || null,
    title: item.title,
    category: item.category || null,
    brand: item.brand || null,
    manufacturer: item.manufacturer || null,
    model: item.model || null,
    sku: item.sku || null,
    product_code: item.productCode || null,
    supplier: item.supplier || null,
    supplier_sku: item.supplierSku || null,
    care_instructions: item.careInstructions || null,
    manual_document_id: item.manualDocumentId || null,
    manual_url: item.manualUrl || null,
    warranty_information: item.warrantyInformation || null,
    warranty_document_id: item.warrantyDocumentId || null,
    warranty_guidance_is_general: item.warrantyGuidanceIsGeneral || false,
    invoice_document_id: item.invoiceDocumentId || null,
    invoice_data: item.invoiceData || null,
    code_compliance_document_id: item.codeComplianceDocumentId || null,
    code_compliance_information: item.codeComplianceInformation || null,
    supporting_document_ids: item.supportingDocumentIds,
    extra_notes: item.extraNotes || null,
    section_statuses: item.sectionStatuses,
    value_sources: item.valueSources,
    source_metadata: item.sourceMetadata,
    status: item.status,
    completion_summary: item.completionSummary || null,
    accepted_incomplete_reason: item.acceptedIncompleteReason || null,
    accepted_incomplete_at: item.acceptedIncompleteAt || null,
    accepted_incomplete_by: item.acceptedIncompleteBy || null,
    created_by: item.createdBy || null,
    last_edited_by: item.lastEditedBy || null,
  };
}

function buildLegacyChecklistPayload(input: {
  projectId: string;
  specificationId: string;
  actorId: string;
  item: SavedLegacySpecificationItem;
}): LegacyChecklistPayload {
  const text = input.item.extracted_text || "";
  const sourceSnippet = input.item.source_snippet || text;
  const manufacturer = getStructuredField(text, "Manufacturer/Supplier") || getStructuredField(text, "Manufacturer");
  const model = getStructuredField(text, "Model");
  const productCode = getStructuredField(text, "ProductCode") || getStructuredField(text, "Product Code");
  const supplier = getStructuredField(text, "Supplier") || manufacturer;
  const variantOrFinish = getStructuredField(text, "Finish") || getStructuredField(text, "Colour") || getStructuredField(text, "Size");
  const careInstructions = input.item.item_type === "maintenance" ? text : undefined;
  const warrantyInformation = /warranty/i.test(`${input.item.title} ${input.item.category} ${text}`) ? text : undefined;
  const sectionStatuses = {
    careInstructions: careInstructions ? ("autofilled_needs_review" as const) : ("missing" as const),
    manual: "missing" as const,
    warranty: warrantyInformation ? ("autofilled_needs_review" as const) : ("missing" as const),
    invoice: /quote|invoice/i.test(`${input.item.review_reason || ""} ${text}`)
      ? ("autofilled_needs_review" as const)
      : ("not_required" as const),
    codeCompliance: /code compliance|certificate/i.test(`${input.item.title} ${text}`)
      ? ("autofilled_needs_review" as const)
      : ("not_required" as const),
    supportingDocuments: "missing" as const,
  };
  const notes = [
    input.item.location ? `Location: ${input.item.location}` : null,
    variantOrFinish ? `Variant/finish: ${variantOrFinish}` : null,
    input.item.source_page ? `Source page: ${input.item.source_page}` : null,
    sourceSnippet ? `Evidence: ${sourceSnippet}` : null,
    input.item.review_reason ? `Extraction review note: ${input.item.review_reason}` : null,
  ].filter(Boolean).join("\n");

  const checklist = buildProjectHandoverChecklistItem({
    projectId: input.projectId,
    title: input.item.title,
    category: input.item.category || undefined,
    manufacturer: manufacturer || undefined,
    brand: manufacturer || undefined,
    model: model || undefined,
    productCode: productCode || undefined,
    supplier: supplier || undefined,
    careInstructions,
    warrantyInformation,
    extraNotes: notes || undefined,
    sectionStatuses,
    valueSources: ["extracted_document"],
    sourceMetadata: {
      legacy_extracted_handover_item_id: input.item.id,
      specification_upload_id: input.specificationId,
      source_page: input.item.source_page,
      source_snippet: sourceSnippet,
      review_reason: input.item.review_reason,
      review_status: input.item.status,
      matched_existing_record: input.item.matched_existing_record,
      confidence_score: input.item.confidence_score,
      legacy_source: "extracted_handover_items",
    },
  }, {
    id: `checklist-from-legacy-${input.item.id}`,
    actorId: input.actorId,
  });

  return {
    ...getChecklistInsertPayload(checklist),
    legacy_extracted_handover_item_id: input.item.id,
    updated_at: new Date().toISOString(),
  };
}

function isMissingLegacyChecklistColumn(error: { message?: string } | null) {
  return Boolean(error?.message?.includes("legacy_extracted_handover_item_id"));
}

async function syncLegacySpecificationItemsToChecklist(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  projectId: string;
  specificationId: string;
  actorId: string;
  items: SavedLegacySpecificationItem[];
}) {
  const payload = input.items
    .filter((item) => item.item_type !== "document" && item.status !== "excluded")
    .map((item) => buildLegacyChecklistPayload({
      projectId: input.projectId,
      specificationId: input.specificationId,
      actorId: input.actorId,
      item,
    }));

  if (payload.length === 0) {
    return { upsertedCount: 0 };
  }

  let result = await input.supabase
    .from("project_handover_checklist_items")
    .upsert(payload, { onConflict: "legacy_extracted_handover_item_id" })
    .select("id,project_id,legacy_extracted_handover_item_id,status");

  if (result.error && isMissingLegacyChecklistColumn(result.error)) {
    const fallbackPayload = payload.map((entry) => {
      const { legacy_extracted_handover_item_id: _ignoredLegacyId, ...item } = entry;
      void _ignoredLegacyId;
      return item;
    });
    result = await input.supabase
      .from("project_handover_checklist_items")
      .insert(fallbackPayload)
      .select("id,project_id,status,source_metadata");
  }

  if (result.error) {
    console.warn("Legacy specification checklist sync failed", { error: result.error.message });
    return { upsertedCount: 0, skippedReason: result.error.message };
  }

  const eventRows = (result.data || []).map((row) => {
    const metadata = "source_metadata" in row && typeof row.source_metadata === "object" && row.source_metadata
      ? row.source_metadata as { legacy_extracted_handover_item_id?: string }
      : {};

    return {
      project_id: row.project_id,
      checklist_item_id: row.id,
      event_type: "created",
      actor_id: input.actorId,
      notes: "Checklist item synced from legacy specification extraction.",
      metadata: {
        legacy_extracted_handover_item_id:
          "legacy_extracted_handover_item_id" in row
            ? row.legacy_extracted_handover_item_id
            : metadata.legacy_extracted_handover_item_id,
        status: row.status,
        source: "legacy_extracted_handover_items",
      },
    };
  });

  if (eventRows.length > 0) {
    await input.supabase.from("project_handover_checklist_events").insert(eventRows);
  }

  return { upsertedCount: result.data?.length || 0 };
}


function itemMatchesExistingProduct(item: ProposedSpecItem, product: ExistingProductMatch) {
  const title = normalizeMatchText(item.title);
  const text = normalizeMatchText(`${item.title} ${item.extracted_text} ${item.source_snippet || ""}`);
  const canonical = normalizeMatchText(product.canonical_name);
  const brand = normalizeMatchText(product.brand || product.manufacturer || "");
  const extractedManufacturer = normalizeMatchText(getStructuredField(item.extracted_text, "Manufacturer/Supplier"));

  if (!canonical || !text.includes(canonical)) {
    return false;
  }

  if (brand && extractedManufacturer && !extractedManufacturer.includes(brand) && !brand.includes(extractedManufacturer)) {
    return false;
  }

  return title.includes(canonical.split(" ")[0]) || text.includes(canonical);
}

async function applyExistingProductMatches(proposedItems: ProposedSpecItem[]) {
  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseAdminClient()
    : await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("canonical_name,brand,manufacturer,category")
    .limit(100);

  if (error || !data?.length) {
    if (error) {
      console.warn("Existing product match lookup failed", { error: error.message });
    }
    return proposedItems;
  }

  return proposedItems.map((item) => {
    if (item.matched_existing_record || item.item_type !== "product") {
      return item;
    }

    const match = (data as ExistingProductMatch[]).find((product) => itemMatchesExistingProduct(item, product));
    if (!match) {
      return item;
    }

    return {
      ...item,
      matched_existing_record: match.canonical_name,
      confidence_score: Math.max(item.confidence_score, 90),
      recommended_action: "attach_existing_product" as const,
      category: match.category || item.category,
    };
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

  let supabaseForPersistence: Awaited<ReturnType<typeof createSupabaseServerClient>> | null = null;
  let authenticatedUser: { id: string } | null = null;

  if (hasSupabaseConfig()) {
    supabaseForPersistence = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabaseForPersistence.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    authenticatedUser = user;
  }

  const parsed = await extractDocumentContext({
    bytes: upload.bytes,
    fileName: upload.fileName,
    mimeType: upload.type,
  });
  const normalized = await maybeNormalizeSpecTextWithLlm(parsed.text).catch((error) => {
    console.warn("Spec text normalizer failed; falling back to raw parsed text", error);
    return { text: parsed.text, normalizationResult: null };
  });
  const deterministicItems = buildSpecificationProposals(normalized.text);
  const llmEnhancement = await maybeEnhanceSpecificationProposalsWithLlm(deterministicItems).catch((error) => {
    console.warn("Spec LLM classifier failed; falling back to deterministic extraction", error);
    return { proposedItems: deterministicItems, candidates: buildSpecExtractionCandidates(deterministicItems), llmResult: null };
  });
  let proposedItems = llmEnhancement.proposedItems;
  const finalEvidenceCleanup = await cleanFinalSpecificationEvidence(proposedItems);
  proposedItems = finalEvidenceCleanup.items;
  const { candidates, llmResult } = llmEnhancement;

  console.info("Specification process extraction summary", {
    provider: parsed.provider,
    deterministicCount: deterministicItems.length,
    proposedCount: proposedItems.length,
    candidateCount: candidates.length,
    needsLlmCount: candidates.filter((candidate) => candidate.needs_llm).length,
    llmSentCount: llmResult?.sentCandidateCount || 0,
    llmAcceptedCount: llmResult?.acceptedCount || 0,
    llmRejectedCount: llmResult?.rejectedCount || 0,
    textNormalizerEnabled: Boolean(normalized.normalizationResult),
    textNormalizerSelectedCount: normalized.normalizationResult?.selectedRowCount || 0,
    textNormalizerAcceptedCount: normalized.normalizationResult?.acceptedCount || 0,
    textNormalizerRejectedCount: normalized.normalizationResult?.rejectedCount || 0,
    finalDirtyOcrBeforeCleanupCount: finalEvidenceCleanup.result.dirtyBeforeCount,
    finalDirtyOcrAfterCleanupCount: finalEvidenceCleanup.result.dirtyAfterCount,
    finalEvidenceCleanupEnabled: finalEvidenceCleanup.result.enabled,
    finalEvidenceCleanupSentCount: finalEvidenceCleanup.result.sentCount,
    finalEvidenceCleanupAcceptedCount: finalEvidenceCleanup.result.acceptedCount,
    finalEvidenceCleanupRejectedCount: finalEvidenceCleanup.result.rejectedCount,
    finalEvidenceCleanupRepairRetrySentCount: finalEvidenceCleanup.result.repairRetrySentCount,
    finalEvidenceCleanupRepairRetryAcceptedCount: finalEvidenceCleanup.result.repairRetryAcceptedCount,
    finalEvidenceCleanupLlmProofreadSentCount: finalEvidenceCleanup.result.llmProofreadSentCount,
    finalEvidenceCleanupLlmProofreadAcceptedCount: finalEvidenceCleanup.result.llmProofreadAcceptedCount,
    finalQualityUnresolvedCount: finalEvidenceCleanup.result.unresolvedQualityCount,
  });

  if (proposedItems.length === 0) {
    return NextResponse.json(
      buildSpecificationExtractionResponse({
        parsed,
        proposedItems,
        candidates,
        llmResult,
        normalizationResult: normalized.normalizationResult,
        finalEvidenceCleanupResult: finalEvidenceCleanup.result,
        savedCount: 0,
        file: {
          name: upload.fileName,
          size: upload.size,
        },
      }),
    );
  }

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
            candidates,
            llmResult,
            normalizationResult: normalized.normalizationResult,
            finalEvidenceCleanupResult: finalEvidenceCleanup.result,
        file: {
          name: upload.fileName,
          size: upload.size,
        },
      }),
    );
  }

  const supabase = supabaseForPersistence;
  const user = authenticatedUser;

  if (!supabase || !user) {
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

  proposedItems = await applyExistingProductMatches(proposedItems);

  const itemRows = proposedItems.map((item) => ({
    specification_upload_id: specification.id,
    item_type: item.item_type,
    title: item.title,
    category: item.category,
    location: item.location,
    extracted_text: item.extracted_text,
    source_snippet: item.source_snippet || item.extracted_text,
    source_page: item.source_page || null,
    review_reason: getInitialExtractedItemReviewReason(item),
    matched_existing_record: item.matched_existing_record,
    confidence_score: item.confidence_score,
    status: getInitialExtractedItemStatus(item),
  }));
  const legacyItemSelect = "id,item_type,title,category,location,extracted_text,source_snippet,source_page,review_reason,matched_existing_record,confidence_score,status";
  const { data: savedItems, error: itemsError } = await supabase
    .from("extracted_handover_items")
    .insert(itemRows)
    .select(legacyItemSelect);

  if (itemsError) {
    if (isMissingReviewReasonColumn(itemsError) || isUnsupportedContextStatus(itemsError)) {
      const legacyRows = itemRows.map((item) => ({
        specification_upload_id: item.specification_upload_id,
        item_type: item.item_type,
        title: item.title,
        category: item.category,
        location: item.location,
        extracted_text: item.extracted_text,
        source_snippet: item.source_snippet,
        source_page: item.source_page,
        review_reason: isMissingReviewReasonColumn(itemsError) ? undefined : item.review_reason,
        matched_existing_record: item.matched_existing_record,
        confidence_score: item.confidence_score,
        status: item.status === "auto_approved" ? "auto_approved" : "admin_review",
      }));
      const { data: legacySavedItems, error: legacyItemsError } = await supabase.from("extracted_handover_items").insert(legacyRows).select(legacyItemSelect);

      if (!legacyItemsError) {
        const checklistSync = await syncLegacySpecificationItemsToChecklist({
          supabase,
          projectId: projectId.trim(),
          specificationId: specification.id,
          actorId: user.id,
          items: (legacySavedItems || []) as SavedLegacySpecificationItem[],
        });
        console.info("Legacy specification checklist sync", checklistSync);

        return NextResponse.json(
          buildSpecificationExtractionResponse({
            storage: "supabase",
            specificationId: specification.id,
            savedCount: proposedItems.length,
            parsed,
            proposedItems,
            candidates,
            llmResult,
            normalizationResult: normalized.normalizationResult,
            finalEvidenceCleanupResult: finalEvidenceCleanup.result,
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

  const checklistSync = await syncLegacySpecificationItemsToChecklist({
    supabase,
    projectId: projectId.trim(),
    specificationId: specification.id,
    actorId: user.id,
    items: (savedItems || []) as SavedLegacySpecificationItem[],
  });
  console.info("Legacy specification checklist sync", checklistSync);

  return NextResponse.json(
    buildSpecificationExtractionResponse({
      storage: "supabase",
      specificationId: specification.id,
      savedCount: proposedItems.length,
      parsed,
      proposedItems,
      candidates,
      llmResult,
      normalizationResult: normalized.normalizationResult,
      finalEvidenceCleanupResult: finalEvidenceCleanup.result,
      file: {
        name: upload.fileName,
        size: upload.size,
      },
    }),
  );
}
