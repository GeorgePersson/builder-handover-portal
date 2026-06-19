import type {
  DocumentExtractionJob,
  ExtractedWorkflowItem,
  UploadedProjectDocument,
} from "@/lib/document-workflow";

export type WorkflowPublishBlockerCode =
  | "document_processing_incomplete"
  | "extraction_processing_incomplete"
  | "extraction_failed"
  | "review_items_unresolved";

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
const incompleteJobStatuses = new Set(["queued", "processing"]);
const unresolvedReviewStatuses = new Set(["needs_review", "low_confidence", "unmatched"]);
const approvedReviewStatuses = new Set(["verified_match", "approved", "edited_by_builder", "builder_supplied"]);

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
  const approvedItemCount = input.items.filter((item) => approvedReviewStatuses.has(item.reviewStatus)).length;
  const blockers = [
    blocker("document_processing_incomplete", "Document processing is still incomplete", incompleteDocumentCount),
    blocker("extraction_processing_incomplete", "Extraction jobs are still running or queued", incompleteJobCount),
    blocker("extraction_failed", "Extraction jobs or documents failed and need retry", failedJobCount + failedDocumentCount),
    blocker("review_items_unresolved", "Workflow review items still need builder resolution", unresolvedItemCount),
  ].filter((item): item is WorkflowPublishBlocker => Boolean(item));

  return {
    ready: blockers.length === 0,
    approvedItemCount,
    blockers,
  };
}
