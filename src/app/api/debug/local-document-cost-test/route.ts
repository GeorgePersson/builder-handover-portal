import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { runDocumentExtraction, extractDocumentText } from "@/lib/server/document-extraction";
import { buildExtractionUsageMetrics } from "@/lib/server/extraction-usage";
import {
  buildSourceEnrichmentUsageSummary,
  enrichCandidateWithSources,
  getSourceEnrichmentCandidateBreakdown,
  type SourceEnrichmentResult,
} from "@/lib/server/source-enrichment-cost";

type LocalDocumentCostRequest = {
  filePath?: unknown;
  ocrMaxPages?: unknown;
  runSourceEnrichment?: unknown;
  maxUniqueItems?: unknown;
  startAtUniqueItem?: unknown;
  inspectPdfSources?: unknown;
  summarizePdfSources?: unknown;
  searchContextSize?: unknown;
};

const maxLocalFileBytes = 50 * 1024 * 1024;
const extractionRetryCount = 2;

function formatNzDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoDate));
}

function getNumber(value: unknown, fallback: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.min(max, Math.max(0, Math.round(parsed)));
}

function getSearchContextSize(value: unknown): "low" | "medium" | "high" {
  return value === "medium" || value === "high" ? value : "low";
}

function validateLocalPath(rawPath: unknown) {
  if (typeof rawPath !== "string" || !rawPath.trim()) {
    throw new Error("Provide filePath for the local document benchmark.");
  }

  const resolved = path.resolve(rawPath.trim());
  const allowedRoots = [
    path.resolve(/*turbopackIgnore: true*/ process.cwd()),
    path.resolve(process.env.USERPROFILE || "", "Downloads"),
  ];

  if (!allowedRoots.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`))) {
    throw new Error("filePath must be inside the workspace or your Downloads folder.");
  }

  return resolved;
}

function getMimeType(filePath: string) {
  const lower = filePath.toLowerCase();

  if (lower.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (lower.endsWith(".csv")) {
    return "text/csv";
  }

  return "application/octet-stream";
}

function getFileType(filePath: string) {
  return path.extname(filePath).replace(".", "").toLowerCase() || "document";
}

function buildTestingLogTemplate(input: {
  startedAt: string;
  filePath: string;
  extractionMetrics?: ReturnType<typeof buildExtractionUsageMetrics>;
  totalUniqueIdentityCount?: number;
  sourceEnrichableUniqueIdentityCount?: number;
  enrichedUniqueIdentityCount?: number;
  sourceSummary?: ReturnType<typeof buildSourceEnrichmentUsageSummary>;
  error?: string;
}) {
  const extraction = input.extractionMetrics;
  const source = input.sourceSummary;

  return [
    "Real local document cost test",
    `Date: ${formatNzDate(input.startedAt)}`,
    `Input file: ${input.filePath}`,
    `Extraction model: ${extraction?.model || ""}`,
    `Rows extracted: ${extraction?.extractedRowCount ?? ""}`,
    `Unique identities: ${input.totalUniqueIdentityCount ?? ""}`,
    `Duplicate identities: ${extraction?.duplicateIdentityCount ?? ""}`,
    `Source-enrichable unique identities: ${input.sourceEnrichableUniqueIdentityCount ?? ""}`,
    `Extraction calls: ${extraction?.openAiRequestCount ?? ""}`,
    `Extraction input tokens: ${extraction?.openAiInputTokens ?? ""}`,
    `Extraction output tokens: ${extraction?.openAiOutputTokens ?? ""}`,
    `Extraction total tokens: ${extraction?.openAiTotalTokens ?? ""}`,
    `Document text characters: ${extraction?.documentTextCharacters ?? ""}`,
    `Redacted text characters: ${extraction?.redactedTextCharacters ?? ""}`,
    `Redaction replacements: ${extraction?.redaction?.totalReplacementCount ?? ""}`,
    `Source identities enriched: ${input.enrichedUniqueIdentityCount ?? ""}`,
    `Web search calls: ${source?.webSearchCallCount ?? ""}`,
    `Source PDFs inspected: ${source?.sourcePdfInspectionCount ?? ""}`,
    `Source PDF failures: ${source?.sourcePdfInspectionFailureCount ?? ""}`,
    `Source PDF summary calls: ${source?.pdfSummaryCallCount ?? ""}`,
    `Source enrichment input tokens: ${source?.inputTokens ?? ""}`,
    `Source enrichment output tokens: ${source?.outputTokens ?? ""}`,
    `Source enrichment total tokens: ${source?.totalTokens ?? ""}`,
    `Elapsed extraction ms: ${extraction?.durationMs ?? ""}`,
    `Elapsed source ms: ${source?.durationMs ?? ""}`,
    `Notes: ${input.error ? `Failed: ${input.error}` : ""}`,
  ].join("\n");
}

async function runLocalExtractionWithRetry(input: Parameters<typeof runDocumentExtraction>[0]) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= extractionRetryCount; attempt += 1) {
    try {
      return await runDocumentExtraction(input);
    } catch (error) {
      lastError = error;

      if (attempt < extractionRetryCount) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

export async function POST(request: Request) {
  if (process.env.ENABLE_DEBUG_COST_TESTS !== "true") {
    return NextResponse.json(
      { error: "Local document cost tests are disabled. Set ENABLE_DEBUG_COST_TESTS=true locally." },
      { status: 404 },
    );
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Local document cost tests are not available in production." }, { status: 404 });
  }

  const startedAt = new Date().toISOString();
  const body = await request.json().catch(() => ({})) as LocalDocumentCostRequest;
  let filePath = "";
  const previousOcrMaxPages = process.env.PDF_OCR_MAX_PAGES;

  try {
    filePath = validateLocalPath(body.filePath);
    const fileStats = await stat(/*turbopackIgnore: true*/ filePath);

    if (fileStats.size > maxLocalFileBytes) {
      throw new Error("Local document benchmark file is larger than the 50 MB debug limit.");
    }

    const requestedOcrMaxPages = getNumber(body.ocrMaxPages, 3, 40);
    process.env.PDF_OCR_MAX_PAGES = String(requestedOcrMaxPages);

    const bytes = await readFile(/*turbopackIgnore: true*/ filePath);
    const originalFilename = path.basename(filePath);
    const mimeType = getMimeType(filePath);
    const fileType = getFileType(filePath);
    const extractedText = await extractDocumentText({
      bytes,
      fileName: originalFilename,
      mimeType,
      fileType,
    });
    const extraction = await runLocalExtractionWithRetry({
      jobId: "debug-local-document-cost-test",
      document: {
        id: "debug-local-document",
        projectId: "debug-project",
        originalFilename,
        fileType,
        mimeType,
      },
      documentText: extractedText.text,
    });
    const extractionCompletedAt = new Date().toISOString();
    const extractionMetrics = buildExtractionUsageMetrics({
      items: extraction.items,
      extractor: extraction.extractor,
      model: extraction.model,
      tokenUsage: extraction.tokenUsage,
      openAiRequestCount: extraction.requestCount,
      startedAt,
      completedAt: extractionCompletedAt,
      documentTextCharacters: extractedText.text.length,
      redactedTextCharacters: extraction.redactedDocumentTextLength,
      redaction: extraction.redaction,
    });
    const candidateBreakdown = getSourceEnrichmentCandidateBreakdown(extraction.items);
    const candidates = candidateBreakdown.candidates;
    const runSourceEnrichment = body.runSourceEnrichment === true;
    let sourceSummary: ReturnType<typeof buildSourceEnrichmentUsageSummary> | undefined;
    let selectedCandidateCount = 0;
    let sampleResults: SourceEnrichmentResult[] = [];

    if (runSourceEnrichment) {
      const apiKey = process.env.OPENAI_API_KEY;

      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is required when runSourceEnrichment=true.");
      }

      const maxUniqueItems = getNumber(body.maxUniqueItems, 5, 40);
      const startAtUniqueItem = getNumber(body.startAtUniqueItem, 0, 1000);
      const selectedCandidates = candidates.slice(startAtUniqueItem, startAtUniqueItem + maxUniqueItems);
      const sourceStartedAt = new Date().toISOString();
      const results: SourceEnrichmentResult[] = [];

      for (const candidate of selectedCandidates) {
        try {
          results.push(await enrichCandidateWithSources({
            apiKey,
            model: process.env.OPENAI_SOURCE_ENRICHMENT_MODEL || process.env.OPENAI_EXTRACTION_MODEL || "gpt-5.4-mini",
            candidate,
            inspectPdfSources: body.inspectPdfSources !== false,
            summarizePdfSources: body.summarizePdfSources === true,
            searchContextSize: getSearchContextSize(body.searchContextSize),
          }));
        } catch (error) {
          results.push({
            candidate,
            status: "failed",
            error: error instanceof Error ? error.message : "Source enrichment failed.",
            officialSourceUrls: [],
            directPdfUrls: [],
            webSearchCallCount: 0,
            tokenUsage: {},
            pdfSummaryCallCount: 0,
            pdfSummaryTokenUsage: {},
            pdfSummaries: [],
            pdfInspections: [],
          });
        }
      }

      selectedCandidateCount = selectedCandidates.length;
      sourceSummary = buildSourceEnrichmentUsageSummary({
        model: process.env.OPENAI_SOURCE_ENRICHMENT_MODEL || process.env.OPENAI_EXTRACTION_MODEL || "gpt-5.4-mini",
        results,
        startedAt: sourceStartedAt,
        completedAt: new Date().toISOString(),
      });
      sampleResults = results.slice(0, 5);
    }

    return NextResponse.json({
      file: {
        path: filePath,
        originalFilename,
        sizeBytes: fileStats.size,
        mimeType,
        fileType,
      },
      options: {
        ocrMaxPages: requestedOcrMaxPages,
        runSourceEnrichment,
      },
      textExtraction: extractedText.metadata,
      extractionMetrics,
      totalUniqueIdentityCount: extractionMetrics.uniqueIdentityCount,
      sourceEnrichableUniqueIdentityCount: candidates.length,
      sourceCandidateBreakdown: {
        countsByClassification: candidateBreakdown.countsByClassification,
        sourceCandidateSample: candidates.slice(0, 20),
        rejectedSample: candidateBreakdown.rejected.slice(0, 20),
      },
      enrichedUniqueIdentityCount: selectedCandidateCount,
      sourceSummary,
      testingLogTemplate: buildTestingLogTemplate({
        startedAt,
        filePath,
        extractionMetrics,
        totalUniqueIdentityCount: extractionMetrics.uniqueIdentityCount,
        sourceEnrichableUniqueIdentityCount: candidates.length,
        enrichedUniqueIdentityCount: selectedCandidateCount,
        sourceSummary,
      }),
      sampleItems: extraction.items.slice(0, 10),
      sampleSourceResults: sampleResults,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Local document cost test failed.";

    return NextResponse.json(
      {
        filePath,
        error: message,
        testingLogTemplate: buildTestingLogTemplate({
          startedAt,
          filePath,
          error: message,
        }),
      },
      { status: 500 },
    );
  } finally {
    if (previousOcrMaxPages === undefined) {
      delete process.env.PDF_OCR_MAX_PAGES;
    } else {
      process.env.PDF_OCR_MAX_PAGES = previousOcrMaxPages;
    }
  }
}
