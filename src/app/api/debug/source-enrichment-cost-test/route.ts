import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { runDocumentExtraction } from "@/lib/server/document-extraction";
import { buildExtractionUsageMetrics } from "@/lib/server/extraction-usage";
import {
  buildSourceEnrichmentUsageSummary,
  enrichCandidateWithSources,
  getSourceEnrichmentCandidateBreakdown,
  type SourceEnrichmentResult,
  type SourceEnrichmentUsageSummary,
} from "@/lib/server/source-enrichment-cost";

type SourceEnrichmentCostRequest = {
  maxUniqueItems?: unknown;
  startAtUniqueItem?: unknown;
  inspectPdfSources?: unknown;
  summarizePdfSources?: unknown;
  searchContextSize?: unknown;
};

const fixture = "docs/demo-assets/100-item-cost-test-spec.csv";
const expectedRows = 100;
const maxAllowedUniqueItems = 40;
const extractionRetryCount = 2;

function formatNzDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoDate));
}

function getMaxUniqueItems(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 5;
  }

  return Math.min(maxAllowedUniqueItems, Math.max(1, Math.round(parsed)));
}

function getStartAtUniqueItem(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.max(0, Math.round(parsed));
}

function getSearchContextSize(value: unknown): "low" | "medium" | "high" {
  return value === "medium" || value === "high" ? value : "low";
}

function getProjectedCost(summary: SourceEnrichmentUsageSummary, totalUniqueIdentityCount: number) {
  if (!summary.estimatedCostPerCandidateUsd || summary.candidateCount <= 0) {
    return undefined;
  }

  return {
    sampledCandidateCount: summary.candidateCount,
    totalUniqueIdentityCount,
    estimatedCostForAllUniqueIdentitiesUsd: Number(
      (summary.estimatedCostPerCandidateUsd * totalUniqueIdentityCount).toFixed(6),
    ),
    estimatedCostPer100ExtractedRowsUsd: Number(
      (summary.estimatedCostPerCandidateUsd * totalUniqueIdentityCount).toFixed(6),
    ),
  };
}

function buildTestingLogTemplate(input: {
  startedAt: string;
  model: string;
  extractedRowCount?: number;
  totalUniqueIdentityCount?: number;
  sourceEnrichableUniqueIdentityCount?: number;
  enrichedUniqueIdentityCount?: number;
  summary?: SourceEnrichmentUsageSummary;
  projectedCost?: ReturnType<typeof getProjectedCost>;
  error?: string;
}) {
  const summary = input.summary;

  return [
    "100-item source enrichment cost test",
    `Date: ${formatNzDate(input.startedAt)}`,
    `Model: ${input.model}`,
    `Input file: ${fixture}`,
    `Rows expected: ${expectedRows}`,
    `Rows extracted: ${input.extractedRowCount ?? ""}`,
    `Unique identities found: ${input.totalUniqueIdentityCount ?? ""}`,
    `Source-enrichable unique identities: ${input.sourceEnrichableUniqueIdentityCount ?? ""}`,
    `Unique identities enriched: ${input.enrichedUniqueIdentityCount ?? ""}`,
    `Web search calls: ${summary?.webSearchCallCount ?? ""}`,
    `Source PDFs inspected: ${summary?.sourcePdfInspectionCount ?? ""}`,
    `Source PDF failures: ${summary?.sourcePdfInspectionFailureCount ?? ""}`,
    `Source PDF summary calls: ${summary?.pdfSummaryCallCount ?? ""}`,
    `Source PDF summary input tokens: ${summary?.pdfSummaryInputTokens ?? ""}`,
    `Source PDF summary output tokens: ${summary?.pdfSummaryOutputTokens ?? ""}`,
    `Source PDF summary total tokens: ${summary?.pdfSummaryTotalTokens ?? ""}`,
    `Enrichment input tokens: ${summary?.inputTokens ?? ""}`,
    `Enrichment output tokens: ${summary?.outputTokens ?? ""}`,
    `Enrichment total tokens: ${summary?.totalTokens ?? ""}`,
    `Estimated enrichment model cost: ${summary?.estimatedOpenAiCostUsd ?? ""}`,
    `Estimated web search cost: ${summary?.estimatedWebSearchCostUsd ?? ""}`,
    `Estimated total enrichment cost: ${summary?.estimatedTotalCostUsd ?? ""}`,
    `Estimated cost per enriched unique item: ${summary?.estimatedCostPerCandidateUsd ?? ""}`,
    `Projected cost for all unique identities: ${input.projectedCost?.estimatedCostForAllUniqueIdentitiesUsd ?? ""}`,
    `Elapsed time: ${summary?.durationMs === undefined ? "" : `${summary.durationMs}ms`}`,
    `Failed enrichment items: ${summary?.failedCount ?? ""}`,
    `Notes: ${input.error ? `Failed: ${input.error}` : ""}`,
  ].join("\n");
}

