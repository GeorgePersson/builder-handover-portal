import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ProjectHandoverChecklistEvent,
  ProjectHandoverChecklistItem,
  ProjectHandoverChecklistItemInput,
} from "@/lib/project-handover-checklist";
import {
  buildProjectHandoverChecklistItem,
  deriveProjectHandoverChecklistStatus,
} from "@/lib/project-handover-checklist";

type LocalProjectHandoverChecklistStore = {
  items: ProjectHandoverChecklistItem[];
  events: ProjectHandoverChecklistEvent[];
};

const storeRoot = path.join(process.cwd(), ".local-data");
const storePath = path.join(storeRoot, "project-handover-checklist.json");

function assertStorePath() {
  const resolvedRoot = path.resolve(storeRoot);
  const resolvedPath = path.resolve(storePath);

  if (!resolvedPath.startsWith(resolvedRoot)) {
    throw new Error("Invalid local project handover checklist store path.");
  }
}

async function readStore(): Promise<LocalProjectHandoverChecklistStore> {
  assertStorePath();

  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalProjectHandoverChecklistStore>;
    return {
      items: parsed.items || [],
      events: parsed.events || [],
    };
  } catch {
    return {
      items: [],
      events: [],
    };
  }
}

async function writeStore(store: LocalProjectHandoverChecklistStore) {
  assertStorePath();
  await mkdir(storeRoot, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2));
}

export async function getLocalProjectHandoverChecklistItems(projectId?: string) {
  const store = await readStore();
  return projectId
    ? store.items.filter((item) => item.projectId === projectId)
    : store.items;
}

export async function getLocalProjectHandoverChecklistItem(itemId: string) {
  const store = await readStore();
  return store.items.find((item) => item.id === itemId) || null;
}

export async function saveLocalProjectHandoverChecklistItem(
  input: ProjectHandoverChecklistItemInput,
  actorId = "local-scaffold",
) {
  const store = await readStore();
  const timestamp = new Date().toISOString();
  const item = buildProjectHandoverChecklistItem(input, {
    id: `local-handover-checklist-item-${Date.now()}`,
    actorId,
    timestamp,
  });
  const event: ProjectHandoverChecklistEvent = {
    id: `local-handover-checklist-event-${Date.now()}`,
    projectId: item.projectId,
    checklistItemId: item.id,
    eventType: "created",
    actorId,
    notes: "Project handover checklist item created.",
    metadata: {
      status: item.status,
      value_sources: item.valueSources,
    },
    createdAt: timestamp,
  };

  await writeStore({
    items: [item, ...store.items],
    events: [event, ...store.events],
  });

  return item;
}

export async function updateLocalProjectHandoverChecklistItem(
  itemId: string,
  update: Partial<ProjectHandoverChecklistItem>,
  actorId = "local-scaffold",
  notes = "Project handover checklist item updated.",
) {
  const store = await readStore();
  const timestamp = new Date().toISOString();
  const existingItem = store.items.find((item) => item.id === itemId);

  if (!existingItem) {
    return null;
  }

  const merged: ProjectHandoverChecklistItem = {
    ...existingItem,
    ...update,
    sectionStatuses: {
      ...existingItem.sectionStatuses,
      ...(update.sectionStatuses || {}),
    },
    supportingDocumentIds: update.supportingDocumentIds || existingItem.supportingDocumentIds,
    sourceMetadata: {
      ...existingItem.sourceMetadata,
      ...(update.sourceMetadata || {}),
    },
    lastEditedBy: actorId,
    updatedAt: timestamp,
  };
  const updatedItem: ProjectHandoverChecklistItem = {
    ...merged,
    status: update.status || deriveProjectHandoverChecklistStatus(merged),
  };
  const items = store.items.map((item) => (item.id === itemId ? updatedItem : item));

  const event: ProjectHandoverChecklistEvent = {
    id: `local-handover-checklist-event-${Date.now()}`,
    projectId: updatedItem.projectId,
    checklistItemId: updatedItem.id,
    eventType: update.acceptedIncompleteAt ? "accepted_incomplete" : "updated",
    actorId,
    notes,
    metadata: {
      status: updatedItem.status,
    },
    createdAt: timestamp,
  };

  await writeStore({
    items,
    events: [event, ...store.events],
  });

  return updatedItem;
}

export async function getLocalProjectHandoverChecklistEvents(projectId?: string) {
  const store = await readStore();
  return projectId
    ? store.events.filter((event) => event.projectId === projectId)
    : store.events;
}
