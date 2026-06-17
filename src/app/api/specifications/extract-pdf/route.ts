import { NextResponse } from "next/server";
import { buildSpecificationProposals } from "@/lib/ai/spec-extract";
import { extractPdfText } from "@/lib/server/pdf-extract";
import { buildSpecificationExtractionResponse } from "@/lib/server/specification-response";

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
  const proposedItems = buildSpecificationProposals(parsed.text);

  return NextResponse.json(
    buildSpecificationExtractionResponse({
      parsed,
      proposedItems,
      file: {
        name: file.name,
        size: file.size,
      },
      includeScaffoldNote: true,
    }),
  );
}
