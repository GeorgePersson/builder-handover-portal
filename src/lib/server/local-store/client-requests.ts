import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ClientRequest } from "@/lib/types";

type LocalClientRequestStore = {
  requests: ClientRequest[];
};

const storeRoot = path.join(process.cwd(), ".local-data");
const storePath = path.join(storeRoot, "client-requests.json");

function assertStorePath() {
  const resolvedRoot = path.resolve(storeRoot);
  const resolvedPath = path.resolve(storePath);

  if (!resolvedPath.startsWith(resolvedRoot)) {
    throw new Error("Invalid local client request store path.");
  }
}

async function readStore(): Promise<LocalClientRequestStore> {
  assertStorePath();

  try {
    const raw = await readFile(storePath, "utf8");
    return JSON.parse(raw) as LocalClientRequestStore;
  } catch {
    return { requests: [] };
  }
}

async function writeStore(store: LocalClientRequestStore) {
  assertStorePath();
  await mkdir(storeRoot, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2));
}

export async function getLocalClientRequests() {
  const store = await readStore();
  return store.requests;
}

export async function saveLocalClientRequest(input: Omit<ClientRequest, "id" | "createdAt" | "status" | "confidenceScore">) {
  const store = await readStore();
  const request: ClientRequest = {
    ...input,
    id: `local-client-request-${Date.now()}`,
    status: "admin_review",
    confidenceScore: input.title.length >= 8 && input.details.length >= 20 ? 55 : 25,
    createdAt: new Date().toISOString(),
  };

  await writeStore({
    requests: [request, ...store.requests],
  });

  return request;
}

export async function getLocalClientRequest(requestId: string) {
  const store = await readStore();
  return store.requests.find((request) => request.id === requestId) || null;
}

export async function updateLocalClientRequestStatus(
  requestId: string,
  status: ClientRequest["status"],
) {
  const store = await readStore();
  let didUpdate = false;

  const requests = store.requests.map((request) => {
    if (request.id !== requestId) {
      return request;
    }

    didUpdate = true;
    return { ...request, status };
  });

  if (didUpdate) {
    await writeStore({ requests });
  }

  return didUpdate;
}
