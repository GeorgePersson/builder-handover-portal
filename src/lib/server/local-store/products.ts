import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ExtractedHandoverItem, ProductVersion } from "@/lib/types";
import { buildGlobalProductFromExtractedItem } from "@/lib/ai/source-enrichment";

type LocalProductStore = {
  products: ProductVersion[];
};

const storeRoot = path.join(process.cwd(), ".local-data");
const storePath = path.join(storeRoot, "global-products.json");

function assertStorePath() {
  const resolvedRoot = path.resolve(storeRoot);
  const resolvedPath = path.resolve(storePath);

  if (!resolvedPath.startsWith(resolvedRoot)) {
    throw new Error("Invalid local product store path.");
  }
}

async function readStore(): Promise<LocalProductStore> {
  assertStorePath();

  try {
    const raw = await readFile(storePath, "utf8");
    return JSON.parse(raw) as LocalProductStore;
  } catch {
    return { products: [] };
  }
}

async function writeStore(store: LocalProductStore) {
  assertStorePath();
  await mkdir(storeRoot, { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2));
}

export async function getLocalGlobalProducts() {
  const store = await readStore();
  return store.products;
}

export async function upsertLocalGlobalProductFromExtractedItem(item: ExtractedHandoverItem) {
  const store = await readStore();
  const product = buildGlobalProductFromExtractedItem(item);
  const products = [product, ...store.products.filter((existing) => existing.id !== product.id)];

  await writeStore({ products });

  return product;
}
