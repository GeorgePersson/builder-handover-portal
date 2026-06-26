import type { ProposedSpecItem } from "@/lib/ai/spec-extract";
import { cleanEvidenceText, cleanStructuredEvidenceText, hasLikelyDirtyOcrText } from "@/lib/ai/spec-normalize";
import { auditVisibleSpecItems, getVisibleQualityFailureText, type SpecQualityAuditSummary } from "@/lib/ai/spec-quality-audit";

type FinalCleanupRisk = "low" | "medium" | "high";

type RawFinalCleanupItem = {
  item_index: number;
  extracted_text: string;
  source_snippet: string;
  corrections: string[];
  risk: FinalCleanupRisk;
  confidence: number;
};

export type FinalEvidenceCleanupResult = {
  enabled: boolean;
  dirtyBeforeCount: number;
  sentCount: number;
  acceptedCount: number;
  rejectedCount: number;
  repairRetrySentCount: number;
  repairRetryAcceptedCount: number;
  llmProofreadSentCount: number;
  llmProofreadAcceptedCount: number;
  dirtyAfterCount: number;
  errors: string[];
  mode: "all" | "dirty" | "off";
  unresolvedQualityCount: number;
  qualityAudit: SpecQualityAuditSummary | null;
  tokenUsage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
};

const finalCleanupSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          item_index: { type: "number" },
          extracted_text: { type: "string" },
          source_snippet: { type: "string" },
          corrections: { type: "array", items: { type: "string" } },
          risk: { type: "string", enum: ["low", "medium", "high"] },
          confidence: { type: "number" },
        },
        required: ["item_index", "extracted_text", "source_snippet", "corrections", "risk", "confidence"],
      },
    },
  },
  required: ["items"],
} as const;

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getTextFromResponse(response: Record<string, unknown>) {
  if (typeof response.output_text === "string") return response.output_text;
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
  const usage = response.usage && typeof response.usage === "object" ? response.usage as Record<string, unknown> : {};
  return {
    inputTokens: typeof usage.input_tokens === "number" ? usage.input_tokens : undefined,
    outputTokens: typeof usage.output_tokens === "number" ? usage.output_tokens : undefined,
    totalTokens: typeof usage.total_tokens === "number" ? usage.total_tokens : undefined,
  };
}

function addUsage(a: FinalEvidenceCleanupResult["tokenUsage"], b: FinalEvidenceCleanupResult["tokenUsage"]) {
  return {
    inputTokens: (a.inputTokens || 0) + (b.inputTokens || 0) || undefined,
    outputTokens: (a.outputTokens || 0) + (b.outputTokens || 0) || undefined,
    totalTokens: (a.totalTokens || 0) + (b.totalTokens || 0) || undefined,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableOpenAiStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

async function postOpenAiFinalCleanup(input: { apiKey: string; model: string; prompt: string; itemCount: number }) {
  const maxAttempts = parsePositiveInteger(process.env.OPENAI_SPEC_FINAL_CLEANUP_RETRY_ATTEMPTS, 3);
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
          { role: "system", content: "You repair OCR/readability errors in already-extracted builder handover item evidence. You do not add facts." },
          { role: "user", content: input.prompt },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "spec_final_evidence_cleanup",
            strict: true,
            schema: finalCleanupSchema,
          },
        },
      }),
    });
    if (response.ok) return (await response.json()) as Record<string, unknown>;
    const detail = await response.text().catch(() => "");
    lastError = `OpenAI final evidence cleanup failed with status ${response.status}: ${detail.slice(0, 300)}`;
    if (!isRetryableOpenAiStatus(response.status) || attempt === maxAttempts) throw new Error(lastError);
    console.warn("Retrying OpenAI final evidence cleanup after transient response", {
      status: response.status,
      attempt,
      maxAttempts,
      itemCount: input.itemCount,
    });
    await sleep(750 * attempt);
  }
  throw new Error(lastError || "OpenAI final evidence cleanup failed before a response was returned.");
}

