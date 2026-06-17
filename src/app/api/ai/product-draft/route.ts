import { NextResponse } from "next/server";

type ProductDraftRequest = {
  productName?: string;
  brand?: string;
  category?: string;
  model?: string;
  supplierUrl?: string;
  region?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as ProductDraftRequest;
  const productName = body.productName?.trim();
  const brand = body.brand?.trim();
  const region = body.region?.trim() || "New Zealand";

  if (!productName) {
    return NextResponse.json(
      { error: "productName is required for AI product lookup." },
      { status: 400 },
    );
  }

  const hasEnoughIdentity = Boolean(brand || body.model || body.supplierUrl);

  return NextResponse.json({
    product_identity: {
      canonical_name: productName,
      brand: brand || "",
      manufacturer: brand || "",
      category: body.category || "",
      model: body.model || "",
      region,
      identity_confidence: hasEnoughIdentity ? 55 : 20,
    },
    sources: [],
    warranty: {
      period: "",
      start_condition: "",
      exclusions: "",
      void_conditions: "",
      source_url: "",
    },
    maintenance: {
      requirements: "",
      frequency: "",
      cleaning_instructions: "",
      inspection_requirements: "",
      source_url: "",
    },
    special_conditions: {
      coastal_exposure: "",
      paint_or_coating: "",
      installer_requirements: "",
      owner_responsibilities: "",
    },
    confidence: {
      score: hasEnoughIdentity ? 55 : 22,
      label: hasEnoughIdentity ? "low" : "blocked",
      reasons: hasEnoughIdentity
        ? ["AI provider not connected yet.", "Product identity has partial detail."]
        : ["Product is too vague.", "Add brand, model, or supplier/manufacturer URL."],
      missing_fields: ["Official source URLs", "Warranty period", "Maintenance requirements"],
      conflicts: [],
      recommended_status: hasEnoughIdentity ? "needs_review" : "blocked",
    },
  });
}
