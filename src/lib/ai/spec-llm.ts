import type { SpecReviewLane } from "@/lib/ai/spec-classify";
import { reviewLaneToRecommendedAction } from "@/lib/ai/spec-classify";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildSpecExtractionCandidates, type SpecExtractionCandidate } from "@/lib/ai/spec-candidates";
import { cleanEvidenceText, cleanStructuredEvidenceText } from "@/lib/ai/spec-normalize";
import type { ProposedSpecItem } from "@/lib/ai/spec-extract";

export type SpecLlmClassification = {
  candidate_id: string;
  keep: boolean;
  title: string;
  item_type: ProposedSpecItem["item_type"] | "note";
  review_lane: SpecReviewLane;
  category: string;
  location: string;
  manufacturer: string;
  model_or_code: string;
  source_quote: string;
  confidence: number;
  reason: string;
};

export type ValidatedSpecLlmClassification = SpecLlmClassification & {
  accepted: boolean;
  validation_errors: string[];
  recommended_action: ProposedSpecItem["recommended_action"];
};

export type SpecLlmClassifyResult = {
  provider: "openai";
  model: string;
  sentCandidateCount: number;
  acceptedCount: number;
  rejectedCount: number;
  tokenUsage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  sentCandidateIds: string[];
  classifications: ValidatedSpecLlmClassification[];
};

const validReviewLanes = new Set<SpecReviewLane>([
  "known_match",
  "general_finish",
  "needs_builder_context",
  "needs_model_or_code",
  "needs_source_document",
  "admin_review",
  "maintenance",
]);

const validItemTypes = new Set(["product", "maintenance", "document", "note"]);

const specLlmSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    classifications: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          candidate_id: { type: "string" },
          keep: { type: "boolean" },
          title: { type: "string" },
          item_type: { type: "string", enum: ["product", "maintenance", "document", "note"] },
          review_lane: {
            type: "string",
            enum: [
              "known_match",
              "general_finish",
              "needs_builder_context",
              "needs_model_or_code",
              "needs_source_document",
              "admin_review",
              "maintenance",
            ],
          },
          category: { type: "string" },
          location: { type: "string" },
          manufacturer: { type: "string" },
          model_or_code: { type: "string" },
          source_quote: { type: "string" },
          confidence: { type: "number" },
          reason: { type: "string" },
        },
        required: [
          "candidate_id",
          "keep",
          "title",
          "item_type",
          "review_lane",
          "category",
          "location",
          "manufacturer",
          "model_or_code",
          "source_quote",
          "confidence",
          "reason",
        ],
      },
    },
  },
  required: ["classifications"],
} as const;

function getTextFromResponse(response: Record<string, unknown>) {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  const output = Array.isArray(response.output) ? response.output : [];
  for (const outputItem of output) {
    if (!outputItem || typeof outputItem !== "object") continue;
    const content = Array.isArray((outputItem as { content?: unknown }).content)
      ? (outputItem as { content: unknown[] }).content
      : [];

    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== "object") continue;
      const text = (contentItem as { text?: unknown }).text;
      if (typeof text === "string") return text;
    }
  }

  return "";
}

function getTokenUsageFromResponse(response: Record<string, unknown>) {
  const usage = response.usage && typeof response.usage === "object"
    ? response.usage as Record<string, unknown>
    : {};

  return {
    inputTokens: typeof usage.input_tokens === "number" ? usage.input_tokens : undefined,
    outputTokens: typeof usage.output_tokens === "number" ? usage.output_tokens : undefined,
    totalTokens: typeof usage.total_tokens === "number" ? usage.total_tokens : undefined,
  };
}

