import { cleanEvidenceText, splitTableCells } from "@/lib/ai/spec-normalize";

export type SpecTextNormalizationRisk = "low" | "medium" | "high";

export type SpecTextNormalizationRow = {
  row_id: string;
  source_text: string;
  normalized_text: string;
  corrections: string[];
  risk: SpecTextNormalizationRisk;
  confidence: number;
  accepted: boolean;
  validation_errors: string[];
};

export type SpecTextNormalizationResult = {
  provider: "openai";
  model: string;
  inputRowCount: number;
  selectedRowCount: number;
  acceptedCount: number;
  rejectedCount: number;
  tokenUsage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  rows: SpecTextNormalizationRow[];
};

type RawNormalizationRow = {
  row_id: string;
  source_text: string;
  normalized_text: string;
  corrections: string[];
  risk: SpecTextNormalizationRisk;
  confidence: number;
};

type SourceRow = {
  row_id: string;
  source_text: string;
  raw_line: string;
  cells: string[];
};

const normalizationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          row_id: { type: "string" },
          source_text: { type: "string" },
          normalized_text: { type: "string" },
          corrections: { type: "array", items: { type: "string" } },
          risk: { type: "string", enum: ["low", "medium", "high"] },
          confidence: { type: "number" },
        },
        required: ["row_id", "source_text", "normalized_text", "corrections", "risk", "confidence"],
      },
    },
  },
  required: ["rows"],
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

function isRetryableOpenAiStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractMarkdownTableLines(text: string): SourceRow[] {
  const rows: SourceRow[] = [];
  let index = 1;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|") || /^\|?[\s|:-]+\|?$/.test(trimmed)) continue;

    const cells = splitTableCells(line);
    if (cells.length < 2) continue;

    const sourceText = cells.join(" | ");
    if (sourceText.length < 20) continue;

    rows.push({
      row_id: `row_${String(index).padStart(3, "0")}`,
      source_text: sourceText,
      raw_line: line,
      cells,
    });
    index += 1;
  }

  return rows;
}

function rowLooksMessy(row: SourceRow) {
  const text = row.source_text;
  return /[a-z]{6,}(?:under|over|with|from|into|onto|and|the|for|floor|wall|door|to|be)[a-z]{3,}/i.test(text) ||
    /[a-z][A-Z]/.test(text) ||
    /\b(?:stand\s+ing|free\s+stand\s+ing|rein\s+for\s+ced|the\s+rmostat|Cus\s+to\s+msize|Custom\s+msize)\b/i.test(text) ||
    /\b\d+\s*l[a-z]{8,}\b/i.test(text) ||
    /\bkwelement\b/i.test(text) ||
    /\bthroostat\b/i.test(text) ||
    /\b[a-z]{7,}(?:electric|pressure|element|thermostat|connection|powerpoint)\b/i.test(text) ||
    /\b(?:ihen|cullery|ining|ounge|aundry|nsuitbed)\b/i.test(text) ||
    /\b(?:tobe|onsiteby|laidontimber|inginwetareas|Panelsfront|shelfon|neds|undersi(?:de)?of|multitap|Heatedmirrors|xdownlights?|availableasan|extracostupgrade|lightfeaturesan|switcheson|itdetects|withoutdisturbing|outdisturbing|accessoriesthat|cleverefficiency|Winnerof|lconicrange|isfuture-proofed|connectivityoptions|smarthome|USBcharging|Bluetoothconnectivity|makeliving|modernconnected)\b/i.test(text) ||
    /[A-Za-z]&[A-Za-z]/.test(text) ||
    /\s{2,}/.test(text);
}

function messyPriority(row: SourceRow) {
  const text = row.source_text;
  if (/\b(?:stand\s+ing|free\s+stand\s+ing|rein\s+for\s+ced|the\s+rmostat|throostat|kwelement|LLMReviewLane|LLMReviewReason)\b/i.test(text) || /\b\d+\s*l[a-z]{8,}\b/i.test(text)) return 0;
  if (/\b(?:hot\s*water|cylinder|electrical|powerpoint|connection|thermostat|shower|waterproof|heating|air\s*conditioning)\b/i.test(text)) return 1;
  return 2;
}

function selectRowsForNormalization(rows: SourceRow[]) {
  const limit = parsePositiveInteger(process.env.OPENAI_SPEC_NORMALIZER_LIMIT, 200);
  const mode = (process.env.OPENAI_SPEC_NORMALIZER_MODE || "all").toLowerCase();
  if (mode === "off") return [];
  const selectedRows = mode === "messy" ? rows.filter(rowLooksMessy) : rows;
  return selectedRows.sort((a, b) => messyPriority(a) - messyPriority(b) || a.row_id.localeCompare(b.row_id)).slice(0, limit);
}

