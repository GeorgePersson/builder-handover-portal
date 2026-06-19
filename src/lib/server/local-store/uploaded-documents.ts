import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  DocumentExtractionJob,
  ExtractedItemReviewStatus,
  ExtractedWorkflowItem,
  HandoverApprovalRecord,
  ItemReviewAction,
  ItemReviewActionType,
  ProductMatch,
  UploadedDocumentProcessingStatus,
  UploadedProjectDocument,
  WorkflowHandoverItem,
} from "@/lib/document-workflow";

type LocalUploadedDocumentStore = {
  documents: UploadedProjectDocument[];
  extractionJobs: DocumentExtractionJob[];
  extractedItems: ExtractedWorkflowItem[];
  itemReviewActions: ItemReviewAction[];
  handoverItems: WorkflowHandoverItem[];
  handoverApprovals: HandoverApprovalRecord[];
  productMatches: ProductMatch[];
};

const approvedWorkflowReviewStatuses = new Set([
  "verified_match",
  "approved",
  "edited_by_builder",
  "builder_supplied",
]);

const storeRoot = path.join(process.cwd(), ".local-data");
const storePath = path.join(storeRoot, "uploaded-documents.json");

function assertStorePath() {
  const resolvedRoot = path.resolve(storeRoot);
  const resolvedPath = path.resolve(storePath);

  if (!resolvedPath.startsWith(resolvedRoot)) {
    throw new Error("Invalid local uploaded document store path.");
  }
}

async function readStore(): Promise<LocalUploadedDocumentStore> {
  assertStorePath();

  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalUploadedDocumentStore>;
    return {
      documents: parsed.documents || [],
      extractionJobs: parsed.extractionJobs || [],
      extractedItems: parsed.extractedItems || [],
      itemReviewActions: parsed.itemReviewActions || [],
      handoverItems: parsed.handoverItems || [],
      handoverApprovals: parsed.handoverApprovals || [],
      productMatches: parsed.productMatches || [],
    };
  } catch {
    return {
      documents: [],
      extractionJobs: [],
      extractedItems: [],
      itemReviewActions: [],
      handoverItems: [],
      handoverApprovals: [],
      productMatches: [],
    };
  }
}

async function writeStore(store: LocalUploadedDocumentStore) {
  assertStorePath();
  await mkdir(storeRoot, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2));
}

export async function getLocalUploadedDocuments(projectId?: string) {
  const store = await readStore();
  return projectId
    ? store.documents.filter((document) => document.projectId === projectId)
    : store.documents;
}

