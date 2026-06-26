import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { runDocumentExtraction } from "@/lib/server/document-extraction";
import { buildExtractionUsageMetrics, type ExtractionUsageMetrics } from "@/lib/server/extraction-usage";

function formatMaybeNumber(value: number | undefined) {
  return value === undefined ? "" : String(value);
}

function formatNzDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoDate));
}

function buildTestingLogTemplate(input: {
  startedAt: string;
  fixture: string;
  expectedRows: number;
  hasOpenAiKey: boolean;
  metrics?: ExtractionUsageMetrics;
  error?: string;
  reviewNeededItemCount?: number;
  failedItemCount?: number;
}) {
  const metrics = input.metrics;

  return [
    "100-item OpenAI cost test",
    `Date: ${formatNzDate(input.startedAt)}`,
    `Model: ${metrics?.model || (input.hasOpenAiKey ? "" : "mock_phase_3 - OPENAI_API_KEY not configured")}`,
    `Input file: ${input.fixture}`,
    `Rows expected: ${input.expectedRows}`,
    `Rows extracted: ${formatMaybeNumber(metrics?.extractedRowCount)}`,
    `Unique identities: ${formatMaybeNumber(metrics?.uniqueIdentityCount)}`,
    `Duplicates: ${formatMaybeNumber(metrics?.duplicateIdentityCount)}`,
    `Cache hits: ${formatMaybeNumber(metrics?.cacheHitCount)}`,
    `Cache misses: ${formatMaybeNumber(metrics?.cacheMissCount)}`,
    `OpenAI calls: ${formatMaybeNumber(metrics?.openAiRequestCount)}`,
    `OpenAI input tokens: ${formatMaybeNumber(metrics?.openAiInputTokens)}`,
    `OpenAI output tokens: ${formatMaybeNumber(metrics?.openAiOutputTokens)}`,
    `OpenAI total tokens: ${formatMaybeNumber(metrics?.openAiTotalTokens)}`,
    `Redaction replacements: ${formatMaybeNumber(metrics?.redaction?.totalReplacementCount)}`,
    `Estimated extraction cost: ${formatMaybeNumber(metrics?.estimatedOpenAiCostUsd)}`,
    `Estimated cost per row: ${formatMaybeNumber(metrics?.estimatedCostPerExtractedRowUsd)}`,
    `Estimated cost per unique identity: ${formatMaybeNumber(metrics?.estimatedCostPerUniqueIdentityUsd)}`,
    `Elapsed time: ${metrics?.durationMs === undefined ? "" : `${metrics.durationMs}ms`}`,
    `Review-needed items: ${formatMaybeNumber(input.reviewNeededItemCount)}`,
    `Failed/malformed items: ${formatMaybeNumber(input.failedItemCount)}`,
    `Notes: ${input.error ? `Failed: ${input.error}` : ""}`,
  ].join("\n");
}

export async function POST() {
  if (process.env.ENABLE_DEBUG_COST_TESTS !== "true") {
    return NextResponse.json(
      { error: "Debug cost tests are disabled. Set ENABLE_DEBUG_COST_TESTS=true locally to use this route." },
      { status: 404 },
    );
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Debug cost tests are not available in production." },
      { status: 404 },
    );
  }

  const startedAt = new Date().toISOString();
  const fixturePath = path.join(process.cwd(), "docs", "demo-assets", "100-item-cost-test-spec.csv");
  const fixture = "docs/demo-assets/100-item-cost-test-spec.csv";
  const expectedRows = 100;

  try {
    const documentText = await readFile(fixturePath, "utf8");
    const extraction = await runDocumentExtraction({
      jobId: "debug-100-item-cost-test",
      document: {
        id: "debug-100-item-document",
        projectId: "debug-project",
        originalFilename: "100-item-cost-test-spec.csv",
        fileType: "csv",
        mimeType: "text/csv",
      },
      documentText,
    });
    const completedAt = new Date().toISOString();
    const metrics = buildExtractionUsageMetrics({
      items: extraction.items,
      extractor: extraction.extractor,
      model: extraction.model,
      tokenUsage: extraction.tokenUsage,
      openAiRequestCount: extraction.requestCount,
      startedAt,
      completedAt,
      documentTextCharacters: documentText.length,
      redactedTextCharacters: extraction.redactedDocumentTextLength,
      redaction: extraction.redaction,
    });
    const reviewNeededItemCount = extraction.items.filter((item) =>
      ["needs_review", "low_confidence", "unmatched"].includes(item.reviewStatus),
    ).length;
    const failedItemCount = 0;

    return NextResponse.json({
      fixture,
      expectedRows,
      hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
      metrics,
      reviewNeededItemCount,
      failedItemCount,
      testingLogTemplate: buildTestingLogTemplate({
        startedAt,
        fixture,
        expectedRows,
        hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
        metrics,
        reviewNeededItemCount,
        failedItemCount,
      }),
      sampleItems: extraction.items.slice(0, 10).map((item) => ({
        productName: item.productName,
        brand: item.brand,
        model: item.model,
        category: item.category,
        confidenceScore: item.confidenceScore,
        identity: item.rawExtractedData.identity,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "100-item extraction cost test failed.";

    return NextResponse.json(
      {
        fixture,
        expectedRows,
        hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
        error: message,
        testingLogTemplate: buildTestingLogTemplate({
          startedAt,
          fixture,
          expectedRows,
          hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
          error: message,
          failedItemCount: 1,
        }),
      },
      { status: 500 },
    );
  }
}
