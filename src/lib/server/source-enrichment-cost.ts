import type { ExtractedWorkflowItem } from "@/lib/document-workflow";
import {
  buildIdentityEvidence,
  type OpenAiTokenUsage,
} from "@/lib/server/extraction-usage";
import {
  downloadAndInspectSourcePdf,
  type SourcePdfDownloadResult,
} from "@/lib/server/source-pdf";

type ExtractedItemDraft = Omit<ExtractedWorkflowItem, "id" | "createdAt" | "updatedAt">;

export type SourceEnrichmentCandidate = {
  fingerprint: string;
  productName: string;
  brand?: string;
  manufacturer?: string;
  model?: string;
  category?: string;
  supplier?: string;
  rowCount: number;
  classification: SourceEnrichmentClassification;
  classificationReason: string;
};

export type SourceEnrichmentClassification =
  | "source_enrichable"
  | "admin_or_fee"
  | "legal_or_contract"
  | "temporary_service"
  | "project_document"
  | "reference_code"
  | "generic_allowance"
  | "client_or_contact"
  | "insufficient_identity";

export type SourceEnrichmentCandidateBreakdown = {
  candidates: SourceEnrichmentCandidate[];
  rejected: Array<{
    classification: SourceEnrichmentClassification;
    reason: string;
    productName?: string;
    category?: string;
    brand?: string;
    model?: string;
  }>;
  countsByClassification: Record<SourceEnrichmentClassification, number>;
};

export type SourceEnrichmentResult = {
  candidate: SourceEnrichmentCandidate;
  status: "completed" | "failed";
  error?: string;
  officialSourceUrls: string[];
  directPdfUrls: string[];
  warrantySummary?: string;
  maintenanceSummary?: string;
  confidenceLabel?: string;
  reviewReason?: string;
  webSearchCallCount: number;
  tokenUsage: OpenAiTokenUsage;
  estimatedOpenAiCostUsd?: number;
  estimatedWebSearchCostUsd?: number;
  pdfSummaryCallCount: number;
  pdfSummaryTokenUsage: OpenAiTokenUsage;
  pdfSummaries: Array<{
    url: string;
    warrantySummary?: string;
    maintenanceSummary?: string;
    ownerResponsibilities?: string;
    confidenceLabel?: string;
    reviewReason?: string;
  }>;
  pdfInspections: Array<{
    url: string;
    ok: boolean;
    error?: string;
    source?: Omit<SourcePdfDownloadResult, "fileHash" | "textHash"> & {
      fileHash: string;
      textHash: string;
    };
  }>;
};

export type SourceEnrichmentUsageSummary = {
  model: string;
  candidateCount: number;
  completedCount: number;
  failedCount: number;
  webSearchCallCount: number;
  sourcePdfInspectionCount: number;
  sourcePdfInspectionFailureCount: number;
  pdfSummaryCallCount: number;
  pdfSummaryInputTokens?: number;
  pdfSummaryOutputTokens?: number;
  pdfSummaryTotalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedOpenAiCostUsd?: number;
  estimatedWebSearchCostUsd?: number;
  estimatedTotalCostUsd?: number;
  estimatedCostPerCandidateUsd?: number;
  durationMs: number;
};

type OpenAiResponseBody = {
  output_text?: string;
  output?: Array<Record<string, unknown>>;
  usage?: Record<string, unknown>;
};

type ParsedSourceEnrichment = {
  officialSourceUrls?: unknown;
  directPdfUrls?: unknown;
  warrantySummary?: unknown;
  maintenanceSummary?: unknown;
  confidenceLabel?: unknown;
  reviewReason?: unknown;
};

type ParsedPdfSummary = {
  warrantySummary?: unknown;
  maintenanceSummary?: unknown;
  ownerResponsibilities?: unknown;
  confidenceLabel?: unknown;
  reviewReason?: unknown;
};

const defaultSearchModel = "gpt-5.4-mini";
const maxPdfInspectionsPerCandidate = 1;
const maxPdfSummaryCharacters = 18000;

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getTextFromResponse(response: OpenAiResponseBody) {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  const output = Array.isArray(response.output) ? response.output : [];
  for (const outputItem of output) {
    const content = Array.isArray(outputItem.content) ? outputItem.content : [];

    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== "object") {
        continue;
      }

      const text = (contentItem as { text?: unknown }).text;
      if (typeof text === "string") {
        return text;
      }
    }
  }

  return "";
}