export async function saveLocalUploadedDocument(
  input: Omit<UploadedProjectDocument, "id" | "createdAt" | "updatedAt">,
) {
  const store = await readStore();
  const timestamp = new Date().toISOString();
  const document: UploadedProjectDocument = {
    ...input,
    id: `local-uploaded-document-${Date.now()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await writeStore({
    ...store,
    documents: [document, ...store.documents],
  });

  return document;
}

export async function updateLocalUploadedDocumentStatus(
  documentId: string,
  processingStatus: UploadedDocumentProcessingStatus,
) {
  const store = await readStore();
  const timestamp = new Date().toISOString();

  await writeStore({
    ...store,
    documents: store.documents.map((document) =>
      document.id === documentId ? { ...document, processingStatus, updatedAt: timestamp } : document,
    ),
  });
}

export async function getLocalDocumentExtractionJobs(projectId?: string) {
  const store = await readStore();
  return projectId
    ? store.extractionJobs.filter((job) => job.projectId === projectId)
    : store.extractionJobs;
}

export async function getLocalExtractedWorkflowItems(projectId?: string) {
  const store = await readStore();
  return projectId
    ? store.extractedItems.filter((item) => item.projectId === projectId)
    : store.extractedItems;
}

export async function getLocalExtractedWorkflowItem(itemId: string) {
  const store = await readStore();
  return store.extractedItems.find((item) => item.id === itemId) || null;
}

export async function updateLocalExtractedWorkflowItemReview(
  itemId: string,
  update: Partial<Pick<
    ExtractedWorkflowItem,
    | "productName"
    | "brand"
    | "model"
    | "category"
    | "supplier"
    | "location"
    | "warrantyText"
    | "maintenanceText"
    | "reviewStatus"
    | "approvedBy"
    | "approvedAt"
    | "excludedAt"
    | "exclusionReason"
  >>,
) {
  const store = await readStore();
  const timestamp = new Date().toISOString();
  let updatedItem: ExtractedWorkflowItem | null = null;

  const extractedItems = store.extractedItems.map((item) => {
    if (item.id !== itemId) {
      return item;
    }

    updatedItem = {
      ...item,
      ...update,
      updatedAt: timestamp,
    };
    return updatedItem;
  });

  await writeStore({
    ...store,
    extractedItems,
  });

  return updatedItem;
}

export async function saveLocalItemReviewAction(input: {
  projectId: string;
  extractedItemId: string;
  actionType: ItemReviewActionType;
  actionBy?: string;
  previousReviewStatus?: ExtractedItemReviewStatus;
  nextReviewStatus?: ExtractedItemReviewStatus;
  notes?: string;
  metadata?: Record<string, unknown>;
}) {
  const store = await readStore();
  const action: ItemReviewAction = {
    id: `local-item-review-action-${Date.now()}`,
    projectId: input.projectId,
    extractedItemId: input.extractedItemId,
    actionType: input.actionType,
    actionBy: input.actionBy,
    previousReviewStatus: input.previousReviewStatus,
    nextReviewStatus: input.nextReviewStatus,
    notes: input.notes,
    metadata: input.metadata || {},
    createdAt: new Date().toISOString(),
  };

  await writeStore({
    ...store,
    itemReviewActions: [action, ...store.itemReviewActions],
  });

  return action;
}

export async function getLocalProductMatches(projectId?: string) {
  const store = await readStore();

  if (!projectId) {
    return store.productMatches;
  }

  const itemIds = new Set(
    store.extractedItems.filter((item) => item.projectId === projectId).map((item) => item.id),
  );
  return store.productMatches.filter((match) => itemIds.has(match.extractedItemId));
}

function inferWorkflowItemType(item: ExtractedWorkflowItem): WorkflowHandoverItem["itemType"] {
  const category = item.category?.toLowerCase() || "";
  const name = item.productName?.toLowerCase() || "";

  if (category.includes("maintenance") || name.includes("maintenance")) {
    return "maintenance";
  }

  if (
    category.includes("document") ||
    category.includes("manual") ||
    category.includes("warranty") ||
    name.includes("manual") ||
    name.includes("warranty")
  ) {
    return "document";
  }

  return "product";
}

function toLocalHandoverItem(
  item: ExtractedWorkflowItem,
  index: number,
  timestamp: string,
): WorkflowHandoverItem {
  return {
    id: `local-handover-item-${Date.now()}-${index}`,
    projectId: item.projectId,
    sourceExtractedItemId: item.id,
    sourceDocumentId: item.sourceDocumentId,
    matchedProductId: item.matchedProductId,
    itemType: inferWorkflowItemType(item),
    title: item.productName || item.category || "Approved handover item",
    brand: item.brand,
    model: item.model,
    category: item.category,
    supplier: item.supplier,
    location: item.location,
    warrantyText: item.warrantyText,
    maintenanceText: item.maintenanceText,
    approvedBy: item.approvedBy,
    approvedAt: item.approvedAt,
    createdAt: timestamp,
  };
}

export async function generateLocalWorkflowHandoverItems(projectId: string) {
  const store = await readStore();
  const timestamp = new Date().toISOString();
  const approvedItems = store.extractedItems.filter(
    (item) => item.projectId === projectId && approvedWorkflowReviewStatuses.has(item.reviewStatus),
  );
  const handoverItems = approvedItems.map((item, index) => toLocalHandoverItem(item, index, timestamp));

  await writeStore({
    ...store,
    handoverItems: [
      ...handoverItems,
      ...store.handoverItems.filter((item) => item.projectId !== projectId),
    ],
  });

  return handoverItems;
}

export async function getLocalWorkflowHandoverItems(projectId?: string) {
  const store = await readStore();
  return projectId
    ? store.handoverItems.filter((item) => item.projectId === projectId)
    : store.handoverItems;
}

export async function saveLocalHandoverApprovalRecord(
  input: Omit<HandoverApprovalRecord, "id">,
) {
  const store = await readStore();
  const approval: HandoverApprovalRecord = {
    ...input,
    id: `local-handover-approval-${Date.now()}`,
  };

  await writeStore({
    ...store,
    handoverApprovals: [approval, ...store.handoverApprovals],
  });

  return approval;
}

export async function saveLocalDocumentExtractionJob(
  input: Omit<DocumentExtractionJob, "id" | "createdAt" | "updatedAt" | "retryCount"> & {
    retryCount?: number;
  },
) {
  const store = await readStore();
  const timestamp = new Date().toISOString();
  const job: DocumentExtractionJob = {
    ...input,
    id: `local-extraction-job-${Date.now()}`,
    retryCount: input.retryCount || 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await writeStore({
    ...store,
    extractionJobs: [job, ...store.extractionJobs],
  });

  return job;
}

export async function updateLocalDocumentExtractionJob(
  jobId: string,
  update: Partial<Omit<DocumentExtractionJob, "id" | "createdAt">>,
) {
  const store = await readStore();
  const timestamp = new Date().toISOString();
  let updatedJob: DocumentExtractionJob | null = null;

  const extractionJobs = store.extractionJobs.map((job) => {
    if (job.id !== jobId) {
      return job;
    }

    updatedJob = {
      ...job,
      ...update,
      updatedAt: timestamp,
    };
    return updatedJob;
  });

  await writeStore({
    ...store,
    extractionJobs,
  });

  return updatedJob;
}

export async function saveLocalExtractedWorkflowItems(
  items: Array<Omit<ExtractedWorkflowItem, "id" | "createdAt" | "updatedAt">>,
) {
  const store = await readStore();
  const timestamp = new Date().toISOString();
  const extractedItems = items.map((item, index) => ({
    ...item,
    id: `local-extracted-item-${Date.now()}-${index}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  await writeStore({
    ...store,
    extractedItems: [...extractedItems, ...store.extractedItems],
  });

  return extractedItems;
}

export async function applyLocalProductMatches(
  matches: Array<Omit<ProductMatch, "id" | "createdAt">>,
) {
  const store = await readStore();
  const timestamp = new Date().toISOString();
  const productMatches = matches.map((match, index) => ({
    ...match,
    id: `local-product-match-${Date.now()}-${index}`,
    createdAt: timestamp,
  }));
  const matchByItemId = new Map(matches.map((match) => [match.extractedItemId, match]));
  const matchedItemIds = new Set(matches.map((match) => match.extractedItemId));

  await writeStore({
    ...store,
    extractedItems: store.extractedItems.map((item) => {
      const match = matchByItemId.get(item.id);

      if (!match) {
        return item;
      }

      return {
        ...item,
        matchStatus: match.matchStatus,
        reviewStatus: match.matchStatus,
        matchedProductId: match.matchedProductId,
        updatedAt: timestamp,
      };
    }),
    productMatches: [
      ...productMatches,
      ...store.productMatches.filter((match) => !matchedItemIds.has(match.extractedItemId)),
    ],
  });

  return productMatches;
}
