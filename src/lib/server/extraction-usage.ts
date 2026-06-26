import { createHash } from "node:crypto";

import type { ExtractedWorkflowItem } from "@/lib/document-workflow";
import type { DocumentRedactionSummary } from "@/lib/server/document-redaction";

type ExtractedItemDraft = Omit<ExtractedWorkflowItem, "id" | "createdAt" | "updatedAt">;

export type OpenAiTokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type ExtractionUsageMetrics = {
  extractor: string;
  extractedRowCount: number;
  uniqueIdentityCount: number;
  duplicateIdentityCount: number;
  cacheLookupCount: number;
  cacheHitCount: number;
  cacheMissCount: number;
  searchCallCount: number;
  deepEnrichmentAttemptCount: number;
  openAiInputTokens?: number;
  openAiOutputTokens?: number;
  openAiTotalTokens?: number;
  openAiRequestCount?: number;
  estimatedOpenAiCostUsd?: number;
  estimatedCostPerExtractedRowUsd?: number;
  estimatedCostPerUniqueIdentityUsd?: number;
  model?: string;
  durationMs?: number;
  documentTextCharacters?: number;
  redactedTextCharacters?: number;
  redaction?: DocumentRedactionSummary;
  duplicateFingerprints: Array<{
    fingerprint: string;
    count: number;
    label: string;
  }>;
};