async function runDebugExtractionWithRetry(input: Parameters<typeof runDocumentExtraction>[0]) {
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
      { error: "Debug source enrichment cost tests are disabled. Set ENABLE_DEBUG_COST_TESTS=true locally to use this route." },
      { status: 404 },
    );
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Debug source enrichment cost tests are not available in production." },
      { status: 404 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_SOURCE_ENRICHMENT_MODEL || process.env.OPENAI_EXTRACTION_MODEL || "gpt-5.4-mini";
  const startedAt = new Date().toISOString();

  if (!apiKey) {
    return NextResponse.json(
      {
        fixture,
        expectedRows,
        hasOpenAiKey: false,
        error: "OPENAI_API_KEY is required for source enrichment cost tests.",
        testingLogTemplate: buildTestingLogTemplate({
          startedAt,
          model,
          error: "OPENAI_API_KEY is required for source enrichment cost tests.",
        }),
      },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({})) as SourceEnrichmentCostRequest;
  const maxUniqueItems = getMaxUniqueItems(body.maxUniqueItems);
  const startAtUniqueItem = getStartAtUniqueItem(body.startAtUniqueItem);
  const inspectPdfSources = body.inspectPdfSources !== false;
  const summarizePdfSources = body.summarizePdfSources === true;
  const searchContextSize = getSearchContextSize(body.searchContextSize);

  try {
    const fixturePath = path.join(process.cwd(), "docs", "demo-assets", "100-item-cost-test-spec.csv");
    const documentText = await readFile(fixturePath, "utf8");
    const extraction = await runDebugExtractionWithRetry({
      jobId: "debug-100-item-source-enrichment-test",
      document: {
        id: "debug-100-item-source-enrichment-document",
        projectId: "debug-project",
        originalFilename: "100-item-cost-test-spec.csv",
        fileType: "csv",
        mimeType: "text/csv",
      },
      documentText,
    });
    const extractionMetrics = buildExtractionUsageMetrics({
      items: extraction.items,
      extractor: extraction.extractor,
      model: extraction.model,
      tokenUsage: extraction.tokenUsage,
      openAiRequestCount: extraction.requestCount,
      startedAt,
      completedAt: new Date().toISOString(),
      documentTextCharacters: documentText.length,
      redactedTextCharacters: extraction.redactedDocumentTextLength,
      redaction: extraction.redaction,
    });
    const candidateBreakdown = getSourceEnrichmentCandidateBreakdown(extraction.items);
    const candidates = candidateBreakdown.candidates;
    const selectedCandidates = candidates.slice(startAtUniqueItem, startAtUniqueItem + maxUniqueItems);
    const results: SourceEnrichmentResult[] = [];

    for (const candidate of selectedCandidates) {
      try {
        const result = await enrichCandidateWithSources({
          apiKey,
          model,
          candidate,
          inspectPdfSources,
          summarizePdfSources,
          searchContextSize,
        });
        results.push(result);
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

    const completedAt = new Date().toISOString();
    const summary = buildSourceEnrichmentUsageSummary({
      model,
      results,
      startedAt,
      completedAt,
    });
    const projectedCost = getProjectedCost(summary, candidates.length);

    return NextResponse.json({
      fixture,
      expectedRows,
      hasOpenAiKey: true,
      options: {
        maxUniqueItems,
        startAtUniqueItem,
        inspectPdfSources,
        summarizePdfSources,
        searchContextSize,
      },
      extractionMetrics,
      totalUniqueIdentityCount: extractionMetrics.uniqueIdentityCount,
      sourceEnrichableUniqueIdentityCount: candidates.length,
      sourceCandidateBreakdown: {
        countsByClassification: candidateBreakdown.countsByClassification,
        sourceCandidateSample: candidates.slice(0, 20),
        rejectedSample: candidateBreakdown.rejected.slice(0, 20),
      },
      enrichedUniqueIdentityCount: selectedCandidates.length,
      summary,
      projectedCost,
      testingLogTemplate: buildTestingLogTemplate({
        startedAt,
        model,
        extractedRowCount: extractionMetrics.extractedRowCount,
        totalUniqueIdentityCount: extractionMetrics.uniqueIdentityCount,
        sourceEnrichableUniqueIdentityCount: candidates.length,
        enrichedUniqueIdentityCount: selectedCandidates.length,
        summary,
        projectedCost,
      }),
      sampleResults: results.slice(0, 5),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "100-item source enrichment cost test failed.";

    return NextResponse.json(
      {
        fixture,
        expectedRows,
        hasOpenAiKey: true,
        error: message,
        testingLogTemplate: buildTestingLogTemplate({
          startedAt,
          model,
          error: message,
        }),
      },
      { status: 500 },
    );
  }
}
