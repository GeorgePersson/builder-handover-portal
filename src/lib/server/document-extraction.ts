import type { ExtractedWorkflowItem, UploadedProjectDocument } from "@/lib/document-workflow";
import { redactDocumentText, type DocumentRedactionSummary } from "@/lib/server/document-redaction";
import { attachIdentityEvidence, type OpenAiTokenUsage } from "@/lib/server/extraction-usage";
import { extractPdfText } from "@/lib/server/pdf-extract";

type MockExtractionInput = {
  jobId: string;
  document: Pick<UploadedProjectDocument, "id" | "projectId" | "originalFilename" | "fileType" | "mimeType">;
  documentText?: string;
};

type MockExtractedItem = Omit<ExtractedWorkflowItem, "id" | "createdAt" | "updatedAt">;
type AiExtractedItem = {
  itemType?: "product" | "document" | "maintenance";
  productName?: string;
  brand?: string;
  model?: string;
  category?: string;
  supplier?: string;
  location?: string;
  warrantyText?: string;
  maintenanceText?: string;
  sourceEvidenceText?: string;
  missingFields?: string[];
  builderInfoNeeded?: string[];
  contextClassification?:
    | "source_ready"
    | "builder_input_needed"
    | "project_document"
    | "generic_allowance"
    | "admin_or_contract"
    | "not_handover_relevant";
  classificationReason?: string;
  confidenceScore?: number;
};
type OpenAiExtractionCallResult = {
  items: AiExtractedItem[];
  tokenUsage: OpenAiTokenUsage;
};

const maxAiInputCharacters = 24000;
const maxAiChunkRows = 25;
const defaultOpenAiExtractionModel = "gpt-5.1-mini";

function clampConfidence(value: unknown) {
  const score = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 35;
  return Math.min(100, Math.max(0, score));
}