function normalizeForComparison(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function extractCodes(text: string) {
  return Array.from(new Set(text.match(/\b[A-Z]{1,5}\s?\d{2,6}[A-Z0-9.-]*\b|\b\d{4,6}[A-Z]{0,3}\d?\b/g) || []));
}

export function validateTextNormalizationRow(row: RawNormalizationRow, sourceById: Map<string, SourceRow>): SpecTextNormalizationRow {
  const errors: string[] = [];
  const source = sourceById.get(row.row_id);
  const confidence = row.confidence > 0 && row.confidence <= 1 ? Math.round(row.confidence * 100) : row.confidence;
  const normalizedText = cleanEvidenceText(row.normalized_text || "");

  if (!source) errors.push("unknown_row_id");
  if (!normalizedText) errors.push("missing_normalized_text");
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) errors.push("invalid_confidence");
  if (!["low", "medium", "high"].includes(row.risk)) errors.push("invalid_risk");

  if (source) {
    const sourceCompact = normalizeForComparison(source.source_text);
    const normalizedCompact = normalizeForComparison(normalizedText);
    if (normalizedCompact.length > Math.max(sourceCompact.length * 1.35, sourceCompact.length + 80)) {
      errors.push("normalized_text_too_long");
    }

    for (const code of extractCodes(source.source_text)) {
      if (!normalizedText.includes(code) && !normalizeForComparison(normalizedText).includes(normalizeForComparison(code))) {
        errors.push(`missing_source_code:${code}`);
      }
    }
  }

  if (row.risk === "high") errors.push("high_risk_rewrite");

  return {
    row_id: row.row_id,
    source_text: source?.source_text || row.source_text || "",
    normalized_text: normalizedText,
    corrections: Array.isArray(row.corrections) ? row.corrections.slice(0, 12) : [],
    risk: row.risk,
    confidence,
    accepted: errors.length === 0,
    validation_errors: errors,
  };
}

function buildPrompt(rows: SourceRow[]) {
  return [
    "Repair OCR spacing, obvious spelling, and punctuation in builder handover specification table rows.",
    "Do not invent products, brands, model numbers, dimensions, quantities, rooms, warranties, or requirements.",
    "Preserve all factual details, product codes, dimensions, quantities, brands, and locations.",
    "You may split glued words, fix split words such as 'Cus to msize' -> 'Custom size', fix obvious OCR misspellings, add missing spaces around punctuation/ampersands, and improve readability.",
    "If a rewrite would require guessing, keep the original wording and mark risk=high.",
    "Return one output row per input row. Keep source_text exactly as supplied. JSON only.",
    "Important: normalized_text must preserve table cell boundaries using ' | ' separators. Do not merge the whole row into one cell. Do not duplicate the same full row into multiple cells.",
    "",
    "Rows:",
    JSON.stringify(rows, null, 2),
  ].join("\n");
}

async function postOpenAiResponsesWithRetry(input: { apiKey: string; model: string; prompt: string; rowCount: number }) {
  const maxAttempts = parsePositiveInteger(process.env.OPENAI_SPEC_NORMALIZER_RETRY_ATTEMPTS, 3);
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
          { role: "system", content: "You repair OCR text for source-grounded construction specification extraction. You do not add facts." },
          { role: "user", content: input.prompt },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "spec_text_normalization",
            strict: true,
            schema: normalizationSchema,
          },
        },
      }),
    });

    if (response.ok) return (await response.json()) as Record<string, unknown>;

    const detail = await response.text().catch(() => "");
    lastError = `OpenAI spec text normalization failed with status ${response.status}: ${detail.slice(0, 500)}`;
    if (!isRetryableOpenAiStatus(response.status) || attempt === maxAttempts) throw new Error(lastError);
    console.warn("Retrying OpenAI spec text normalization after transient response", {
      status: response.status,
      attempt,
      maxAttempts,
      rowCount: input.rowCount,
    });
    await sleep(750 * attempt);
  }

  throw new Error(lastError || "OpenAI spec text normalization failed before a response was returned.");
}

function buildSafeReplacementLine(row: SpecTextNormalizationRow, source: SourceRow) {
  const normalizedCells = row.normalized_text
    .split("|")
    .map((cell) => cleanEvidenceText(cell))
    .filter(Boolean);

  const originalCells = source.cells.map((cell) => cleanEvidenceText(cell)).filter(Boolean);
  const originalCellCount = originalCells.length;
  const normalizedCellCount = normalizedCells.length;

  if (originalCellCount < 2 || normalizedCellCount < 2) return null;
  if (Math.abs(normalizedCellCount - originalCellCount) > 1) return null;

  const compactCells = normalizedCells.map((cell) => cell.toLowerCase().replace(/[^a-z0-9]+/g, ""));
  if (new Set(compactCells).size === 1 && compactCells[0].length > 20) return null;

  return `| ${normalizedCells.join(" | ")} |`;
}

