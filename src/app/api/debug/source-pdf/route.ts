import { NextResponse } from "next/server";

import { downloadAndInspectSourcePdf } from "@/lib/server/source-pdf";

type SourcePdfDebugRequest = {
  url?: unknown;
  productName?: unknown;
  brand?: unknown;
  manufacturer?: unknown;
  model?: unknown;
};

function getOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function POST(request: Request) {
  if (process.env.ENABLE_DEBUG_COST_TESTS !== "true") {
    return NextResponse.json(
      { error: "Debug source PDF inspection is disabled. Set ENABLE_DEBUG_COST_TESTS=true locally to use this route." },
      { status: 404 },
    );
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Debug source PDF inspection is not available in production." },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => ({})) as SourcePdfDebugRequest;
  const url = typeof body.url === "string" ? body.url.trim() : "";

  if (!url) {
    return NextResponse.json({ error: "Provide a source PDF URL." }, { status: 400 });
  }

  try {
    const source = await downloadAndInspectSourcePdf(url, {
      identityHints: {
        productName: getOptionalString(body.productName),
        brand: getOptionalString(body.brand),
        manufacturer: getOptionalString(body.manufacturer),
        model: getOptionalString(body.model),
      },
    });
    return NextResponse.json({ source });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Source PDF inspection failed." },
      { status: 400 },
    );
  }
}
