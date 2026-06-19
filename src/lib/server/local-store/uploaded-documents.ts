import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { UploadedProjectDocument } from "@/lib/document-workflow";

type LocalUploadedDocumentStore = {
  documents: UploadedProjectDocument[];
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
    return JSON.parse(raw) as LocalUploadedDocumentStore;
  } catch {
    return { documents: [] };
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
    documents: [document, ...store.documents],
  });

  return document;
}