function normalizeForQuoteMatch(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function getMeaningfulTitleTokens(title: string) {
  const stopWords = new Set([
    "and",
    "the",
    "with",
    "from",
    "into",
    "item",
    "items",
    "system",
    "systems",
    "finish",
    "finishes",
  ]);

  return Array.from(new Set(title.toLowerCase().match(/[a-z0-9]+/g) || []))
    .filter((token) => token.length >= 4 && !stopWords.has(token));
}

function hasUsefulIdentifier(classification: SpecLlmClassification) {
  return Boolean(classification.manufacturer.trim() && classification.model_or_code.trim());
}

function normalizeReviewLane(classification: SpecLlmClassification): SpecReviewLane {
  if (classification.review_lane === "needs_model_or_code" && hasUsefulIdentifier(classification)) {
    return "admin_review";
  }

  return classification.review_lane;
}

function validateClassification(
  classification: SpecLlmClassification,
  candidateById: Map<string, SpecExtractionCandidate>,
): ValidatedSpecLlmClassification {
  const normalizedConfidence = classification.confidence > 0 && classification.confidence <= 1
    ? Math.round(classification.confidence * 100)
    : classification.confidence;
  const normalizedClassification = {
    ...classification,
    review_lane: validReviewLanes.has(classification.review_lane) ? normalizeReviewLane(classification) : classification.review_lane,
    confidence: normalizedConfidence,
  };
  const errors: string[] = [];
  const candidate = candidateById.get(normalizedClassification.candidate_id);

  if (!candidate) {
    errors.push("unknown_candidate_id");
  }

  if (!validItemTypes.has(normalizedClassification.item_type)) {
    errors.push("invalid_item_type");
  }

  if (!validReviewLanes.has(normalizedClassification.review_lane)) {
    errors.push("invalid_review_lane");
  }

  if (!Number.isFinite(normalizedClassification.confidence) || normalizedClassification.confidence < 0 || normalizedClassification.confidence > 100) {
    errors.push("invalid_confidence");
  }

  if (normalizedClassification.keep && !normalizedClassification.title.trim()) {
    errors.push("missing_title");
  }

  if (normalizedClassification.keep && !normalizedClassification.source_quote.trim()) {
    errors.push("missing_source_quote");
  }

  if (candidate && normalizedClassification.source_quote.trim()) {
    const source = normalizeForQuoteMatch(candidate.source_text);
    const quote = normalizeForQuoteMatch(normalizedClassification.source_quote);
    if (!source.includes(quote) && !quote.includes(source.slice(0, Math.min(source.length, 80)))) {
      errors.push("source_quote_not_grounded");
    }
  }

  if (normalizedClassification.keep && normalizedClassification.item_type === "note") {
    errors.push("kept_note_item_type");
  }

  if (candidate && normalizedClassification.keep && normalizedClassification.item_type === "product") {
    const titleTokens = getMeaningfulTitleTokens(normalizedClassification.title);
    const source = normalizeForQuoteMatch(`${candidate.source_text} ${normalizedClassification.source_quote}`);
    const supported = titleTokens.length === 0 || titleTokens.some((token) => source.includes(token));

    if (!supported) {
      errors.push("title_not_supported_by_source");
    }
  }

  const recommended_action = reviewLaneToRecommendedAction(normalizedClassification.review_lane);

  return {
    ...normalizedClassification,
    accepted: errors.length === 0,
    validation_errors: errors,
    recommended_action,
  };
}

function buildPrompt(candidates: SpecExtractionCandidate[]) {
  return [
    "Classify builder handover specification candidates. You are a source-grounded second-pass classifier after Docling OCR and deterministic cleanup.",
    "Do not invent products, model numbers, brands, locations, warranties, or maintenance requirements.",
    "Use only each candidate's source_text. source_quote must be an exact substring from source_text whenever keep=true.",
    "A single source_text may contain more than one real handover item because OCR/table rows can merge adjacent items. When that happens, emit multiple classification objects with the same candidate_id: one per distinct real item, each with its own title, category, source_quote, lane, and reason.",
    "If a row describes a real product/finish/system but lacks enough supplier/model/source detail for homeowner handover, keep=true and use the most specific incomplete lane.",
    "Use needs_model_or_code only when a product/system/fixture still lacks a brand, supplier, model, SKU, product code, or similarly searchable identifier.",
    "If the source already includes both a manufacturer/supplier and model/code, do not use needs_model_or_code; use admin_review unless it clearly matches an existing known item.",
    "Use needs_builder_context for selected/Builder's-range/as-per/TBC rows needing builder confirmation before source search.",
    "A valid handover item is a specific product, finish, fixture, system, material, appliance, maintenance task, or specific source document needed for such an item.",
    "Broad administrative/supporting-document bundles are NOT valid checklist items. For rows like 'Producer statements and code compliance documents', CCC/PS document packages, consent closeout lists, or generic certificate bundles, set keep=false and item_type=note.",
    "Use needs_source_document only when a real specific product/system/finish/fixture is present and needs an attached quote, manual, warranty, certificate, producer statement, or other source document.",
    "Prefer review_lane=general_finish for tiles, paint, carpet/flooring, doors/hardware where supplier/range/colour/location should be confirmed but warranty docs may not be required.",
    "Use keep=false and item_type=note for pure admin/legal/noise/repeated headings or broad non-item document/admin bundles; do not drop incomplete real handover items.",
    "Do not trust deterministic_confidence as evidence of completeness. It is only a rule-match score.",
    "Return JSON only matching the schema.",
    "",
    "Candidates:",
    JSON.stringify(
      candidates.map((candidate) => ({
        candidate_id: candidate.id,
        source_text: candidate.source_text,
        nearby_heading: candidate.nearby_heading,
        deterministic_title: candidate.deterministic_title,
        deterministic_category: candidate.deterministic_category,
        deterministic_action: candidate.deterministic_action,
        deterministic_confidence: candidate.deterministic_confidence,
        llm_reason: candidate.llm_reason,
      })),
      null,
      2,
    ),
  ].join("\n");
}


function isRetryableOpenAiStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postOpenAiResponsesWithRetry(input: {
  apiKey: string;
  model: string;
  prompt: string;
  candidateCount: number;
}) {
  const maxAttempts = parsePositiveInteger(process.env.OPENAI_SPEC_CLASSIFIER_RETRY_ATTEMPTS, 3);
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        input: [
          {
            role: "system",
            content: "You classify source-grounded builder handover extraction candidates for human review.",
          },
          {
            role: "user",
            content: input.prompt,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "spec_candidate_classification",
            strict: true,
            schema: specLlmSchema,
          },
        },
      }),
    });

    if (response.ok) {
      return (await response.json()) as Record<string, unknown>;
    }

    const detail = await response.text().catch(() => "");
    lastError = `OpenAI spec classification failed with status ${response.status}: ${detail.slice(0, 500)}`;

    if (!isRetryableOpenAiStatus(response.status) || attempt === maxAttempts) {
      throw new Error(lastError);
    }

    console.warn("Retrying OpenAI spec classification after transient response", {
      status: response.status,
      attempt,
      maxAttempts,
      candidateCount: input.candidateCount,
    });
    await sleep(750 * attempt);
  }

  throw new Error(lastError || "OpenAI spec classification failed before a response was returned.");
}