function buildPrompt(items: Array<{ item_index: number; extracted_text: string; source_snippet: string }>) {
  return [
    "Repair OCR spacing/readability errors in these final extracted handover item fields.",
    "This is a final quality gate before saving review rows.",
    "Do not add or remove product facts, brands, model numbers, dimensions, quantities, locations, warranties, or requirements.",
    "Do fix glued words, missing spaces, split words, obvious OCR letter drops when context makes the word clear, repeated accidental words, and punctuation spacing.",
    "Examples of allowed repairs: 'Cus to msize' -> 'Custom size', 'Waterproofmembraneunder' -> 'Waterproof membrane under', 'laidontimber' -> 'laid on timber', 'inginwetareas' -> 'in wet areas', 'veneerlaminated' -> 'veneer laminated', 'astructuralplybase' -> 'a structural ply base', 'Whitefaceplates' -> 'White faceplates', 'PDL Jconic Series' -> 'PDL Iconic Series', 'forarchitraves' -> 'for architraves', 'Insinkera tor' -> 'Insinkerator', 'Concealedwiring' -> 'Concealed wiring'.",
    "If a correction would require guessing, leave that wording unchanged and set risk=high.",
    "Preserve structured labels and line breaks in extracted_text.",
    "Return one item per input item_index. JSON only.",
    "",
    JSON.stringify(items, null, 2),
  ].join("\n");
}

function buildStrictProofreadPrompt(items: Array<{ item_index: number; extracted_text: string; source_snippet: string }>) {
  return [
    "Strictly proofread EVERY final builder handover evidence row below before it is saved.",
    "You are not looking for a predefined list of bad words. Read the row as natural building-specification text and repair any OCR/readability errors you can confidently infer from context.",
    "Fix glued words, split words, OCR spelling mistakes, missing spaces, punctuation spacing, and diagnostic/internal lines.",
    "Do not invent new product facts, brands, model numbers, dimensions, quantities, locations, warranties, or requirements.",
    "If a row is already readable, return it unchanged with risk=low and confidence high.",
    "If any correction would be a guess, keep that wording unchanged and set risk=high.",
    "Preserve structured labels and line breaks in extracted_text. Return one item per input item_index. JSON only.",
    "",
    JSON.stringify(items, null, 2),
  ].join("\n");
}

function buildRepairRetryPrompt(items: Array<{ item_index: number; extracted_text: string; source_snippet: string; quality_issues: string[]; examples: string[] }>) {
  return [
    "These final extracted handover evidence rows failed a generic readability audit after the normal cleanup pass.",
    "Repair ONLY OCR spacing/readability errors that are evident from the text itself.",
    "Common failure classes include glued prepositions/directions such as mountedonleftsidewall, slidesfromrighttoleftwhenfacingdoor, and shelftobemountedonrearwall, plus split custom-size text such as Cus to msize.",
    "Do not add or remove product facts, brands, model numbers, dimensions, quantities, locations, warranties, or requirements.",
    "If the row cannot be confidently repaired without guessing, leave the wording unchanged and set risk=high.",
    "Preserve structured labels and line breaks in extracted_text.",
    "Return one item per input item_index. JSON only.",
    "",
    JSON.stringify(items, null, 2),
  ].join("\n");
}

function isAcceptableCleanup(original: ProposedSpecItem, cleaned: RawFinalCleanupItem) {
  const errors: string[] = [];
  if (cleaned.risk === "high") errors.push("high_risk_cleanup");
  if (!Number.isFinite(cleaned.confidence) || cleaned.confidence < 0 || cleaned.confidence > 100) errors.push("invalid_confidence");
  if (!cleaned.extracted_text.trim()) errors.push("missing_extracted_text");
  const originalCompact = `${original.extracted_text} ${original.source_snippet || ""}`.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const cleanedCompact = `${cleaned.extracted_text} ${cleaned.source_snippet || ""}`.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (cleanedCompact.length > Math.max(originalCompact.length * 1.35, originalCompact.length + 120)) errors.push("cleanup_too_long");
  for (const code of `${original.extracted_text} ${original.source_snippet || ""}`.match(/\b[A-Z]{1,5}\s?\d{2,6}[A-Z0-9.-]*\b|\b\d{4,6}[A-Z]{0,3}\d?\b/g) || []) {
    if (!cleanedCompact.includes(code.toLowerCase().replace(/[^a-z0-9]+/g, ""))) errors.push(`missing_source_code:${code}`);
  }
  return errors;
}