function cleanPart(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function displayPart(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function hashFingerprint(parts: string[]) {
  return createHash("sha256").update(parts.filter(Boolean).join("|")).digest("hex").slice(0, 24);
}

function extractSkuCandidates(input: ExtractedItemDraft) {
  const source = [
    input.model,
    input.productName,
    input.manufacturer,
    input.brand,
    input.supplierSku,
    input.supplierName || input.supplier,
    displayPart((input.rawExtractedData?.item as { sku?: unknown } | undefined)?.sku),
  ].filter(Boolean).join(" ");

  const matches = source.match(/\b[A-Z0-9][A-Z0-9-]{3,}\b/g) || [];
  return Array.from(new Set(matches)).slice(0, 5);
}

export function buildIdentityEvidence(input: ExtractedItemDraft) {
  const skuCandidates = extractSkuCandidates(input);
  const brand = displayPart(input.brand);
  const manufacturer = displayPart(input.manufacturer || input.brand);
  const supplier = displayPart(input.supplierName || input.supplier);
  const supplierSku = displayPart(input.supplierSku);
  const model = displayPart(input.model);
  const productName = displayPart(input.productName);
  const category = displayPart(input.category);
  const location = displayPart(input.location);

  const normalizedParts = [
    cleanPart(manufacturer || brand),
    cleanPart(model),
    cleanPart(supplierSku),
    cleanPart(productName),
    cleanPart(category),
    cleanPart(supplier),
  ];
  const fallbackParts = [
    cleanPart(productName),
    cleanPart(category),
    cleanPart(location),
  ];
  const fingerprintBase = normalizedParts.some(Boolean) ? normalizedParts : fallbackParts;

  return {
    fingerprint: hashFingerprint(fingerprintBase),
    fingerprintSource: fingerprintBase.filter(Boolean).join("|") || "empty",
    normalized: {
      brand: cleanPart(brand),
      manufacturer: cleanPart(manufacturer || brand),
      model: cleanPart(model),
      productName: cleanPart(productName),
      category: cleanPart(category),
      supplier: cleanPart(supplier),
      supplierSku: cleanPart(supplierSku),
    },
    evidence: {
      brand: brand || undefined,
      manufacturer: manufacturer || brand || undefined,
      model: model || undefined,
      supplier: supplier || undefined,
      supplierSku: supplierSku || undefined,
      skuCandidates,
    },
  };
}

export function attachIdentityEvidence<T extends ExtractedItemDraft>(items: T[]): T[] {
  return items.map((item) => {
    const identity = buildIdentityEvidence(item);

    return {
      ...item,
      rawExtractedData: {
        ...item.rawExtractedData,
        identity,
      },
    };
  });
}

function getConfiguredCost(rateName: string) {
  const value = process.env[rateName];
  const parsed = value ? Number(value) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function estimateOpenAiCostUsd(usage?: OpenAiTokenUsage) {
  if (!usage?.inputTokens && !usage?.outputTokens) {
    return undefined;
  }

  const inputCostPerMillion = getConfiguredCost("OPENAI_EXTRACTION_INPUT_COST_PER_1M");
  const outputCostPerMillion = getConfiguredCost("OPENAI_EXTRACTION_OUTPUT_COST_PER_1M");

  if (!inputCostPerMillion && !outputCostPerMillion) {
    return undefined;
  }

  const inputCost = ((usage.inputTokens || 0) / 1_000_000) * inputCostPerMillion;
  const outputCost = ((usage.outputTokens || 0) / 1_000_000) * outputCostPerMillion;
  return Number((inputCost + outputCost).toFixed(6));
}

export function buildExtractionUsageMetrics(input: {
  items: ExtractedItemDraft[];
  extractor: string;
  model?: string;
  tokenUsage?: OpenAiTokenUsage;
  openAiRequestCount?: number;
  startedAt?: string;
  completedAt?: string;
  documentTextCharacters?: number;
  redactedTextCharacters?: number;
  redaction?: DocumentRedactionSummary;
  cacheHitCount?: number;
}) {
  const fingerprints = input.items.map((item) => buildIdentityEvidence(item));
  const counts = new Map<string, { count: number; label: string }>();

  input.items.forEach((item, index) => {
    const identity = fingerprints[index];
    const label = displayPart(item.productName) || displayPart(item.category) || "Extracted item";
    const current = counts.get(identity.fingerprint);
    counts.set(identity.fingerprint, {
      count: (current?.count || 0) + 1,
      label: current?.label || label,
    });
  });

  const duplicateFingerprints = Array.from(counts.entries())
    .filter(([, value]) => value.count > 1)
    .map(([fingerprint, value]) => ({ fingerprint, count: value.count, label: value.label }));
  const cacheHitCount = input.cacheHitCount || 0;
  const estimatedOpenAiCostUsd = estimateOpenAiCostUsd(input.tokenUsage);

  return {
    extractor: input.extractor,
    extractedRowCount: input.items.length,
    uniqueIdentityCount: counts.size,
    duplicateIdentityCount: input.items.length - counts.size,
    cacheLookupCount: input.items.length,
    cacheHitCount,
    cacheMissCount: Math.max(0, input.items.length - cacheHitCount),
    searchCallCount: 0,
    deepEnrichmentAttemptCount: 0,
    openAiInputTokens: input.tokenUsage?.inputTokens,
    openAiOutputTokens: input.tokenUsage?.outputTokens,
    openAiTotalTokens: input.tokenUsage?.totalTokens,
    openAiRequestCount: input.openAiRequestCount,
    estimatedOpenAiCostUsd,
    estimatedCostPerExtractedRowUsd: estimatedOpenAiCostUsd && input.items.length
      ? Number((estimatedOpenAiCostUsd / input.items.length).toFixed(6))
      : undefined,
    estimatedCostPerUniqueIdentityUsd: estimatedOpenAiCostUsd && counts.size
      ? Number((estimatedOpenAiCostUsd / counts.size).toFixed(6))
      : undefined,
    model: input.model,
    durationMs: input.startedAt && input.completedAt
      ? Math.max(0, new Date(input.completedAt).getTime() - new Date(input.startedAt).getTime())
      : undefined,
    documentTextCharacters: input.documentTextCharacters,
    redactedTextCharacters: input.redactedTextCharacters,
    redaction: input.redaction,
    duplicateFingerprints,
  } satisfies ExtractionUsageMetrics;
}

export function getRawExtractionUsage(item: ExtractedWorkflowItem) {
  const usage = item.rawExtractedData?.usage;
  return usage && typeof usage === "object" ? usage as Partial<ExtractionUsageMetrics> : null;
}