export async function classifySpecCandidatesWithOpenAi(input: {
  candidates: SpecExtractionCandidate[];
  apiKey?: string;
  model?: string;
}): Promise<SpecLlmClassifyResult> {
  const apiKey = input.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for LLM spec classification.");
  }

  const model = input.model || process.env.OPENAI_SPEC_CLASSIFIER_MODEL || process.env.OPENAI_EXTRACTION_MODEL || "gpt-5.1-mini";
  const candidates = input.candidates.filter((candidate) => candidate.needs_llm);
  const prompt = buildPrompt(candidates);

  const body = await postOpenAiResponsesWithRetry({
    apiKey,
    model,
    prompt,
    candidateCount: candidates.length,
  });
  const text = getTextFromResponse(body);
  if (!text) {
    throw new Error("OpenAI spec classification returned no output_text.");
  }

  const parsed = JSON.parse(text) as { classifications?: SpecLlmClassification[] };
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const classifications = (parsed.classifications || []).map((classification) =>
    validateClassification(classification, candidateById),
  );

  return {
    provider: "openai",
    model,
    sentCandidateCount: candidates.length,
    acceptedCount: classifications.filter((classification) => classification.accepted).length,
    rejectedCount: classifications.filter((classification) => !classification.accepted).length,
    tokenUsage: getTokenUsageFromResponse(body),
    sentCandidateIds: candidates.map((candidate) => candidate.id),
    classifications,
  };
}