function getDescriptionField(text: string) {
  return text.match(/^Description:\s*(.+)$/im)?.[1]?.trim() || "";
}

function chooseFinalSourceSnippet(cleaned: RawFinalCleanupItem, target: ProposedSpecItem) {
  const cleanedSource = cleaned.source_snippet ? cleanEvidenceText(cleaned.source_snippet) : "";
  if (cleanedSource && !hasLikelyDirtyOcrText(cleanedSource)) {
    return cleanedSource;
  }

  const description = cleanEvidenceText(getDescriptionField(cleaned.extracted_text));
  if (description && !hasLikelyDirtyOcrText(description)) {
    return description;
  }

  return cleanedSource || target.source_snippet;
}

function deterministicFinalClean(items: ProposedSpecItem[]) {
  return items.map((item) => ({
    ...item,
    extracted_text: cleanStructuredEvidenceText(item.extracted_text || ""),
    source_snippet: item.source_snippet ? cleanEvidenceText(item.source_snippet) : undefined,
  }));
}

function compactForDedupe(text: string) {
  return cleanEvidenceText(text).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getFinalTitleFamily(item: ProposedSpecItem) {
  const titleCompact = compactForDedupe(item.title);
  const text = `${item.title} ${item.source_snippet || ""} ${item.extracted_text || ""}`;
  const compact = compactForDedupe(text);

  if (/waterproof.*membrane|membrane.*wet.*area|membrane.*tiles/.test(titleCompact)) return "waterproof-membrane";
  if (/engineered.*timber|timber.*veneer/.test(titleCompact)) return "engineered-timber-flooring";
  if (/cavity.*batten|accoya.*cladding|cladding.*accoya/.test(titleCompact)) return "cavity-batten-cladding";
  if (/wall.*tiling|tiling.*wall/.test(titleCompact)) return "wall-tiling";
  if (/shower/.test(titleCompact) && /newline|dryfit|niche|door|hardware|system|fitout/.test(compact)) return "shower-system";

  if (/waterproof.*membrane|membrane.*wet.*area|membrane.*tiles/.test(compact)) return "waterproof-membrane";
  if (/engineered.*timber|timber.*veneer/.test(compact)) return "engineered-timber-flooring";
  if (/cavity.*batten|accoya.*cladding|cladding.*accoya/.test(compact)) return "cavity-batten-cladding";
  if (/wall.*tiling|tiling.*wall/.test(compact)) return "wall-tiling";
  if (/shower/.test(compact) && /newline|dryfit|niche|door|hardware/.test(compact)) return "shower-system";

  return compactForDedupe(item.title);
}

function normalizeFinalItemCategory(item: ProposedSpecItem): ProposedSpecItem {
  const titleCompact = compactForDedupe(item.title);
  const text = `${item.title} ${item.source_snippet || ""} ${item.extracted_text || ""}`;
  const compact = compactForDedupe(text);

  if (/engineered.*timber|timber.*veneer/.test(titleCompact)) {
    return { ...item, category: "Flooring" };
  }
  if (/waterproof.*membrane|membrane.*wet.*area|membrane.*tiles/.test(titleCompact)) {
    return { ...item, category: "Waterproofing" };
  }
  if (/waterproof.*membrane|membrane.*wet.*area|membrane.*tiles/.test(compact) && !/engineered.*timber|timber.*veneer/.test(titleCompact)) {
    return { ...item, category: "Waterproofing" };
  }
  if (/wall.*tiling|tiling.*wall|splashback|ceramic.*tiles/.test(compact)) {
    return { ...item, category: "Tiles" };
  }
  if (/shower/.test(compact) && /newline|dryfit|niche|door|hardware/.test(compact)) {
    return { ...item, category: "Bathroom fixtures" };
  }
  if (/accoya|cavity.*batten|cladding|weatherboard/.test(compact)) {
    return { ...item, category: "Cladding" };
  }

  return item;
}

function preferFinalDuplicateCandidate(existing: ProposedSpecItem, candidate: ProposedSpecItem) {
  const existingScore = existing.confidence_score || 0;
  const candidateScore = candidate.confidence_score || 0;
  const existingLength = `${existing.extracted_text}\n${existing.source_snippet || ""}`.length;
  const candidateLength = `${candidate.extracted_text}\n${candidate.source_snippet || ""}`.length;
  const existingAdminReview = existing.recommended_action === "review_new_product" || existing.recommended_action === "attach_existing_product";
  const candidateAdminReview = candidate.recommended_action === "review_new_product" || candidate.recommended_action === "attach_existing_product";

  if (candidateAdminReview && !existingAdminReview) return candidate;
  if (candidateScore > existingScore) return candidate;
  if (candidateScore === existingScore && candidateLength > existingLength) return candidate;
  return existing;
}

function dedupeFinalItems(items: ProposedSpecItem[]) {
  const byKey = new Map<string, ProposedSpecItem>();
  const order: string[] = [];

  for (const rawItem of items) {
    const item = normalizeFinalItemCategory(rawItem);
    const sourceKey = compactForDedupe(item.source_snippet || item.extracted_text).slice(0, 240);
    const familyKey = getFinalTitleFamily(item);
    const key = `${item.item_type}:${familyKey}:${sourceKey}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      order.push(key);
      continue;
    }

    byKey.set(key, preferFinalDuplicateCandidate(existing, item));
  }

  return order.map((key) => byKey.get(key)!).filter(Boolean);
}

export async function cleanFinalSpecificationEvidence(items: ProposedSpecItem[]): Promise<{
  items: ProposedSpecItem[];
  result: FinalEvidenceCleanupResult;
}> {
  let cleanedItems = dedupeFinalItems(deterministicFinalClean(items));
  const dirtyBeforeCount = items.filter((item) => hasLikelyDirtyOcrText(`${item.extracted_text}\n${item.source_snippet || ""}`)).length;
  const mode = (process.env.OPENAI_SPEC_FINAL_CLEANUP_MODE || "all").toLowerCase() as "all" | "dirty" | "off";
  const candidatePool = cleanedItems
    .map((item, item_index) => ({ item, item_index }))
    .filter(({ item }) => mode === "all" || hasLikelyDirtyOcrText(`${item.extracted_text}\n${item.source_snippet || ""}`));
  const limit = parsePositiveInteger(process.env.OPENAI_SPEC_FINAL_CLEANUP_LIMIT, 250);
  const cleanupCandidates = mode === "off" ? [] : candidatePool.slice(0, limit);

  const result: FinalEvidenceCleanupResult = {
    enabled: mode !== "off" && process.env.OPENAI_SPEC_FINAL_CLEANUP_ENABLED !== "false" && Boolean(process.env.OPENAI_API_KEY),
    dirtyBeforeCount,
    sentCount: 0,
    acceptedCount: 0,
    rejectedCount: 0,
    repairRetrySentCount: 0,
    repairRetryAcceptedCount: 0,
    llmProofreadSentCount: 0,
    llmProofreadAcceptedCount: 0,
    dirtyAfterCount: cleanedItems.filter((item) => hasLikelyDirtyOcrText(`${item.extracted_text}\n${item.source_snippet || ""}`)).length,
    errors: [],
    mode,
    unresolvedQualityCount: 0,
    qualityAudit: null,
    tokenUsage: {},
  };

  if (!result.enabled || cleanupCandidates.length === 0) {
    const qualityAudit = auditVisibleSpecItems(cleanedItems);
    result.qualityAudit = qualityAudit;
    result.unresolvedQualityCount = qualityAudit.needsHumanReviewCount + qualityAudit.needsCleanupCount;
    cleanedItems = cleanedItems.map((item, index) => ({
      ...item,
      quality_review_note: getVisibleQualityFailureText(qualityAudit.items[index]),
    }));
    return { items: cleanedItems, result };
  }

  const apiKey = process.env.OPENAI_API_KEY!;
  const model = process.env.OPENAI_SPEC_FINAL_CLEANUP_MODEL || process.env.OPENAI_SPEC_NORMALIZER_MODEL || process.env.OPENAI_EXTRACTION_MODEL || "gpt-5.1-mini";
  const batchSize = parsePositiveInteger(process.env.OPENAI_SPEC_FINAL_CLEANUP_BATCH_SIZE, 20);

  for (let index = 0; index < cleanupCandidates.length; index += batchSize) {
    const batch = cleanupCandidates.slice(index, index + batchSize);
    const payload = batch.map(({ item, item_index }) => ({
      item_index,
      extracted_text: item.extracted_text,
      source_snippet: item.source_snippet || "",
    }));
    result.sentCount += batch.length;
    try {
      const response = await postOpenAiFinalCleanup({ apiKey, model, prompt: buildPrompt(payload), itemCount: batch.length });
      result.tokenUsage = addUsage(result.tokenUsage, getTokenUsageFromResponse(response));
      const parsed = JSON.parse(getTextFromResponse(response)) as { items?: RawFinalCleanupItem[] };
      for (const raw of parsed.items || []) {
        const target = cleanedItems[raw.item_index];
        if (!target) {
          result.rejectedCount += 1;
          result.errors.push("unknown_item_index");
          continue;
        }
        const validationErrors = isAcceptableCleanup(target, raw);
        if (validationErrors.length > 0) {
          result.rejectedCount += 1;
          result.errors.push(...validationErrors);
          continue;
        }
        const cleanedExtractedText = cleanStructuredEvidenceText(raw.extracted_text);
        cleanedItems[raw.item_index] = {
          ...target,
          extracted_text: cleanedExtractedText,
          source_snippet: chooseFinalSourceSnippet({ ...raw, extracted_text: cleanedExtractedText }, target),
        };
        result.acceptedCount += 1;
      }
    } catch (error) {
      result.rejectedCount += batch.length;
      result.errors.push(error instanceof Error ? error.message : String(error));
      console.warn("Final evidence cleanup batch failed; saving deterministic cleanup for this batch", {
        itemCount: batch.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  cleanedItems = dedupeFinalItems(deterministicFinalClean(cleanedItems));

  const proofreadCandidates = cleanedItems
    .map((item, item_index) => ({ item, item_index }))
    .slice(0, limit);
  const proofreadEnabled = process.env.OPENAI_SPEC_FINAL_PROOFREAD_ENABLED !== "false";
  if (proofreadEnabled && proofreadCandidates.length > 0) {
    for (let index = 0; index < proofreadCandidates.length; index += batchSize) {
      const batch = proofreadCandidates.slice(index, index + batchSize);
      const payload = batch.map(({ item, item_index }) => ({
        item_index,
        extracted_text: item.extracted_text,
        source_snippet: item.source_snippet || "",
      }));
      result.sentCount += batch.length;
      result.llmProofreadSentCount += batch.length;
      try {
        const response = await postOpenAiFinalCleanup({ apiKey, model, prompt: buildStrictProofreadPrompt(payload), itemCount: batch.length });
        result.tokenUsage = addUsage(result.tokenUsage, getTokenUsageFromResponse(response));
        const parsed = JSON.parse(getTextFromResponse(response)) as { items?: RawFinalCleanupItem[] };
        for (const raw of parsed.items || []) {
          const target = cleanedItems[raw.item_index];
          if (!target) {
            result.rejectedCount += 1;
            result.errors.push("unknown_llm_proofread_item_index");
            continue;
          }
          const validationErrors = isAcceptableCleanup(target, raw);
          if (validationErrors.length > 0) {
            result.rejectedCount += 1;
            result.errors.push(...validationErrors.map((error) => `llm_proofread:${error}`));
            continue;
          }
          const cleanedExtractedText = cleanStructuredEvidenceText(raw.extracted_text);
          cleanedItems[raw.item_index] = {
            ...target,
            extracted_text: cleanedExtractedText,
            source_snippet: chooseFinalSourceSnippet({ ...raw, extracted_text: cleanedExtractedText }, target),
          };
          result.acceptedCount += 1;
          result.llmProofreadAcceptedCount += 1;
        }
      } catch (error) {
        result.rejectedCount += batch.length;
        result.errors.push(error instanceof Error ? `llm_proofread:${error.message}` : `llm_proofread:${String(error)}`);
        console.warn("Final evidence LLM proofread batch failed; deterministic audit will mark unresolved rows", {
          itemCount: batch.length,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  cleanedItems = dedupeFinalItems(deterministicFinalClean(cleanedItems));
  result.dirtyAfterCount = cleanedItems.filter((item) => hasLikelyDirtyOcrText(`${item.extracted_text}\n${item.source_snippet || ""}`)).length;
  let qualityAudit = auditVisibleSpecItems(cleanedItems);

  const repairRetryLimit = parsePositiveInteger(process.env.OPENAI_SPEC_FINAL_CLEANUP_REPAIR_RETRY_LIMIT, 40);
  const repairRetryCandidates = qualityAudit.items
    .filter((item) => item.status !== "pass")
    .slice(0, repairRetryLimit)
    .map((item) => ({ quality: item, item: cleanedItems[item.item_index] }))
    .filter(({ item }) => Boolean(item));

  if (repairRetryCandidates.length > 0) {
    for (let index = 0; index < repairRetryCandidates.length; index += batchSize) {
      const batch = repairRetryCandidates.slice(index, index + batchSize);
      const payload = batch.map(({ item, quality }) => ({
        item_index: quality.item_index,
        extracted_text: item.extracted_text,
        source_snippet: item.source_snippet || "",
        quality_issues: quality.issues,
        examples: quality.examples,
      }));
      result.sentCount += batch.length;
      result.repairRetrySentCount += batch.length;
      try {
        const response = await postOpenAiFinalCleanup({ apiKey, model, prompt: buildRepairRetryPrompt(payload), itemCount: batch.length });
        result.tokenUsage = addUsage(result.tokenUsage, getTokenUsageFromResponse(response));
        const parsed = JSON.parse(getTextFromResponse(response)) as { items?: RawFinalCleanupItem[] };
        for (const raw of parsed.items || []) {
          const target = cleanedItems[raw.item_index];
          if (!target) {
            result.rejectedCount += 1;
            result.errors.push("unknown_repair_retry_item_index");
            continue;
          }
          const validationErrors = isAcceptableCleanup(target, raw);
          if (validationErrors.length > 0) {
            result.rejectedCount += 1;
            result.errors.push(...validationErrors.map((error) => `repair_retry:${error}`));
            continue;
          }
          const cleanedExtractedText = cleanStructuredEvidenceText(raw.extracted_text);
          cleanedItems[raw.item_index] = {
            ...target,
            extracted_text: cleanedExtractedText,
            source_snippet: chooseFinalSourceSnippet({ ...raw, extracted_text: cleanedExtractedText }, target),
          };
          result.acceptedCount += 1;
          result.repairRetryAcceptedCount += 1;
        }
      } catch (error) {
        result.rejectedCount += batch.length;
        result.errors.push(error instanceof Error ? `repair_retry:${error.message}` : `repair_retry:${String(error)}`);
        console.warn("Final evidence repair retry batch failed; unresolved rows will be marked for manual cleanup", {
          itemCount: batch.length,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    cleanedItems = dedupeFinalItems(deterministicFinalClean(cleanedItems));
    result.dirtyAfterCount = cleanedItems.filter((item) => hasLikelyDirtyOcrText(`${item.extracted_text}\n${item.source_snippet || ""}`)).length;
    qualityAudit = auditVisibleSpecItems(cleanedItems);
  }

  result.qualityAudit = qualityAudit;
  result.unresolvedQualityCount = qualityAudit.needsHumanReviewCount + qualityAudit.needsCleanupCount;
  cleanedItems = cleanedItems.map((item, index) => ({
    ...item,
    quality_review_note: getVisibleQualityFailureText(qualityAudit.items[index]),
  }));
  return { items: cleanedItems, result };
}