function applyAcceptedNormalizations(text: string, rows: SpecTextNormalizationRow[], sourceById: Map<string, SourceRow>) {
  let output = text;
  for (const row of rows) {
    if (!row.accepted || row.normalized_text === row.source_text) continue;
    const source = sourceById.get(row.row_id);
    if (!source) continue;
    const replacementLine = buildSafeReplacementLine(row, source);
    if (!replacementLine) continue;
    output = output.replace(source.raw_line, replacementLine);
  }
  return output;
}

function combineResults(results: SpecTextNormalizationResult[]): SpecTextNormalizationResult {
  const first = results[0];
  return {
    provider: "openai",
    model: first?.model || process.env.OPENAI_SPEC_NORMALIZER_MODEL || process.env.OPENAI_EXTRACTION_MODEL || "gpt-5.1-mini",
    inputRowCount: first?.inputRowCount || 0,
    selectedRowCount: results.reduce((sum, result) => sum + result.selectedRowCount, 0),
    acceptedCount: results.reduce((sum, result) => sum + result.acceptedCount, 0),
    rejectedCount: results.reduce((sum, result) => sum + result.rejectedCount, 0),
    tokenUsage: {
      inputTokens: results.reduce((sum, result) => sum + (result.tokenUsage.inputTokens || 0), 0),
      outputTokens: results.reduce((sum, result) => sum + (result.tokenUsage.outputTokens || 0), 0),
      totalTokens: results.reduce((sum, result) => sum + (result.tokenUsage.totalTokens || 0), 0),
    },
    rows: results.flatMap((result) => result.rows),
  };
}

export async function normalizeSpecTextWithOpenAi(input: {
  text: string;
  apiKey?: string;
  model?: string;
}): Promise<{ text: string; normalizationResult: SpecTextNormalizationResult }> {
  const apiKey = input.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for LLM spec text normalization.");

  const model = input.model || process.env.OPENAI_SPEC_NORMALIZER_MODEL || process.env.OPENAI_EXTRACTION_MODEL || "gpt-5.1-mini";
  const sourceRows = extractMarkdownTableLines(input.text);
  const selectedRows = selectRowsForNormalization(sourceRows);
  const batchSize = parsePositiveInteger(process.env.OPENAI_SPEC_NORMALIZER_BATCH_SIZE, 20);

  if (selectedRows.length === 0) {
    return {
      text: input.text,
      normalizationResult: {
        provider: "openai",
        model,
        inputRowCount: sourceRows.length,
        selectedRowCount: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        tokenUsage: {},
        rows: [],
      },
    };
  }

  const batchResults: SpecTextNormalizationResult[] = [];
  for (let index = 0; index < selectedRows.length; index += batchSize) {
    const batch = selectedRows.slice(index, index + batchSize);
    try {
      const response = await postOpenAiResponsesWithRetry({
        apiKey,
        model,
        prompt: buildPrompt(batch),
        rowCount: batch.length,
      });
      const text = getTextFromResponse(response);
      if (!text) throw new Error("OpenAI spec text normalization returned no output_text.");

      const parsed = JSON.parse(text) as { rows?: RawNormalizationRow[] };
      const sourceById = new Map(batch.map((row) => [row.row_id, row]));
      const rows = (parsed.rows || []).map((row) => validateTextNormalizationRow(row, sourceById));
      batchResults.push({
        provider: "openai",
        model,
        inputRowCount: sourceRows.length,
        selectedRowCount: batch.length,
        acceptedCount: rows.filter((row) => row.accepted).length,
        rejectedCount: rows.filter((row) => !row.accepted).length,
        tokenUsage: getTokenUsageFromResponse(response),
        rows,
      });
    } catch (error) {
      console.warn("Spec text normalizer batch failed; continuing with raw rows for this batch", {
        rowCount: batch.length,
        error: error instanceof Error ? error.message : String(error),
      });
      batchResults.push({
        provider: "openai",
        model,
        inputRowCount: sourceRows.length,
        selectedRowCount: batch.length,
        acceptedCount: 0,
        rejectedCount: batch.length,
        tokenUsage: {},
        rows: batch.map((row) => ({
          row_id: row.row_id,
          source_text: row.source_text,
          normalized_text: row.source_text,
          corrections: [],
          risk: "high",
          confidence: 0,
          accepted: false,
          validation_errors: ["openai_batch_failed"],
        })),
      });
    }
  }

  const normalizationResult = combineResults(batchResults);
  const sourceById = new Map(sourceRows.map((row) => [row.row_id, row]));
  return {
    text: applyAcceptedNormalizations(input.text, normalizationResult.rows, sourceById),
    normalizationResult,
  };
}

export async function maybeNormalizeSpecTextWithLlm(text: string) {
  if (process.env.OPENAI_SPEC_NORMALIZER_ENABLED === "false" || !process.env.OPENAI_API_KEY) {
    return { text, normalizationResult: null };
  }

  return normalizeSpecTextWithOpenAi({ text });
}
