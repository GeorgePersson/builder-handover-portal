import type { ExtractedWorkflowItem, UploadedProjectDocument } from "@/lib/document-workflow";
import { normalizeOutlineSpecExtractionToWorkflowItems } from "@/lib/ai/outline-spec-normalize";
import {
  outlineSpecItemsJsonSchema,
  type OutlineSpecExtraction,
} from "@/lib/extraction/outline-spec-schema";
import { redactDocumentText, type DocumentRedactionSummary } from "@/lib/server/document-redaction";
import { attachIdentityEvidence, type OpenAiTokenUsage } from "@/lib/server/extraction-usage";
import { extractPdfText } from "@/lib/server/pdf-extract";

type MockExtractionInput = {
  jobId: string;
  document: Pick<UploadedProjectDocument, "id" | "projectId" | "originalFilename" | "fileType" | "mimeType"> & {
    parentExtractedItemId?: string;
    workflowRole?: UploadedProjectDocument["workflowRole"];
  };
  documentText?: string;
  documentContextMetadata?: Record<string, unknown>;
};

type MockExtractedItem = Omit<ExtractedWorkflowItem, "id" | "createdAt" | "updatedAt">;
type OpenAiExtractionCallResult = {
  extraction: OutlineSpecExtraction;
  tokenUsage: OpenAiTokenUsage;
};

const maxAiInputCharacters = 24000;
const maxAiChunkRows = 25;
const defaultOpenAiExtractionModel = "gpt-5.1-mini";

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
    "Do not extract pure admin/legal/contract/preliminaries/site setup/scaffolding/temporary works/council/insurance/health-and-safety/generic workmanship text as handover products.",
    "Still preserve homeowner-relevant warranties, manuals, certificates, producer statements, appliances, fixtures/fittings, flooring, cladding, roofing, paint/finish selections, and maintenance requirements.",
    "Use `source_ready_unknown` only when the record has enough product/material identity for source lookup.",
    "Use `builder_input_needed` when the document points to a real handover item but is missing brand, model, supplier, warranty, care, or exact identity.",
    "Use `project_document` for certificates, manuals, warranties, producer statements, selections, or rows that ask the builder to upload another document or quote.",
    "Use `generic_allowance`, `admin_or_contract`, or `not_handover_relevant` rather than forcing non-product text into source lookup.",
    "Every item must be builder-reviewable. Do not invent warranty or maintenance details.",
    "If details are missing, leave fields empty, list MissingFields and BuilderQuestions, and use a lower confidence score.",
    "When the row references a quote, invoice, supplier schedule, or selection schedule, classify it as `builder_input_needed` or `project_document`, set NeedsBuilderContext true, and do not mark it search-ready.",
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
          name: "outline_spec_extraction",
          strict: true,
          schema: outlineSpecItemsJsonSchema,
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

  let parsed: OutlineSpecExtraction;
  try {
    parsed = JSON.parse(text) as OutlineSpecExtraction;
  } catch {
    throw new Error("OpenAI extraction returned malformed JSON.");
  }

  return {
    extraction: {
      SpecificationNumber: parsed.SpecificationNumber || "",
      Address: parsed.Address || "",
      Date: parsed.Date || "",
      Items: Array.isArray(parsed.Items) ? parsed.Items : [],
    },
    tokenUsage,
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
    extractorSchema: "outline_spec_v1",
    sourceFilename: input.document.originalFilename,
    sourceMimeType: input.document.mimeType,
    sourceWorkflowRole: input.document.workflowRole || "specification",
    note: "Placeholder extraction output for workflow scaffolding only.",
  };
  const isQuote = input.document.workflowRole === "quote" ||
    input.document.workflowRole === "invoice" ||
    input.document.workflowRole === "supplier_schedule" ||
    /\b(quote|invoice|supplier|schedule)\b/i.test(input.document.originalFilename);

  return [
    {
      projectId: input.document.projectId,
      sourceDocumentId: input.document.id,
      extractionJobId: input.jobId,
      parentExtractedItemId: input.document.parentExtractedItemId,
      sourceQuoteDocumentId: isQuote ? input.document.id : undefined,
      rawExtractedData: {
        ...baseRawData,
        field: "document_summary",
        contextSchema: {
          itemType: "document",
          missingFields: isQuote ? ["Exact products from quote"] : ["Builder review"],
          builderInfoNeeded: isQuote ? ["Confirm products, warranty, and care details from this quote."] : [],
          contextClassification: isQuote ? "builder_input_needed" : "project_document",
          classificationReason: isQuote
            ? "Supplier quote uploaded for extraction and builder clarification."
            : "Project document requires builder review before homeowner use.",
        },
      },
      originalExtractedValues: {
        itemType: "document",
        productName: `${category} from ${input.document.originalFilename}`,
        aiSuggestedCategory: category,
        builderApprovedCategory: category,
        careGuidanceSourceType: "builder_supplied",
        quoteReferenceStatus: isQuote ? "quote_extracted" : "not_applicable",
      },
      builderEditedValues: {},
      itemType: "document",
      productName: `${category} from ${input.document.originalFilename}`,
      brand: undefined,
      model: undefined,
      aiSuggestedCategory: category,
      builderApprovedCategory: category,
      category,
      supplier: undefined,
      location: "To confirm",
      warrantyText: category === "Warranty" ? "Warranty terms detected for builder review." : undefined,
      maintenanceText: "Maintenance or handover relevance requires builder review.",
      careGuidanceSourceType: "builder_supplied",
      careGuidanceSourceLabel: "Builder supplied project document",
      quoteReferenceText: isQuote ? input.document.originalFilename : undefined,
      quoteReferenceStatus: isQuote ? "quote_extracted" : "not_applicable",
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
  const isQuoteLikeDocument = input.document.workflowRole === "quote" ||
    input.document.workflowRole === "invoice" ||
    input.document.workflowRole === "supplier_schedule";
  let tokenUsage: OpenAiTokenUsage = {};
  const mergedExtraction: OutlineSpecExtraction = {
    SpecificationNumber: "",
    Address: "",
    Date: "",
    Items: [],
  };

  for (let index = 0; index < chunks.length; index += 1) {
    const result = await callOpenAiExtraction({
      apiKey,
      model,
      prompt: buildPrompt(input, chunks[index], index, chunks.length),
    });

    tokenUsage = addTokenUsage(tokenUsage, result.tokenUsage);
    mergedExtraction.SpecificationNumber ||= result.extraction.SpecificationNumber;
    mergedExtraction.Address ||= result.extraction.Address;
    mergedExtraction.Date ||= result.extraction.Date;
    mergedExtraction.Items.push(...result.extraction.Items);
  }

  const items = attachIdentityEvidence(normalizeOutlineSpecExtractionToWorkflowItems({
    extraction: mergedExtraction,
    projectId: input.document.projectId,
    sourceDocumentId: input.document.id,
    extractionJobId: input.jobId,
    sourceFilename: input.document.originalFilename,
    sourceMimeType: input.document.mimeType,
    parentExtractedItemId: input.document.parentExtractedItemId,
    sourceQuoteDocumentId: isQuoteLikeDocument ? input.document.id : undefined,
  }).map((item) => ({
    ...item,
    rawExtractedData: {
      ...item.rawExtractedData,
      extractor: "openai_phase_4",
      documentContext: input.documentContextMetadata || {},
    },
    quoteReferenceStatus: isQuoteLikeDocument
      ? "quote_extracted"
      : item.quoteReferenceStatus,
  })));

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
