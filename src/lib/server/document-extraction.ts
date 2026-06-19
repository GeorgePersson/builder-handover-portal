import type { ExtractedWorkflowItem, UploadedProjectDocument } from "@/lib/document-workflow";

type MockExtractionInput = {
  jobId: string;
  document: Pick<UploadedProjectDocument, "id" | "projectId" | "originalFilename" | "fileType" | "mimeType">;
};

type MockExtractedItem = Omit<ExtractedWorkflowItem, "id" | "createdAt" | "updatedAt">;

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
