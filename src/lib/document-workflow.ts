export const uploadedDocumentProcessingStatuses = [
  "uploaded",
  "processing",
  "needs_review",
  "package_ready",
  "completed",
  "failed",
] as const;

export const documentExtractionJobStatuses = [
  "uploaded",
  "queued",
  "processing",
  "needs_review",
  "partially_reviewed",
  "package_ready",
  "completed",
  "failed",
] as const;

export const uploadedDocumentWorkflowRoles = [
  "specification",
  "quote",
  "invoice",
  "supplier_schedule",
  "manual",
  "warranty",
  "photo",
  "other",
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

export const careGuidanceSourceTypes = [
  "manufacturer",
  "supplier",
  "builder_supplied",
  "general_ai",
  "unknown",
] as const;

export const quoteReferenceStatuses = [
  "not_applicable",
  "referenced",
  "quote_uploaded",
  "quote_extracted",
  "resolved",
] as const;

export type UploadedDocumentProcessingStatus =
  (typeof uploadedDocumentProcessingStatuses)[number];

export type DocumentExtractionJobStatus =
  (typeof documentExtractionJobStatuses)[number];

export type UploadedDocumentWorkflowRole =
  (typeof uploadedDocumentWorkflowRoles)[number];

export type ExtractedItemMatchStatus =
  (typeof extractedItemMatchStatuses)[number];

export type ExtractedItemReviewStatus =
  (typeof extractedItemReviewStatuses)[number];

export type ItemReviewActionType = (typeof itemReviewActionTypes)[number];

export type CareGuidanceSourceType = (typeof careGuidanceSourceTypes)[number];

export type QuoteReferenceStatus = (typeof quoteReferenceStatuses)[number];

export type UploadedProjectDocument = {
  id: string;
  projectId: string;
  originalFilename: string;
  fileType?: string;
  mimeType: string;
  storagePath: string;
  workflowRole?: UploadedDocumentWorkflowRole;
  parentExtractedItemId?: string;
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
  usageMetrics?: Record<string, unknown>;
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
  parentExtractedItemId?: string;
  sourceQuoteDocumentId?: string;
  rawExtractedData: Record<string, unknown>;
  originalExtractedValues?: Record<string, unknown>;
  builderEditedValues?: Record<string, unknown>;
  itemType?: "product" | "document" | "maintenance";
  productName?: string;
  manufacturer?: string;
  brand?: string;
  model?: string;
  aiSuggestedCategory?: string;
  builderApprovedCategory?: string;
  category?: string;
  supplierId?: string;
  supplierName?: string;
  supplier?: string;
  supplierSku?: string;
  location?: string;
  quantity?: string;
  variantOrFinish?: string;
  warrantyText?: string;
  maintenanceText?: string;
  careGuidanceSourceType?: CareGuidanceSourceType;
  careGuidanceSourceLabel?: string;
  careGuidanceReviewRequired?: boolean;
  warrantySourceVersionId?: string;
  manualSourceVersionId?: string;
  careGuidanceVersionId?: string;
  identityFingerprint?: string;
  quoteReferenceText?: string;
  quoteReferenceStatus?: QuoteReferenceStatus;
  sourcePage?: string;
  sourceSection?: string;
  sourceSnippet?: string;
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

export type SupplierRecord = {
  id: string;
  organisationId?: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  websiteUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type ExtractedItemValueHistory = {
  id: string;
  projectId: string;
  extractedItemId: string;
  actionId?: string;
  previousValues: Record<string, unknown>;
  nextValues: Record<string, unknown>;
  changedFields: string[];
  changedBy?: string;
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

export type WorkflowHandoverItem = {
  id: string;
  projectId: string;
  sourceExtractedItemId?: string;
  sourceDocumentId?: string;
  matchedProductId?: string;
  itemType: "product" | "document" | "maintenance";
  title: string;
  manufacturer?: string;
  brand?: string;
  model?: string;
  aiSuggestedCategory?: string;
  builderApprovedCategory?: string;
  category?: string;
  supplierId?: string;
  supplierName?: string;
  supplier?: string;
  supplierSku?: string;
  location?: string;
  quantity?: string;
  variantOrFinish?: string;
  warrantyText?: string;
  maintenanceText?: string;
  careGuidanceSourceType?: CareGuidanceSourceType;
  careGuidanceSourceLabel?: string;
  warrantySourceVersionId?: string;
  manualSourceVersionId?: string;
  careGuidanceVersionId?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
};

export type HandoverApprovalRecord = {
  id: string;
  projectId: string;
  approvedBy?: string;
  approvedAt: string;
  handoverVersion: string;
  builderConfirmationText: string;
  aiConfirmationText?: string;
  includedItemIds: string[];
  excludedItemIds: string[];
  aiGeneratedItemCount: number;
  reviewedItemCount: number;
  metadata: Record<string, unknown>;
};
