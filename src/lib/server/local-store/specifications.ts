import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getInitialExtractedItemStatus } from "@/lib/ai/spec-extract";
import type { ClientRequest, ExtractedHandoverItem, SpecificationUpload } from "@/lib/types";

type LocalSpecificationStore = {
  specifications: SpecificationUpload[];
  extractedItems: ExtractedHandoverItem[];
  publishedPackage?: {
    itemIds: string[];
    publishedAt: string;
  };
};

const storeRoot = path.join(process.cwd(), ".local-data");
const storePath = path.join(storeRoot, "specification-extractions.json");

function assertStorePath() {
  const resolvedRoot = path.resolve(storeRoot);
  const resolvedPath = path.resolve(storePath);

  if (!resolvedPath.startsWith(resolvedRoot)) {
    throw new Error("Invalid local store path.");
  }
}

async function readStore(): Promise<LocalSpecificationStore> {
  assertStorePath();

  try {
    const raw = await readFile(storePath, "utf8");
    return JSON.parse(raw) as LocalSpecificationStore;
  } catch {
    return { specifications: [], extractedItems: [] };
  }
}

async function writeStore(store: LocalSpecificationStore) {
  assertStorePath();
  await mkdir(storeRoot, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2));
}

export async function getLocalSpecificationUploads() {
  const store = await readStore();
  return store.specifications;
}

export async function getLocalExtractedItems(specificationId?: string) {
  const store = await readStore();

  if (!specificationId) {
    return store.extractedItems;
  }

  return store.extractedItems.filter((item) => item.specificationId === specificationId);
}

export async function saveLocalExtraction(input: {
  projectId: string;
  fileName: string;
  proposedItems: Array<{
    item_type: "product" | "document" | "maintenance";
    title: string;
    category: string;
    location: string;
    extracted_text: string;
    matched_existing_record: string | null;
    confidence_score: number;
  }>;
}) {
  const store = await readStore();
  const specificationId = `local-spec-${Date.now()}`;
  const specification: SpecificationUpload = {
    id: specificationId,
    projectId: input.projectId,
    fileName: input.fileName,
    uploadedAt: new Date().toISOString(),
    status: "needs_review",
    extractedCount: input.proposedItems.length,
    matchedItemCount: input.proposedItems.filter((item) => item.matched_existing_record).length,
    newItemCount: input.proposedItems.filter((item) => !item.matched_existing_record).length,
  };

  const extractedItems: ExtractedHandoverItem[] = input.proposedItems.map((item, index) => ({
    id: `${specificationId}-item-${index + 1}`,
    specificationId,
    itemType: item.item_type,
    title: item.title,
    category: item.category,
    location: item.location,
    extractedText: item.extracted_text,
    matchedExistingRecord: item.matched_existing_record,
    confidenceScore: item.confidence_score,
    status: getInitialExtractedItemStatus(item),
  }));

  await writeStore({
    ...store,
    specifications: [specification, ...store.specifications],
    extractedItems: [...extractedItems, ...store.extractedItems],
  });

  return { specification, extractedItems };
}

export async function createLocalExtractionFromClientRequest(request: ClientRequest) {
  const store = await readStore();
  const specificationId = `local-client-request-spec-${request.id}`;
  const existingItem = store.extractedItems.find((item) => item.id === `${request.id}-extracted-item`);

  if (existingItem) {
    return existingItem;
  }

  const specification: SpecificationUpload = {
    id: specificationId,
    projectId: request.projectId,
    fileName: `Client request - ${request.title}`,
    uploadedAt: new Date().toISOString(),
    status: "needs_review",
    extractedCount: 1,
    matchedItemCount: 0,
    newItemCount: 1,
  };
  const extractedItem: ExtractedHandoverItem = {
    id: `${request.id}-extracted-item`,
    specificationId,
    itemType: request.requestType,
    title: request.title,
    category: request.requestType === "product" ? "Client requested product" : "Client request",
    location: request.location,
    extractedText: request.details || "Client requested this missing handover item.",
    sourceSnippet: request.details || "Client requested this missing handover item.",
    matchedExistingRecord: null,
    sourceClientRequestId: request.id,
    confidenceScore: request.confidenceScore,
    status: "admin_review",
  };

  await writeStore({
    ...store,
    specifications: [specification, ...store.specifications],
    extractedItems: [extractedItem, ...store.extractedItems],
  });

  return extractedItem;
}

export async function getLocalExtractedItem(itemId: string) {
  const store = await readStore();
  return store.extractedItems.find((item) => item.id === itemId) || null;
}

export async function updateLocalExtractedItemStatus(
  itemId: string,
  status: ExtractedHandoverItem["status"],
) {
  const store = await readStore();
  let didUpdate = false;

  const extractedItems = store.extractedItems.map((item) => {
    if (item.id !== itemId) {
      return item;
    }

    didUpdate = true;
    return { ...item, status };
  });

  if (didUpdate) {
    await writeStore({ ...store, extractedItems });
  }

  return didUpdate;
}

export async function updateLocalExtractedItem(input: {
  itemId: string;
  itemType: ExtractedHandoverItem["itemType"];
  title: string;
  category: string;
  location: string;
  extractedText: string;
  sourceSnippet?: string;
  sourcePage?: number;
  confidenceScore: number;
}) {
  const store = await readStore();
  let didUpdate = false;

  const extractedItems = store.extractedItems.map((item) => {
    if (item.id !== input.itemId) {
      return item;
    }

    didUpdate = true;
    return {
      ...item,
      itemType: input.itemType,
      title: input.title,
      category: input.category,
      location: input.location,
      extractedText: input.extractedText,
      sourceSnippet: input.sourceSnippet,
      sourcePage: input.sourcePage,
      confidenceScore: input.confidenceScore,
      status: "edited" as const,
    };
  });

  if (didUpdate) {
    await writeStore({ ...store, extractedItems });
  }

  return didUpdate;
}

export async function publishLocalHandoverPackage() {
  const store = await readStore();
  const itemIds = store.extractedItems
    .filter((item) =>
      ["accepted", "auto_approved", "builder_approved", "global_approved"].includes(item.status),
    )
    .map((item) => item.id);

  await writeStore({
    ...store,
    publishedPackage: {
      itemIds,
      publishedAt: new Date().toISOString(),
    },
  });

  return { itemIds, publishedAt: new Date().toISOString() };
}

export async function getLocalPublishedItems() {
  const store = await readStore();
  const publishedIds = new Set(store.publishedPackage?.itemIds || []);

  return {
    publishedAt: store.publishedPackage?.publishedAt || null,
    items: store.extractedItems.filter((item) => publishedIds.has(item.id)),
  };
}