function getTokenUsageFromResponse(response: OpenAiResponseBody): OpenAiTokenUsage {
  const usage = response.usage && typeof response.usage === "object" ? response.usage : {};
  const inputTokens = typeof usage.input_tokens === "number" ? usage.input_tokens : undefined;
  const outputTokens = typeof usage.output_tokens === "number" ? usage.output_tokens : undefined;
  const totalTokens = typeof usage.total_tokens === "number" ? usage.total_tokens : undefined;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

function addTokenUsage(left: OpenAiTokenUsage, right: OpenAiTokenUsage): OpenAiTokenUsage {
  return {
    inputTokens: (left.inputTokens || 0) + (right.inputTokens || 0) || undefined,
    outputTokens: (left.outputTokens || 0) + (right.outputTokens || 0) || undefined,
    totalTokens: (left.totalTokens || 0) + (right.totalTokens || 0) || undefined,
  };
}

function countWebSearchCalls(response: OpenAiResponseBody) {
  const output = Array.isArray(response.output) ? response.output : [];
  return output.filter((item) => item.type === "web_search_call").length;
}

function getStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function safeParseJson(text: string): ParsedSourceEnrichment {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")
    : trimmed;

  return JSON.parse(jsonText) as ParsedSourceEnrichment;
}

function safeParsePdfSummaryJson(text: string): ParsedPdfSummary {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")
    : trimmed;

  return JSON.parse(jsonText) as ParsedPdfSummary;
}

function getConfiguredCost(rateName: string) {
  const value = process.env[rateName];
  const parsed = value ? Number(value) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function estimateEnrichmentOpenAiCostUsd(usage?: OpenAiTokenUsage) {
  if (!usage?.inputTokens && !usage?.outputTokens) {
    return undefined;
  }

  const inputCostPerMillion =
    getConfiguredCost("OPENAI_ENRICHMENT_INPUT_COST_PER_1M") ||
    getConfiguredCost("OPENAI_EXTRACTION_INPUT_COST_PER_1M");
  const outputCostPerMillion =
    getConfiguredCost("OPENAI_ENRICHMENT_OUTPUT_COST_PER_1M") ||
    getConfiguredCost("OPENAI_EXTRACTION_OUTPUT_COST_PER_1M");

  if (!inputCostPerMillion && !outputCostPerMillion) {
    return undefined;
  }

  const inputCost = ((usage.inputTokens || 0) / 1_000_000) * inputCostPerMillion;
  const outputCost = ((usage.outputTokens || 0) / 1_000_000) * outputCostPerMillion;
  return Number((inputCost + outputCost).toFixed(6));
}

function estimateWebSearchCostUsd(callCount: number) {
  const costPerThousand = getConfiguredCost("OPENAI_WEB_SEARCH_COST_PER_1K");

  if (!costPerThousand || callCount <= 0) {
    return undefined;
  }

  return Number(((callCount / 1000) * costPerThousand).toFixed(6));
}

const classificationValues: SourceEnrichmentClassification[] = [
  "source_enrichable",
  "admin_or_fee",
  "legal_or_contract",
  "temporary_service",
  "project_document",
  "reference_code",
  "generic_allowance",
  "client_or_contact",
  "insufficient_identity",
];

const sourceProductTerms = [
  "appliance",
  "basin",
  "batten",
  "benchtop",
  "cabinet",
  "carpet",
  "cladding",
  "cylinder",
  "dishwasher",
  "door",
  "downlight",
  "extractor",
  "fan",
  "fixture",
  "floor",
  "gutter",
  "hardware",
  "heater",
  "hot water",
  "insulation",
  "joinery",
  "laminate",
  "membrane",
  "mixer",
  "oven",
  "paint",
  "plasterboard",
  "roof",
  "sealant",
  "shower",
  "sink",
  "spouting",
  "tap",
  "tile",
  "toilet",
  "vanity",
  "ventilation",
  "waterproof",
  "window",
];

function hasAnyTerm(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function hasExternalQuoteReference(text: string) {
  return (
    /\bas\s+per\b.*\bquote\b/.test(text) ||
    /\bquote\b.*\bby\b/.test(text) ||
    /\bquote\b.*\bfrom\b/.test(text) ||
    /\bper\b.*\bquote\b/.test(text) ||
    hasAnyTerm(text, [
      "supplier quote",
      "subcontractor quote",
      "joinery quote",
      "kitchen quote",
      "laundry quote",
      "scullery quote",
      "cabinetry quote",
      "quoted separately",
      "separate quote",
    ])
  );
}

function classifySourceEnrichmentItem(item: ExtractedItemDraft): {
  classification: SourceEnrichmentClassification;
  reason: string;
} {
  const combined = [
    item.productName,
    item.manufacturer,
    item.brand,
    item.model,
    item.category,
    item.supplierName,
    item.supplier,
    item.supplierSku,
    item.location,
    item.quoteReferenceText,
  ]
    .map((value) => cleanText(value).toLowerCase())
    .filter(Boolean)
    .join(" ");

  if (!combined) {
    return {
      classification: "insufficient_identity",
      reason: "No product identity text was extracted.",
    };
  }

  if (item.quoteReferenceStatus === "referenced" || item.quoteReferenceStatus === "quote_uploaded") {
    return {
      classification: "project_document",
      reason:
        "This row still depends on a referenced supplier document. Extract and review the quote or supplier schedule before source enrichment.",
    };
  }

  if (
    combined.includes("[redacted_") ||
    combined.includes("client contact") ||
    combined.includes("contact sheet") ||
    combined.includes("homeowner") ||
    combined.includes("customer")
  ) {
    return {
      classification: "client_or_contact",
      reason: "Client/contact or redacted personal information should not be source enriched.",
    };
  }

  if (
    hasAnyTerm(combined, [
      "reference code",
      "code/reference",
      "specification code",
      "drawing code",
      "document code",
      "drawing / document code",
      "drawing number",
      "sheet number",
    ])
  ) {
    return {
      classification: "reference_code",
      reason: "Drawing, document, and reference codes are project metadata rather than product source targets.",
    };
  }

  if (
    hasAnyTerm(combined, [
      "colour selection",
      "colours selection",
      "color selection",
      "colors selection",
      "finish selection",
      "selections schedule",
    ])
  ) {
    return {
      classification: "project_document",
      reason: "Colour and finish selection metadata needs review before product-level source enrichment.",
    };
  }

  if (hasExternalQuoteReference(combined)) {
    return {
      classification: "project_document",
      reason:
        "This row references an external supplier quote rather than listing exact homeowner handover products. Ask the builder to upload the quote or add the specific product, material, model, warranty, and care details before source enrichment.",
    };
  }

  if (
    hasAnyTerm(combined, [
      "admin note",
      "building consent",
      "consent",
      "consent fee",
      "council fee",
      "fee",
      "freight",
      "delivery",
      "deliveries",
      "insurance",
      "inspection fee",
      "processing fee",
      "professional services",
    ])
  ) {
    return {
      classification: "admin_or_fee",
      reason: "Admin, fee, insurance, delivery, or consent items do not need warranty/source enrichment.",
    };
  }

  if (
    hasAnyTerm(combined, [
      "contract",
      "legal",
      "outline specification",
      "specification document",
      "drawings",
      "documentation preparation",
      "project document",
      "document identifier",
      "new residence",
      "residential building",
    ])
  ) {
    return {
      classification: combined.includes("contract") || combined.includes("legal")
        ? "legal_or_contract"
        : "project_document",
      reason: "Project/legal/specification document metadata is not a product source-enrichment target.",
    };
  }

  if (
    hasAnyTerm(combined, [
      "temporary power",
      "temporary water",
      "temporary service",
      "site power",
      "site water",
      "site services",
      "plinth",
      "power connection",
      "water connection",
    ])
  ) {
    return {
      classification: "temporary_service",
      reason: "Temporary site service items are not homeowner product/warranty records.",
    };
  }

  if (combined.includes("allowance") && !hasAnyTerm(combined, sourceProductTerms)) {
    return {
      classification: "generic_allowance",
      reason: "Generic allowances need builder review before source enrichment.",
    };
  }

  if (hasAnyTerm(combined, sourceProductTerms)) {
    return {
      classification: "source_enrichable",
      reason: "Item appears to be a product, material, fixture, appliance, or system with possible warranty/maintenance sources.",
    };
  }

  if (cleanText(item.brand) || cleanText(item.model) || cleanText(item.supplier)) {
    return {
      classification: "source_enrichable",
      reason: "Item has brand/model/supplier identity evidence that can be source checked.",
    };
  }

  return {
    classification: "insufficient_identity",
    reason: "Item does not yet have enough product/material identity for source enrichment.",
  };
}

export function getSourceEnrichmentCandidateBreakdown(items: ExtractedItemDraft[]): SourceEnrichmentCandidateBreakdown {
  const candidates = new Map<string, SourceEnrichmentCandidate>();
  const rejected: SourceEnrichmentCandidateBreakdown["rejected"] = [];
  const countsByClassification = Object.fromEntries(
    classificationValues.map((classification) => [classification, 0]),
  ) as Record<SourceEnrichmentClassification, number>;

  for (const item of items) {
    const classification = classifySourceEnrichmentItem(item);
    countsByClassification[classification.classification] += 1;

    if (classification.classification !== "source_enrichable") {
      rejected.push({
        classification: classification.classification,
        reason: classification.reason,
        productName: cleanText(item.productName) || undefined,
        category: cleanText(item.category) || undefined,
        brand: cleanText(item.brand) || undefined,
        model: cleanText(item.model) || undefined,
      });
      continue;
    }

    const identity = buildIdentityEvidence(item);
    const current = candidates.get(identity.fingerprint);

    if (current) {
      current.rowCount += 1;
      continue;
    }

    candidates.set(identity.fingerprint, {
      fingerprint: identity.fingerprint,
      productName: cleanText(item.productName) || "Unnamed product",
      brand: cleanText(item.brand) || undefined,
      manufacturer: identity.evidence.manufacturer,
      model: cleanText(item.model) || undefined,
      category: cleanText(item.category) || undefined,
      supplier: cleanText(item.supplier) || undefined,
      rowCount: 1,
      classification: classification.classification,
      classificationReason: classification.reason,
    });
  }

  return {
    candidates: Array.from(candidates.values()).sort((left, right) => right.rowCount - left.rowCount),
    rejected,
    countsByClassification,
  };
}

export function getUniqueSourceEnrichmentCandidates(items: ExtractedItemDraft[]) {
  return getSourceEnrichmentCandidateBreakdown(items).candidates;
}

function buildSearchPrompt(candidate: SourceEnrichmentCandidate) {
  return [
    "Find official New Zealand or manufacturer source information for this builder handover product.",
    "Use web search. Prefer official manufacturer, supplier, warranty, care guide, installation manual, datasheet, or appraisal pages.",
    "Return only JSON. Do not include markdown.",
    "",
    "JSON shape:",
    "{",
    '  "officialSourceUrls": ["https://..."],',
    '  "directPdfUrls": ["https://...pdf"],',
    '  "warrantySummary": "short source-backed warranty finding or empty string",',
    '  "maintenanceSummary": "short source-backed maintenance/care finding or empty string",',
    '  "confidenceLabel": "high|medium|low|blocked",',
    '  "reviewReason": "why this is source-backed or why it needs review"',
    "}",
    "",
    `Product: ${candidate.productName}`,
    `Brand: ${candidate.brand || ""}`,
    `Manufacturer: ${candidate.manufacturer || ""}`,
    `Model: ${candidate.model || ""}`,
    `Category: ${candidate.category || ""}`,
    `Supplier: ${candidate.supplier || ""}`,
    "Region: New Zealand",
  ].join("\n");
}

function buildPdfSummaryPrompt(input: {
  candidate: SourceEnrichmentCandidate;
  sourceUrl: string;
  pdfText: string;
}) {
  return [
    "Summarise the source PDF text for a builder handover portal.",
    "Extract only source-supported facts. Do not invent warranty, maintenance, exclusions, or owner obligations.",
    "Return only JSON. Do not include markdown.",
    "",
    "JSON shape:",
    "{",
    '  "warrantySummary": "short warranty period/conditions summary or empty string",',
    '  "maintenanceSummary": "short maintenance/care requirements summary or empty string",',
    '  "ownerResponsibilities": "short homeowner/builder responsibilities summary or empty string",',
    '  "confidenceLabel": "high|medium|low|blocked",',
    '  "reviewReason": "why the summary is reliable or what needs review"',
    "}",
    "",
    `Product: ${input.candidate.productName}`,
    `Brand: ${input.candidate.brand || ""}`,
    `Manufacturer: ${input.candidate.manufacturer || ""}`,
    `Model: ${input.candidate.model || ""}`,
    `Source URL: ${input.sourceUrl}`,
    `PDF text:\n${input.pdfText.slice(0, maxPdfSummaryCharacters)}`,
  ].join("\n");
}

async function summarizeSourcePdf(input: {
  apiKey: string;
  model: string;
  candidate: SourceEnrichmentCandidate;
  sourceUrl: string;
  pdfText: string;
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      input: buildPdfSummaryPrompt(input),
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI source PDF summarisation failed with status ${response.status}.`);
  }

  const body = await response.json() as OpenAiResponseBody;
  const parsed = safeParsePdfSummaryJson(getTextFromResponse(body));

  return {
    summary: {
      url: input.sourceUrl,
      warrantySummary: cleanText(parsed.warrantySummary) || undefined,
      maintenanceSummary: cleanText(parsed.maintenanceSummary) || undefined,
      ownerResponsibilities: cleanText(parsed.ownerResponsibilities) || undefined,
      confidenceLabel: cleanText(parsed.confidenceLabel) || undefined,
      reviewReason: cleanText(parsed.reviewReason) || undefined,
    },
    tokenUsage: getTokenUsageFromResponse(body),
  };
}

export async function enrichCandidateWithSources(input: {
  apiKey: string;
  model?: string;
  candidate: SourceEnrichmentCandidate;
  inspectPdfSources?: boolean;
  summarizePdfSources?: boolean;
  searchContextSize?: "low" | "medium" | "high";
}): Promise<SourceEnrichmentResult> {
  const model = input.model || defaultSearchModel;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      tools: [{
        type: "web_search",
        search_context_size: input.searchContextSize || "low",
      }],
      input: buildSearchPrompt(input.candidate),
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI source enrichment failed with status ${response.status}.`);
  }

  const body = await response.json() as OpenAiResponseBody;
  const text = getTextFromResponse(body);
  const parsed = safeParseJson(text);
  const officialSourceUrls = getStringArray(parsed.officialSourceUrls);
  const directPdfUrls = getStringArray(parsed.directPdfUrls);
  const webSearchCallCount = countWebSearchCalls(body);
  let tokenUsage = getTokenUsageFromResponse(body);
  const pdfInspections: SourceEnrichmentResult["pdfInspections"] = [];
  const pdfSummaries: SourceEnrichmentResult["pdfSummaries"] = [];
  let pdfSummaryTokenUsage: OpenAiTokenUsage = {};
  let pdfSummaryCallCount = 0;

  if (input.inspectPdfSources) {
    for (const url of directPdfUrls.slice(0, maxPdfInspectionsPerCandidate)) {
      try {
        const source = await downloadAndInspectSourcePdf(url, {
          identityHints: {
            productName: input.candidate.productName,
            brand: input.candidate.brand,
            manufacturer: input.candidate.manufacturer,
            model: input.candidate.model,
          },
          includeExtractedText: input.summarizePdfSources,
        });
        const { extractedText, ...sourceMetadata } = source;
        pdfInspections.push({ url, ok: true, source: sourceMetadata });

        if (input.summarizePdfSources && extractedText?.trim()) {
          const summarized = await summarizeSourcePdf({
            apiKey: input.apiKey,
            model,
            candidate: input.candidate,
            sourceUrl: url,
            pdfText: extractedText,
          });
          pdfSummaryCallCount += 1;
          pdfSummaryTokenUsage = addTokenUsage(pdfSummaryTokenUsage, summarized.tokenUsage);
          tokenUsage = addTokenUsage(tokenUsage, summarized.tokenUsage);
          pdfSummaries.push(summarized.summary);
        }
      } catch (error) {
        pdfInspections.push({
          url,
          ok: false,
          error: error instanceof Error ? error.message : "Source PDF inspection failed.",
        });
      }
    }
  }

  return {
    candidate: input.candidate,
    status: "completed",
    officialSourceUrls,
    directPdfUrls,
    warrantySummary: cleanText(parsed.warrantySummary) || undefined,
    maintenanceSummary: cleanText(parsed.maintenanceSummary) || undefined,
    confidenceLabel: cleanText(parsed.confidenceLabel) || undefined,
    reviewReason: cleanText(parsed.reviewReason) || undefined,
    webSearchCallCount,
    tokenUsage,
    estimatedOpenAiCostUsd: estimateEnrichmentOpenAiCostUsd(tokenUsage),
    estimatedWebSearchCostUsd: estimateWebSearchCostUsd(webSearchCallCount),
    pdfSummaryCallCount,
    pdfSummaryTokenUsage,
    pdfSummaries,
    pdfInspections,
  };
}

export function buildSourceEnrichmentUsageSummary(input: {
  model: string;
  results: SourceEnrichmentResult[];
  startedAt: string;
  completedAt: string;
}) {
  const tokenUsage = input.results.reduce<OpenAiTokenUsage>(
    (total, result) => addTokenUsage(total, result.tokenUsage),
    {},
  );
  const webSearchCallCount = input.results.reduce((total, result) => total + result.webSearchCallCount, 0);
  const sourcePdfInspectionCount = input.results.reduce((total, result) => total + result.pdfInspections.length, 0);
  const sourcePdfInspectionFailureCount = input.results.reduce(
    (total, result) => total + result.pdfInspections.filter((inspection) => !inspection.ok).length,
    0,
  );
  const pdfSummaryCallCount = input.results.reduce((total, result) => total + result.pdfSummaryCallCount, 0);
  const pdfSummaryTokenUsage = input.results.reduce<OpenAiTokenUsage>(
    (total, result) => addTokenUsage(total, result.pdfSummaryTokenUsage),
    {},
  );
  const estimatedOpenAiCostUsd = estimateEnrichmentOpenAiCostUsd(tokenUsage);
  const estimatedWebSearchCostUsd = estimateWebSearchCostUsd(webSearchCallCount);
  const estimatedTotalCostUsd = estimatedOpenAiCostUsd !== undefined || estimatedWebSearchCostUsd !== undefined
    ? Number(((estimatedOpenAiCostUsd || 0) + (estimatedWebSearchCostUsd || 0)).toFixed(6))
    : undefined;

  return {
    model: input.model,
    candidateCount: input.results.length,
    completedCount: input.results.filter((result) => result.status === "completed").length,
    failedCount: input.results.filter((result) => result.status === "failed").length,
    webSearchCallCount,
    sourcePdfInspectionCount,
    sourcePdfInspectionFailureCount,
    pdfSummaryCallCount,
    pdfSummaryInputTokens: pdfSummaryTokenUsage.inputTokens,
    pdfSummaryOutputTokens: pdfSummaryTokenUsage.outputTokens,
    pdfSummaryTotalTokens: pdfSummaryTokenUsage.totalTokens,
    inputTokens: tokenUsage.inputTokens,
    outputTokens: tokenUsage.outputTokens,
    totalTokens: tokenUsage.totalTokens,
    estimatedOpenAiCostUsd,
    estimatedWebSearchCostUsd,
    estimatedTotalCostUsd,
    estimatedCostPerCandidateUsd: estimatedTotalCostUsd && input.results.length
      ? Number((estimatedTotalCostUsd / input.results.length).toFixed(6))
      : undefined,
    durationMs: Math.max(0, new Date(input.completedAt).getTime() - new Date(input.startedAt).getTime()),
  } satisfies SourceEnrichmentUsageSummary;
}
