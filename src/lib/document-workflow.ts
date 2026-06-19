export const uploadedDocumentProcessingStatuses = [
  "uploaded",
  "processing",
  "completed",
  "failed",
] as const;

export const documentExtractionJobStatuses = [
  "queued",
  "processing",
  "completed",
  "failed",
] as const;

export const extractedItemMatchStatuses = [
  "verified_match",
  "needs_review",
  "low_confidence",
  "unmatched",
] as const;

export const extractedItemReviewStatuses = [
  "verified_match",
  "needs_review",
  "low_confidence",
  "unmatched",
  "builder_supplied",
  "edited_by_builder",
  "excluded",
  "approved",
] as const;

export const itemReviewActionTypes = [
  "approved_as_correct",
  "edited",
  "supporting_document_uploaded",
  "excluded",
  "marked_builder_supplied",
] as const;

export type UploadedDocumentProcessingStatus =
  (typeof uploadedDocumentProcessingStatuses)[number];

export type DocumentExtractionJobStatus =
  (typeof documentExtractionJobStatuses)[number];

export type ExtractedItemMatchStatus =
  (typeof extractedItemMatchStatuses)[number];

export type ExtractedItemReviewStatus =
  (typeof extractedItemReviewStatuses)[number];

export type ItemReviewActionType = (typeof itemReviewActionTypes)[number];

export type UploadedProjectDocument = {
  id: string;
  projectId: string;
  originalFilename: string;
  fileType?: string;
  mimeType: string;
  storagePath: string;
  processingStatus: UploadedDocumentProcessingStatus;
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentExtractionJob = {
  id: string;
  projectId: string;
  uploadedDocumentId: string;
  status: DocumentExtractionJobStatus;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ExtractedWorkflowItem = {
  id: string;
  projectId: string;
  sourceDocumentId: string;
  extractionJobId?: string;
  rawExtractedData: Record<string, unknown>;
  productName?: string;
  brand?: string;
  model?: string;
  category?: string;
  supplier?: string;
  location?: string;
  warrantyText?: string;
  maintenanceText?: string;
  confidenceScore: number;
  matchStatus: ExtractedItemMatchStatus;
  reviewStatus: ExtractedItemReviewStatus;
  matchedProductId?: string;
  approvedBy?: string;
  approvedAt?: string;
  excludedAt?: string;
  exclusionReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductMatch = {
  id: string;
  extractedItemId: string;
  matchedProductId?: string;
  matchStatus: ExtractedItemMatchStatus;
  matchConfidenceScore: number;
  matchReason?: string;
  createdAt: string;
};

export type ItemReviewAction = {
  id: string;
  projectId: string;
  extractedItemId: string;
  actionType: ItemReviewActionType;
  actionBy?: string;
  previousReviewStatus?: ExtractedItemReviewStatus;
  nextReviewStatus?: ExtractedItemReviewStatus;
  notes?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};
