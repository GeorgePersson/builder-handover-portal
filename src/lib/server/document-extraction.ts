import type { ExtractedWorkflowItem, UploadedProjectDocument } from "@/lib/document-workflow";
import { extractPdfText } from "@/lib/server/pdf-extract";

type MockExtractionInput = {
  jobId: string;
  document: Pick<UploadedProjectDocument, "id" | "projectId" | "originalFilename" | "fileType" | "mimeType">;
  documentText?: string;
};

type MockExtractedItem = Omit<ExtractedWorkflowItem, "id" | "createdAt" | "updatedAt">;
type AiExtractedItem = {
  productName?: string;
  brand?: string;
  model?: string;
  category?: string;
  supplier?: string;
  location?: string;
  warrantyText?: string;
  maintenanceText?: string;
  confidenceScore?: number;
};

const maxAiInputCharacters = 24000;

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

function mapAiItemToWorkflowItem(
  item: AiExtractedItem,
  input: MockExtractionInput,
): MockExtractedItem {
  const confidenceScore = clampConfidence(item.confidenceScore);
  const productName = item.productName?.trim() || "AI extracted item for builder review";

  return {
    projectId: input.document.projectId,
    sourceDocumentId: input.document.id,
    extractionJobId: input.jobId,
    rawExtractedData: {
      extractor: "openai_phase_4",
      sourceFilename: input.document.originalFilename,
      sourceMimeType: input.document.mimeType,
      item,
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
}> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      items: runMockDocumentExtraction(input),
      extractor: "mock_phase_3",
    };
  }

  const sourceText = (input.documentText || "").slice(0, maxAiInputCharacters);
  const prompt = [
    "Extract builder handover products/items from the supplied project document text.",
    "Return only items that appear supported by the document text or filename metadata.",
    "Every item must be builder-reviewable. Do not invent warranty or maintenance details.",
    "If details are missing, leave the field empty and use a lower confidence score.",
    "",
    `Filename: ${input.document.originalFilename}`,
    `MIME type: ${input.document.mimeType}`,
    `Document text:\n${sourceText || "[No selectable text was available. Use filename metadata only.]"}`,
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_EXTRACTION_MODEL || "gpt-5.1-mini",
      input: [
        {
          role: "system",
          content:
            "You extract structured builder handover items for later human review. Homeowners never see this raw output.",
        },
        {
          role: "user",
          content: prompt,
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
                    productName: { type: "string" },
                    brand: { type: "string" },
                    model: { type: "string" },
                    category: { type: "string" },
                    supplier: { type: "string" },
                    location: { type: "string" },
                    warrantyText: { type: "string" },
                    maintenanceText: { type: "string" },
                    confidenceScore: { type: "number" },
                  },
                  required: [
                    "productName",
                    "brand",
                    "model",
                    "category",
                    "supplier",
                    "location",
                    "warrantyText",
                    "maintenanceText",
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

  if (!text) {
    throw new Error("OpenAI extraction returned no structured text.");
  }

  let parsed: { items?: AiExtractedItem[] };
  try {
    parsed = JSON.parse(text) as { items?: AiExtractedItem[] };
  } catch {
    throw new Error("OpenAI extraction returned malformed JSON.");
  }

  const items = Array.isArray(parsed.items)
    ? parsed.items.map((item) => mapAiItemToWorkflowItem(item, input))
    : [];

  return {
    items,
    extractor: "openai_phase_4",
  };
}
