import { NextResponse } from "next/server";
import { buildSpecificationProposals } from "@/lib/ai/spec-extract";

type SpecExtractRequest = {
  projectId?: string;
  specificationId?: string;
  fileName?: string;
  extractedText?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as SpecExtractRequest;

  if (!body.projectId && !body.specificationId) {
    return NextResponse.json(
      { error: "projectId or specificationId is required." },
      { status: 400 },
    );
  }

  const proposedItems = buildSpecificationProposals(body.extractedText || "");
  const matchedCount = proposedItems.filter((item) => item.matched_existing_record).length;
  const newCount = proposedItems.length - matchedCount;

  return NextResponse.json({
    specification: {
      id: body.specificationId || "pending",
      file_name: body.fileName || "Specification.pdf",
      extraction_status: "needs_review",
    },
    summary: {
      extracted_count: proposedItems.length,
      matched_existing_count: matchedCount,
      new_item_count: newCount,
      blocked_count: 0,
      notes: [
        body.extractedText
          ? "Generated from supplied specification text."
          : "No parsed PDF text was supplied, so the endpoint returned a low-confidence fallback.",
        "Provider-backed extraction can replace this deterministic scaffold later.",
      ],
    },
    proposed_items: proposedItems,
  });
}