function getTextFromResponse(response: Record<string, unknown>) {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  const output = Array.isArray(response.output) ? response.output : [];
  for (const outputItem of output) {
    if (!outputItem || typeof outputItem !== "object") {
      continue;
    }

    const content = Array.isArray((outputItem as { content?: unknown }).content)
      ? (outputItem as { content: unknown[] }).content
      : [];

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

function getTokenUsageFromResponse(response: Record<string, unknown>): OpenAiTokenUsage {
  const usage = response.usage && typeof response.usage === "object"
    ? response.usage as Record<string, unknown>
    : {};
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

function getDocumentTextChunks(text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    return [""];
  }

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length <= maxAiChunkRows + 1) {
    return [trimmed.slice(0, maxAiInputCharacters)];
  }

  const header = lines[0]?.includes(",") ? lines[0] : "";
  const rows = header ? lines.slice(1) : lines;
  const chunks: string[] = [];

  for (let index = 0; index < rows.length; index += maxAiChunkRows) {
    const body = rows.slice(index, index + maxAiChunkRows).join("\n");
    chunks.push([header, body].filter(Boolean).join("\n").slice(0, maxAiInputCharacters));
  }

  return chunks;
}

function buildPrompt(input: MockExtractionInput, sourceText: string, chunkIndex: number, chunkCount: number) {
  return [
    "Extract builder handover records from the supplied project document context.",
    "Use the document as the primary source of truth. Treat headings, schedules, repeated rows, locations, supplier quote references, and source snippets as context.",
    "Return only records supported by the document text or filename metadata.",
    "Classify each record so the app can avoid unnecessary internet/source work.",
    "Use `source_ready` only when the record has enough product/material identity for source lookup.",
    "Use `builder_input_needed` when the document points to a real handover item but is missing brand, model, supplier, warranty, care, or exact identity.",
    "Use `project_document` for certificates, manuals, warranties, producer statements, selections, or rows that ask the builder to upload another document or quote.",
    "Use `generic_allowance`, `admin_or_contract`, or `not_handover_relevant` rather than forcing non-product text into source lookup.",
    "Every item must be builder-reviewable. Do not invent warranty or maintenance details.",
    "If details are missing, leave fields empty, list missingFields and builderInfoNeeded, and use a lower confidence score.",
    "",
    `Filename: ${input.document.originalFilename}`,
    `MIME type: ${input.document.mimeType}`,
    `Chunk: ${chunkIndex + 1} of ${chunkCount}`,
    `Document text:\n${sourceText || "[No selectable text was available. Use filename metadata only.]"}`,
  ].join("\n");
}

async function callOpenAiExtraction(input: {
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<OpenAiExtractionCallResult> {
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
          content:
            "You extract structured builder handover items for later human review. Homeowners never see this raw output.",
        },
        {
          role: "user",
          content: input.prompt,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "builder_handover_extraction",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              items: {
                type: "array",
                maxItems: 30,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    itemType: {
                      type: "string",
                      enum: ["product", "document", "maintenance"],
                    },
                    productName: { type: "string" },
                    brand: { type: "string" },
                    model: { type: "string" },
                    category: { type: "string" },
                    supplier: { type: "string" },
                    location: { type: "string" },
                    warrantyText: { type: "string" },
                    maintenanceText: { type: "string" },
                    sourceEvidenceText: { type: "string" },
                    missingFields: {
                      type: "array",
                      maxItems: 8,
                      items: { type: "string" },
                    },
                    builderInfoNeeded: {
                      type: "array",
                      maxItems: 8,
                      items: { type: "string" },
                    },
                    contextClassification: {
                      type: "string",
                      enum: [
                        "source_ready",
                        "builder_input_needed",
                        "project_document",
                        "generic_allowance",
                        "admin_or_contract",
                        "not_handover_relevant",
                      ],
                    },
                    classificationReason: { type: "string" },
                    confidenceScore: { type: "number" },
                  },
                  required: [
                    "itemType",
                    "productName",
                    "brand",
                    "model",
                    "category",
                    "supplier",
                    "location",
                    "warrantyText",
                    "maintenanceText",
                    "sourceEvidenceText",
                    "missingFields",
                    "builderInfoNeeded",
                    "contextClassification",
                    "classificationReason",
                    "confidenceScore",
                  ],
                },
              },
            },
            required: ["items"],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI extraction failed with status ${response.status}.`);
  }

  const body = (await response.json()) as Record<string, unknown>;
  const text = getTextFromResponse(body);
  const tokenUsage = getTokenUsageFromResponse(body);

  if (!text) {
    throw new Error("OpenAI extraction returned no structured text.");
  }

  let parsed: { items?: AiExtractedItem[] };
  try {
    parsed = JSON.parse(text) as { items?: AiExtractedItem[] };
  } catch {
    throw new Error("OpenAI extraction returned malformed JSON.");
  }

  return {
    items: Array.isArray(parsed.items) ? parsed.items : [],
    tokenUsage,
  };
}

function cleanList(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
        .slice(0, 8)
    : [];
}

function mapAiItemToWorkflowItem(
  item: AiExtractedItem,
  input: MockExtractionInput,
): MockExtractedItem {
  const confidenceScore = clampConfidence(item.confidenceScore);
  const productName = item.productName?.trim() || "AI extracted item for builder review";
  const missingFields = cleanList(item.missingFields);
  const builderInfoNeeded = cleanList(item.builderInfoNeeded);
  const contextClassification = item.contextClassification || "builder_input_needed";
  const classificationReason = item.classificationReason?.trim()
    || "Document context needs builder/admin review before homeowner use.";

  return {
    projectId: input.document.projectId,
    sourceDocumentId: input.document.id,
    extractionJobId: input.jobId,
    rawExtractedData: {
      extractor: "openai_phase_4",
      sourceFilename: input.document.originalFilename,
      sourceMimeType: input.document.mimeType,
      item,
      contextSchema: {
        itemType: item.itemType || "product",
        sourceEvidenceText: item.sourceEvidenceText?.trim() || undefined,
        missingFields,
        builderInfoNeeded,
        contextClassification,
        classificationReason,
      },
    },
    productName,
    brand: item.brand?.trim() || undefined,
    model: item.model?.trim() || undefined,
    category: item.category?.trim() || "Product",
    supplier: item.supplier?.trim() || undefined,
    location: item.location?.trim() || undefined,
    warrantyText: item.warrantyText?.trim() || undefined,
    maintenanceText: item.maintenanceText?.trim() || undefined,
    confidenceScore,
    matchStatus: confidenceScore >= 80 ? "needs_review" : confidenceScore >= 55 ? "low_confidence" : "unmatched",
    reviewStatus: confidenceScore >= 80 ? "needs_review" : confidenceScore >= 55 ? "low_confidence" : "unmatched",
  };
}

function getDocumentCategory(document: MockExtractionInput["document"]) {
  const name = document.originalFilename.toLowerCase();
  const type = document.fileType?.toLowerCase() || document.mimeType.toLowerCase();

  if (name.includes("warranty")) {
    return "Warranty";
  }

  if (name.includes("manual")) {
    return "Manual";
  }

  if (name.includes("maintenance")) {
    return "Maintenance";
  }

  if (type.includes("image") || ["jpg", "jpeg", "png", "webp", "gif"].includes(type)) {
    return "Photo evidence";
  }

  return "Project document";
}

export function runMockDocumentExtraction(input: MockExtractionInput): MockExtractedItem[] {
  if (input.document.originalFilename.toLowerCase().includes("fail-extraction")) {
    throw new Error("Mock extractor failure requested by filename.");
  }

  const category = getDocumentCategory(input.document);
  const baseRawData = {
    extractor: "mock_phase_3",
    sourceFilename: input.document.originalFilename,
    sourceMimeType: input.document.mimeType,
    note: "Placeholder extraction output for workflow scaffolding only.",
  };

  return [
    {
      projectId: input.document.projectId,
      sourceDocumentId: input.document.id,
      extractionJobId: input.jobId,
      rawExtractedData: {
        ...baseRawData,
        field: "document_summary",
      },
      productName: `${category} from ${input.document.originalFilename}`,
      brand: undefined,
      model: undefined,
      category,
      supplier: undefined,
      location: "To confirm",
      warrantyText: category === "Warranty" ? "Warranty terms detected for builder review." : undefined,
      maintenanceText: "Maintenance or handover relevance requires builder review.",
      confidenceScore: 45,
      matchStatus: "unmatched",
      reviewStatus: "needs_review",
    },
  ];
}

export async function extractDocumentText(input: {
  bytes: Buffer;
  fileName: string;
  mimeType: string;
  fileType?: string;
}) {
  const lowerName = input.fileName.toLowerCase();
  const lowerType = input.fileType?.toLowerCase() || "";

  if (input.mimeType === "application/pdf" || lowerName.endsWith(".pdf") || lowerType === "pdf") {
    const parsed = await extractPdfText(input.bytes);
    return {
      text: parsed.text,
      metadata: {
        textExtractor: "pdf_parse_ocr",
        pageCount: parsed.pages,
        diagnostics: parsed.diagnostics,
      },
    };
  }

  if (
    input.mimeType === "text/csv" ||
    input.mimeType === "application/csv" ||
    lowerName.endsWith(".csv") ||
    lowerType === "csv"
  ) {
    return {
      text: input.bytes.toString("utf8"),
      metadata: {
        textExtractor: "plain_text",
      },
    };
  }

  return {
    text: "",
    metadata: {
      textExtractor: "metadata_only",
      warning: "No text extractor is available for this file type yet.",
    },
  };
}

export async function runDocumentExtraction(input: MockExtractionInput): Promise<{
  items: MockExtractedItem[];
  extractor: "mock_phase_3" | "openai_phase_4";
  model?: string;
  tokenUsage?: OpenAiTokenUsage;
  requestCount?: number;
  redaction?: DocumentRedactionSummary;
  redactedDocumentTextLength?: number;
}> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const items = attachIdentityEvidence(runMockDocumentExtraction(input));

    return {
      items,
      extractor: "mock_phase_3",
      requestCount: 0,
    };
  }

  const model = process.env.OPENAI_EXTRACTION_MODEL || defaultOpenAiExtractionModel;
  const redacted = redactDocumentText(input.documentText || "");
  const chunks = getDocumentTextChunks(redacted.text);
  let tokenUsage: OpenAiTokenUsage = {};
  const parsedItems: AiExtractedItem[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const result = await callOpenAiExtraction({
      apiKey,
      model,
      prompt: buildPrompt(input, chunks[index], index, chunks.length),
    });

    tokenUsage = addTokenUsage(tokenUsage, result.tokenUsage);
    parsedItems.push(...result.items);
  }

  const items = attachIdentityEvidence(parsedItems.map((item) => mapAiItemToWorkflowItem(item, input)));

  return {
    items,
    extractor: "openai_phase_4",
    model,
    tokenUsage,
    requestCount: chunks.length,
    redaction: redacted.summary,
    redactedDocumentTextLength: redacted.text.length,
  };
}
