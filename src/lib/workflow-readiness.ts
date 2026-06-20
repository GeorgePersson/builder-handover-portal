import type {
  DocumentExtractionJob,
  ExtractedWorkflowItem,
  UploadedProjectDocument,
} from "@/lib/document-workflow";

export type WorkflowPublishBlockerCode =
  | "document_processing_incomplete"
  | "extraction_processing_incomplete"
  | "extraction_failed"
  | "review_items_unresolved"
  | "source_gap_unresolved";

export type WorkflowPublishBlocker = {
  code: WorkflowPublishBlockerCode;
  label: string;
  count: number;
};

export type WorkflowPublishReadiness = {
  ready: boolean;
  approvedItemCount: number;
  blockers: WorkflowPublishBlocker[];
};

const incompleteDocumentStatuses = new Set(["uploaded", "processing"]);
const incompleteJobStatuses = new Set(["uploaded", "queued", "processing"]);
const unresolvedReviewStatuses = new Set(["needs_review", "low_confidence", "unmatched"]);
const approvedReviewStatuses = new Set(["verified_match", "approved", "edited_by_builder", "builder_supplied"]);
const unresolvedQuoteStatuses = new Set(["referenced", "quote_uploaded"]);

function blocker(code: WorkflowPublishBlockerCode, label: string, count: number): WorkflowPublishBlocker | null {
  return count > 0 ? { code, label, count } : null;
}

export function getWorkflowPublishReadiness(input: {
  documents: UploadedProjectDocument[];
  jobs: DocumentExtractionJob[];
  items: ExtractedWorkflowItem[];
}): WorkflowPublishReadiness {
  const incompleteDocumentCount = input.documents.filter((document) =>
    incompleteDocumentStatuses.has(document.processingStatus),
  ).length;
  const incompleteJobCount = input.jobs.filter((job) => incompleteJobStatuses.has(job.status)).length;
  const failedJobCount = input.jobs.filter((job) => job.status === "failed").length;
  const failedDocumentCount = input.documents.filter((document) => document.processingStatus === "failed").length;
  const unresolvedItemCount = input.items.filter((item) => unresolvedReviewStatuses.has(item.reviewStatus)).length;
  const unresolvedSourceGapCount = input.items.filter(hasUnresolvedSourceGap).length;
  const approvedItemCount = input.items.filter((item) => approvedReviewStatuses.has(item.reviewStatus)).length;
  const blockers = [
    blocker("document_processing_incomplete", "Document processing is still incomplete", incompleteDocumentCount),
    blocker("extraction_processing_incomplete", "Extraction jobs are still running or queued", incompleteJobCount),
    blocker("extraction_failed", "Extraction jobs or documents failed and need retry", failedJobCount + failedDocumentCount),
    blocker("review_items_unresolved", "Workflow review items still need builder resolution", unresolvedItemCount),
    blocker("source_gap_unresolved", "Quote references or missing source details still need builder resolution", unresolvedSourceGapCount),
  ].filter((item): item is WorkflowPublishBlocker => Boolean(item));

  return {
    ready: blockers.length === 0,
    approvedItemCount,
    blockers,
  };
}

function hasUnresolvedSourceGap(item: ExtractedWorkflowItem) {
  if (item.reviewStatus === "excluded" || approvedReviewStatuses.has(item.reviewStatus)) {
    return false;
  }

  const raw = item.rawExtractedData || {};
  const contextSchema = getRecord(raw.contextSchema);
  const itemPayload = getRecord(raw.item);
  const reviewPayload = getRecord(raw.review);
  const quoteReferenceStatus = item.quoteReferenceStatus
    || getString(raw.quoteReferenceStatus)
    || getString(itemPayload.quoteReferenceStatus);
  const contextClassification = getString(contextSchema.contextClassification)
    || getString(raw.contextClassification)
    || getString(itemPayload.contextClassification);
  const missingFields = [
    ...getStringList(contextSchema.missingFields),
    ...getStringList(raw.missingFields),
    ...getStringList(itemPayload.missingFields),
    ...getStringList(reviewPayload.missingFields),
  ];
  const builderInfoNeeded = [
    ...getStringList(contextSchema.builderInfoNeeded),
    ...getStringList(raw.builderInfoNeeded),
    ...getStringList(itemPayload.builderInfoNeeded),
    ...getStringList(reviewPayload.builderInfoNeeded),
  ];

  return unresolvedQuoteStatuses.has(quoteReferenceStatus)
    || contextClassification === "builder_input_needed"
    || missingFields.length > 0
    || builderInfoNeeded.length > 0;
}

function getRecord(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getStringList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => getString(item)).filter(Boolean)
    : [];
}
