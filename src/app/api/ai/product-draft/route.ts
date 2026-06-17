import { NextResponse } from "next/server";
import { enrichManualProductDraft } from "@/lib/ai/source-enrichment";

type ProductDraftRequest = {
  productName?: string;
  brand?: string;
  category?: string;
  model?: string;
  supplierUrl?: string;
  location?: string;
  notes?: string;
  region?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as ProductDraftRequest;
  const productName = body.productName?.trim();
  const brand = body.brand?.trim();
  const supplierUrl = body.supplierUrl?.trim();
  const region = body.region?.trim() || "New Zealand";

  if (!productName) {
    return NextResponse.json(
      { error: "productName is required for AI product lookup." },
      { status: 400 },
    );
  }

  const hasEnoughIdentity = Boolean(brand || body.model || supplierUrl);
  const enrichment = enrichManualProductDraft({
    productName,
    brand,
    category: body.category?.trim(),
    model: body.model?.trim(),
    supplierUrl,
    location: body.location?.trim(),
    notes: body.notes?.trim(),
  });
  const sourceUrl = enrichment.sources[0]?.url || supplierUrl || "";
  const missingFields = hasEnoughIdentity
    ? enrichment.missingFields
    : ["Brand, model, or supplier/manufacturer URL", ...enrichment.missingFields];
  const score = hasEnoughIdentity ? enrichment.confidenceScore : 22;
  const label = hasEnoughIdentity ? enrichment.confidenceLabel : "blocked";
  const recommendedStatus = hasEnoughIdentity ? enrichment.status : "blocked";

  return NextResponse.json({
    product_identity: {
      canonical_name: productName,
      brand: enrichment.brand === "Admin approved" ? brand || "" : enrichment.brand,
      manufacturer: enrichment.manufacturer || brand || "",
      category: body.category?.trim() || "",
      model: body.model?.trim() || "",
      region,
      identity_confidence: hasEnoughIdentity ? Math.max(55, score) : 20,
    },
    sources: enrichment.sources,
    warranty: {
      period: hasEnoughIdentity ? enrichment.warrantyPeriod : "",
      start_condition: "",
      exclusions: "",
      void_conditions: hasEnoughIdentity ? enrichment.voidConditions : "",
      source_url: sourceUrl,
    },
    maintenance: {
      requirements: hasEnoughIdentity ? enrichment.maintenanceSummary : "",
      frequency: "",
      cleaning_instructions: "",
      inspection_requirements: "",
      source_url: sourceUrl,
    },
    special_conditions: {
      coastal_exposure: "",
      paint_or_coating: "",
      installer_requirements: "",
      owner_responsibilities: "",
    },
    confidence: {
      score,
      label,
      reasons: hasEnoughIdentity
        ? [
            enrichment.reviewReason,
            "Official-source search is scaffolded until provider-backed AI is connected.",
          ]
        : ["Product is too vague.", "Add brand, model, or supplier/manufacturer URL."],
      missing_fields: missingFields,
      conflicts: [],
      recommended_status: recommendedStatus,
    },
  });
}
