type UnstructuredElementMetadata = {
  page_number?: number;
  text_as_html?: string;
  filename?: string;
  [key: string]: unknown;
};

type UnstructuredElement = {
  type?: string;
  text?: string;
  metadata?: UnstructuredElementMetadata;
  element_id?: string;
  [key: string]: unknown;
};

export type UnstructuredParseResult = {
  text: string;
  markdown: string;
  elements: UnstructuredElement[];
  diagnostics: {
    elementCount: number;
    tableCount: number;
    pageCount?: number;
    characterCount: number;
    warnings: string[];
  };
};

type UnstructuredParseInput = {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
};

const defaultApiUrl = "https://api.unstructuredapp.io/general/v0/general";

function getApiKey() {
  return process.env.UNSTRUCTURED_API_KEY?.trim() || "";
}

export function getUnstructuredApiUrl() {
  return (process.env.UNSTRUCTURED_API_URL?.trim() || defaultApiUrl).replace(/\/$/, "");
}

export function getUnstructuredStrategy() {
  return (process.env.UNSTRUCTURED_STRATEGY?.trim() || "hi_res").toLowerCase();
}

function getUnstructuredLanguages() {
  return (process.env.UNSTRUCTURED_LANGUAGES?.trim() || "eng")
    .split(",")
    .map((language) => language.trim())
    .filter(Boolean);
}

export function hasUnstructuredConfig() {
  return Boolean(getApiKey());
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function cleanHtmlCell(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\|/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlTableToMarkdown(html: string) {
  const rows: string[] = [];
  for (const rowMatch of Array.from(html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi))) {
    const rowHtml = rowMatch[1] || "";
    const cells = Array.from(rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi))
      .map((cellMatch) => cleanHtmlCell(cellMatch[1] || ""))
      .filter(Boolean);
    if (cells.length >= 2) rows.push(`| ${cells.join(" | ")} |`);
  }
  return rows.join("\n");
}

function textTableToMarkdown(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cells = line.split(/\s{2,}|\t+/).map((cell) => cell.trim()).filter(Boolean);
      return cells.length >= 2 ? `| ${cells.join(" | ")} |` : line;
    })
    .join("\n");
}

function elementToMarkdown(element: UnstructuredElement) {
  const type = element.type || "Element";
  const text = (element.text || "").trim();
  const html = typeof element.metadata?.text_as_html === "string" ? element.metadata.text_as_html.trim() : "";

  if (!text && !html) return "";
  if (type === "Title") return `## ${text}`;
  if (type === "Table" && html) {
    const tableMarkdown = htmlTableToMarkdown(html);
    return [`### Table`, tableMarkdown || textTableToMarkdown(text) || text].filter(Boolean).join("\n\n");
  }
  if (type === "Table") return [`### Table`, textTableToMarkdown(text) || text].join("\n\n");
  return text;
}

function collectPageCount(elements: UnstructuredElement[]) {
  const pages = new Set<number>();
  for (const element of elements) {
    const page = element.metadata?.page_number;
    if (typeof page === "number" && Number.isFinite(page)) pages.add(page);
  }
  return pages.size || undefined;
}

async function readError(response: Response) {
  const text = await response.text().catch(() => "");
  return text.slice(0, 500);
}

export async function parseDocumentWithUnstructured(input: UnstructuredParseInput): Promise<UnstructuredParseResult> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("UNSTRUCTURED_API_KEY is not configured.");

  const arrayBuffer = new ArrayBuffer(input.bytes.byteLength);
  new Uint8Array(arrayBuffer).set(input.bytes);

  const formData = new FormData();
  formData.set("files", new Blob([arrayBuffer], { type: input.mimeType || "application/pdf" }), input.fileName);
  formData.set("strategy", getUnstructuredStrategy());
  formData.set("output_format", "application/json");
  formData.set("coordinates", "false");
  formData.set("include_page_breaks", "true");
  formData.set("skip_infer_table_types", "[]");
  formData.set("split_pdf_page", "true");
  formData.set("split_pdf_allow_failed", "true");
  formData.set("split_pdf_concurrency_level", process.env.UNSTRUCTURED_SPLIT_PDF_CONCURRENCY_LEVEL?.trim() || "8");
  for (const language of getUnstructuredLanguages()) formData.append("languages", language);

  const response = await fetch(getUnstructuredApiUrl(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "unstructured-api-key": apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Unstructured API request failed with status ${response.status}: ${await readError(response)}`);
  }

  const body = await response.json();
  const elements = Array.isArray(body) ? body as UnstructuredElement[] : [];
  if (!elements.length) throw new Error("Unstructured API returned no document elements.");

  const markdown = elements.map(elementToMarkdown).filter(Boolean).join("\n\n");
  const text = elements.map((element) => element.text || "").filter(Boolean).join("\n\n");
  const tableCount = elements.filter((element) => element.type === "Table").length;

  return {
    text: markdown || text,
    markdown: markdown || text,
    elements,
    diagnostics: {
      elementCount: elements.length,
      tableCount,
      pageCount: collectPageCount(elements),
      characterCount: (markdown || text).length,
      warnings: [],
    },
  };
}