function getStructuredEvidenceValue(text: string, label: string) {
  const match = text.match(new RegExp(`${label}:\s*([^\n]+)`, "i"));
  return match?.[1]?.trim() || "";
}

function buildLlmEnhancedEvidence(input: {
  proposal: ProposedSpecItem;
  classification: ValidatedSpecLlmClassification;
  preferClassificationQuote?: boolean;
}) {
  const { proposal, classification } = input;
  const manufacturer = classification.manufacturer || (input.preferClassificationQuote ? "" : getStructuredEvidenceValue(proposal.extracted_text, "Manufacturer/Supplier"));
  const modelOrCode = classification.model_or_code || (input.preferClassificationQuote ? "" : getStructuredEvidenceValue(proposal.extracted_text, "ProductCode"));
  const finish = input.preferClassificationQuote ? "" : getStructuredEvidenceValue(proposal.extracted_text, "Finish");
  const size = input.preferClassificationQuote ? "" : getStructuredEvidenceValue(proposal.extracted_text, "Size");
  const evidenceText = input.preferClassificationQuote
    ? classification.source_quote || proposal.source_snippet || proposal.extracted_text
    : proposal.source_snippet || classification.source_quote || proposal.extracted_text;
  const description = cleanEvidenceText(evidenceText);

  return [
    `Name: ${classification.title || proposal.title}`,
    manufacturer ? `Manufacturer/Supplier: ${manufacturer}` : "",
    modelOrCode ? `ProductCode: ${modelOrCode}` : "",
    finish ? `Finish: ${finish}` : "",
    size ? `Size: ${size}` : "",
    `Category: ${classification.category || proposal.category}`,
    classification.location || proposal.location ? `Location: ${classification.location || proposal.location}` : "",
    `Description: ${description}`,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 1_500);
}

function groupAcceptedClassificationsByCandidateId(classifications: ValidatedSpecLlmClassification[]) {
  const grouped = new Map<string, ValidatedSpecLlmClassification[]>();
  for (const classification of classifications) {
    if (!classification.accepted) continue;
    const existing = grouped.get(classification.candidate_id) || [];
    existing.push(classification);
    grouped.set(classification.candidate_id, existing);
  }
  return grouped;
}

export function applySpecLlmClassifications(
  proposals: ProposedSpecItem[],
  candidates: SpecExtractionCandidate[],
  classifications: ValidatedSpecLlmClassification[],
): ProposedSpecItem[] {
  const classificationsByCandidateId = groupAcceptedClassificationsByCandidateId(classifications);

  return proposals.flatMap((proposal, index) => {
    const candidate = candidates[index];
    const candidateClassifications = candidate ? classificationsByCandidateId.get(candidate.id) : undefined;

    if (!candidateClassifications?.length) {
      return [proposal];
    }

    const keptClassifications = candidateClassifications.filter((classification) =>
      classification.keep && classification.item_type !== "note" && classification.confidence >= 50,
    );

    if (keptClassifications.length === 0) {
      return [];
    }

    const splitSourceRow = keptClassifications.length > 1;

    return keptClassifications.map((classification) => ({
      ...proposal,
      item_type: classification.item_type as ProposedSpecItem["item_type"],
      title: classification.title || proposal.title,
      category: classification.category || proposal.category,
      location: classification.location || proposal.location,
      extracted_text: cleanStructuredEvidenceText(buildLlmEnhancedEvidence({
        proposal,
        classification,
        preferClassificationQuote: splitSourceRow,
      })),
      source_snippet: cleanEvidenceText(splitSourceRow ? classification.source_quote : proposal.source_snippet || classification.source_quote),
      llm_review_lane: classification.review_lane,
      llm_review_reason: classification.reason,
      confidence_score: Math.max(0, Math.min(100, Math.round(classification.confidence))),
      recommended_action: classification.recommended_action,
    }));
  });
}

