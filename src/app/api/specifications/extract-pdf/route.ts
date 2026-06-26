import { NextResponse } from "next/server";
import { buildSpecExtractionCandidates } from "@/lib/ai/spec-candidates";
import { buildSpecificationProposals } from "@/lib/ai/spec-extract";
import { maybeEnhanceSpecificationProposalsWithLlm } from "@/lib/ai/spec-llm";
import { maybeNormalizeSpecTextWithLlm } from "@/lib/ai/spec-text-normalizer";
import { cleanFinalSpecificationEvidence } from "@/lib/ai/spec-final-cleanup";
import { extractDocumentContext } from "@/lib/server/document-context";
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
  const parsed = await extractDocumentContext({
    bytes: buffer,
    fileName: file.name,
    mimeType: file.type || "application/pdf",
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
  const finalEvidenceCleanup = await cleanFinalSpecificationEvidence(llmEnhancement.proposedItems);
  const proposedItems = finalEvidenceCleanup.items;
  const { candidates, llmResult } = llmEnhancement;

  console.info("Specification preview extraction summary", {
    provider: parsed.provider,
    deterministicCount: deterministicItems.length,
    proposedCount: proposedItems.length,
    candidateCount: candidates.length,
    needsLlmCount: candidates.filter((candidate) => candidate.needs_llm).length,
    llmSentCount: llmResult?.sentCandidateCount || 0,
    llmAcceptedCount: llmResult?.acceptedCount || 0,
    llmRejectedCount: llmResult?.rejectedCount || 0,
  });

  return NextResponse.json(
    buildSpecificationExtractionResponse({
      parsed,
      proposedItems,
      candidates,
      llmResult,
      normalizationResult: normalized.normalizationResult,
      finalEvidenceCleanupResult: finalEvidenceCleanup.result,
      file: {
        name: file.name,
        size: file.size,
      },
      includeScaffoldNote: true,
    }),
  );
}
