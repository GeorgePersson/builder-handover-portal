import type { SpecReviewLane } from "@/lib/ai/spec-classify";
import { reviewLaneToRecommendedAction } from "@/lib/ai/spec-classify";
import { buildSpecExtractionCandidates, type SpecExtractionCandidate } from "@/lib/ai/spec-candidates";
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

function validateClassification(
  classification: SpecLlmClassification,
  candidateById: Map<string, SpecExtractionCandidate>,
): ValidatedSpecLlmClassification {
  const normalizedConfidence = classification.confidence > 0 && classification.confidence <= 1
    ? Math.round(classification.confidence * 100)
    : classification.confidence;
  const normalizedClassification = {
    ...classification,
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
    "Prefer review_lane=general_finish for tiles, paint, carpet/flooring, doors/hardware where warranty docs may not be required and builder selection confirmation is enough.",
    "Use needs_builder_context for selected/Builder's-range/as-per/TBC rows needing confirmation before source search.",
    "Use needs_model_or_code for fixtures, appliances, tapware, electrical, plumbing, heating/cooling that need a brand/model/SKU before useful source lookup.",
    "Use needs_source_document only when the source references a quote, manual, warranty, certificate, producer statement, or source document.",
    "Use keep=false and item_type=note for pure notes/admin/noise.",
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

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: "You classify source-grounded builder handover extraction candidates for human review.",
        },
        {
          role: "user",
          content: prompt,
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

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI spec classification failed with status ${response.status}: ${detail.slice(0, 500)}`);
  }

  const body = (await response.json()) as Record<string, unknown>;
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
    classifications,
  };
}

export function applySpecLlmClassifications(
  proposals: ProposedSpecItem[],
  candidates: SpecExtractionCandidate[],
  classifications: ValidatedSpecLlmClassification[],
): ProposedSpecItem[] {
  const classificationByCandidateId = new Map(
    classifications
      .filter((classification) => classification.accepted)
      .map((classification) => [classification.candidate_id, classification]),
  );

  return proposals.flatMap((proposal, index) => {
    const candidate = candidates[index];
    const classification = candidate ? classificationByCandidateId.get(candidate.id) : undefined;

    if (!classification) {
      return [proposal];
    }

    if (!classification.keep || classification.item_type === "note") {
      return [];
    }

    if (classification.confidence < 50) {
      return [proposal];
    }

    return [
      {
        ...proposal,
        item_type: classification.item_type,
        title: classification.title || proposal.title,
        category: classification.category || proposal.category,
        location: classification.location || proposal.location,
        extracted_text: [
          `Name: ${classification.title || proposal.title}`,
          classification.manufacturer ? `Manufacturer/Supplier: ${classification.manufacturer}` : "",
          classification.model_or_code ? `ProductCode: ${classification.model_or_code}` : "",
          `Category: ${classification.category || proposal.category}`,
          classification.location ? `Location: ${classification.location}` : "",
          `Description: ${classification.source_quote || proposal.extracted_text}`,
          `LLMReviewReason: ${classification.reason}`,
        ]
          .filter(Boolean)
          .join("\n")
          .slice(0, 1_500),
        source_snippet: classification.source_quote || proposal.source_snippet,
        confidence_score: Math.max(0, Math.min(100, Math.round(classification.confidence))),
        recommended_action: classification.recommended_action,
      },
    ];
  });
}

export async function maybeEnhanceSpecificationProposalsWithLlm(proposals: ProposedSpecItem[]) {
  const candidates = buildSpecExtractionCandidates(proposals);

  if (process.env.OPENAI_SPEC_CLASSIFIER_ENABLED !== "true" || !process.env.OPENAI_API_KEY) {
    return {
      proposedItems: proposals,
      candidates,
      llmResult: null,
    };
  }

  const maxCandidates = Number.parseInt(process.env.OPENAI_SPEC_CLASSIFIER_LIMIT || "30", 10);
  const selectedCandidates = candidates
    .filter((candidate) => candidate.needs_llm)
    .slice(0, Math.max(1, maxCandidates));

  if (selectedCandidates.length === 0) {
    return {
      proposedItems: proposals,
      candidates,
      llmResult: null,
    };
  }

  const llmResult = await classifySpecCandidatesWithOpenAi({ candidates: selectedCandidates });

  return {
    proposedItems: applySpecLlmClassifications(proposals, candidates, llmResult.classifications),
    candidates,
    llmResult,
  };
}
