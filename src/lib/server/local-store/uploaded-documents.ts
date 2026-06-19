import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  DocumentExtractionJob,
  ExtractedWorkflowItem,
  ProductMatch,
  UploadedDocumentProcessingStatus,
  UploadedProjectDocument,
} from "@/lib/document-workflow";

type LocalUploadedDocumentStore = {
  documents: UploadedProjectDocument[];
  extractionJobs: DocumentExtractionJob[];
  extractedItems: ExtractedWorkflowItem[];
  productMatches: ProductMatch[];
};

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
      productMatches: parsed.productMatches || [],
    };
  } catch {
    return { documents: [], extractionJobs: [], extractedItems: [], productMatches: [] };
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