function chunkCandidates<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readLocalEnvValue(key: string) {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    return undefined;
  }

  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((candidate) => candidate.trim().startsWith(`${key}=`));
  return line?.split("=").slice(1).join("=").trim();
}

function parseClassifierLimitConfig() {
  const envLimit = parsePositiveInteger(process.env.OPENAI_SPEC_CLASSIFIER_LIMIT, 200);
  const localEnvLimit = parsePositiveInteger(readLocalEnvValue("OPENAI_SPEC_CLASSIFIER_LIMIT"), envLimit);
  const batchSize = parsePositiveInteger(process.env.OPENAI_SPEC_CLASSIFIER_BATCH_SIZE, 20);
  const maxCandidates = Math.max(envLimit, localEnvLimit);

  return {
    maxCandidates,
    batchSize,
    envLimit,
    localEnvLimit,
  };
}

function combineLlmResults(results: SpecLlmClassifyResult[]): SpecLlmClassifyResult {
  const first = results[0];
  return {
    provider: "openai",
    model: first?.model || process.env.OPENAI_SPEC_CLASSIFIER_MODEL || process.env.OPENAI_EXTRACTION_MODEL || "gpt-5.1-mini",
    sentCandidateCount: results.reduce((sum, result) => sum + result.sentCandidateCount, 0),
    acceptedCount: results.reduce((sum, result) => sum + result.acceptedCount, 0),
    rejectedCount: results.reduce((sum, result) => sum + result.rejectedCount, 0),
    tokenUsage: {
      inputTokens: results.reduce((sum, result) => sum + (result.tokenUsage.inputTokens || 0), 0),
      outputTokens: results.reduce((sum, result) => sum + (result.tokenUsage.outputTokens || 0), 0),
      totalTokens: results.reduce((sum, result) => sum + (result.tokenUsage.totalTokens || 0), 0),
    },
    sentCandidateIds: results.flatMap((result) => result.sentCandidateIds),
    classifications: results.flatMap((result) => result.classifications),
  };
}

export async function maybeEnhanceSpecificationProposalsWithLlm(proposals: ProposedSpecItem[]) {
  const candidates = buildSpecExtractionCandidates(proposals);

  if (process.env.OPENAI_SPEC_CLASSIFIER_ENABLED === "false" || !process.env.OPENAI_API_KEY) {
    return {
      proposedItems: proposals,
      candidates,
      llmResult: null,
    };
  }

  const { maxCandidates, batchSize, envLimit, localEnvLimit } = parseClassifierLimitConfig();
  const selectedCandidates = candidates
    .filter((candidate) => candidate.needs_llm)
    .sort((a, b) => b.spend_priority - a.spend_priority || a.id.localeCompare(b.id))
    .slice(0, Math.max(1, maxCandidates));

  console.info("Spec LLM classifier config", {
    envLimit,
    localEnvLimit,
    maxCandidates,
    batchSize,
    eligibleCount: candidates.filter((candidate) => candidate.needs_llm).length,
    selectedCount: selectedCandidates.length,
  });

  if (selectedCandidates.length === 0) {
    return {
      proposedItems: proposals,
      candidates,
      llmResult: null,
    };
  }

  const batchResults: SpecLlmClassifyResult[] = [];
  for (const batch of chunkCandidates(selectedCandidates, batchSize)) {
    batchResults.push(await classifySpecCandidatesWithOpenAi({ candidates: batch }));
  }
  const llmResult = combineLlmResults(batchResults);

  return {
    proposedItems: applySpecLlmClassifications(proposals, candidates, llmResult.classifications),
    candidates,
    llmResult,
  };
}
