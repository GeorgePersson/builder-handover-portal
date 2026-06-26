import { createHash } from "node:crypto";

import { extractPdfText } from "@/lib/server/pdf-extract";

export type SourcePdfDownloadResult = {
  originalUrl: string;
  finalUrl: string;
  sourceDomain: string;
  contentType: string;
  sizeBytes: number;
  fileHash: string;
  textHash: string;
  extractedTextCharacters: number;
  pageCount: number;
  title?: string;
  identityCheck?: SourcePdfIdentityCheck;
  extractedText?: string;
  warnings: string[];
};

export type SourcePdfIdentityHints = {
  productName?: string;
  brand?: string;
  manufacturer?: string;
  model?: string;
};

export type SourcePdfIdentityCheck = {
  termsChecked: string[];
  matchedTerms: string[];
  missingTerms: string[];
};

const maxSourcePdfBytes = 25 * 1024 * 1024;
const trustedPdfPathHints = [
  "warranty",
  "manual",
  "care",
  "maintenance",
  "installation",
  "install",
  "datasheet",
  "data-sheet",
  "appraisal",
  "guide",
  "product",
];

function getHash(input: Buffer | string) {
  return createHash("sha256").update(input).digest("hex");
}

function isPrivateHost(hostname: string) {
  const lower = hostname.toLowerCase();
  return (
    lower === "localhost" ||
    lower === "127.0.0.1" ||
    lower === "::1" ||
    lower.endsWith(".local") ||
    lower.startsWith("10.") ||
    lower.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)
  );
}

function getFilenameFromUrl(url: URL) {
  const lastPart = url.pathname.split("/").filter(Boolean).at(-1);
  return lastPart ? decodeURIComponent(lastPart) : undefined;
}

export function validateSourcePdfUrl(rawUrl: string) {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Source URL is not valid.");
  }

  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new Error("Source URL must use HTTP or HTTPS.");
  }

  if (isPrivateHost(parsed.hostname)) {
    throw new Error("Source URL cannot target a private or local host.");
  }

  return parsed;
}

function getSourceWarnings(url: URL, contentType: string) {
  const warnings: string[] = [];
  const path = url.pathname.toLowerCase();

  if (!contentType.includes("application/pdf") && !path.endsWith(".pdf")) {
    warnings.push("The response was not clearly identified as a PDF.");
  }

  if (!trustedPdfPathHints.some((hint) => path.includes(hint))) {
    warnings.push("The source URL does not contain a warranty/manual/care-style path hint.");
  }

  return warnings;
}

function normalizeIdentityTerm(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getIdentityTerms(hints?: SourcePdfIdentityHints) {
  if (!hints) {
    return [];
  }

  return Array.from(new Set([
    hints.productName,
    hints.brand,
    hints.manufacturer,
    hints.model,
  ]
    .filter((term): term is string => Boolean(term?.trim()))
    .map((term) => normalizeIdentityTerm(term))
    .filter((term) => term.length >= 3)));
}

function inspectIdentityTerms(text: string, hints?: SourcePdfIdentityHints): SourcePdfIdentityCheck | undefined {
  const termsChecked = getIdentityTerms(hints);

  if (termsChecked.length === 0) {
    return undefined;
  }

  const normalizedText = normalizeIdentityTerm(text);
  const matchedTerms = termsChecked.filter((term) => normalizedText.includes(term));
  const missingTerms = termsChecked.filter((term) => !normalizedText.includes(term));

  return {
    termsChecked,
    matchedTerms,
    missingTerms,
  };
}

export async function downloadAndInspectSourcePdf(
  rawUrl: string,
  options?: { identityHints?: SourcePdfIdentityHints; includeExtractedText?: boolean },
): Promise<SourcePdfDownloadResult> {
  const parsed = validateSourcePdfUrl(rawUrl);
  const response = await fetch(parsed, {
    redirect: "follow",
    headers: {
      Accept: "application/pdf,*/*;q=0.8",
      "User-Agent": "BuilderHandoverPortal/0.1 source-check",
    },
  });

  if (!response.ok) {
    throw new Error(`Source PDF fetch failed with status ${response.status}.`);
  }

  const contentLength = response.headers.get("content-length");
  const declaredSize = contentLength ? Number(contentLength) : 0;

  if (declaredSize > maxSourcePdfBytes) {
    throw new Error("Source PDF is larger than the allowed 25 MB limit.");
  }

  const bytes = Buffer.from(await response.arrayBuffer());

  if (bytes.length > maxSourcePdfBytes) {
    throw new Error("Source PDF is larger than the allowed 25 MB limit.");
  }

  const finalUrl = new URL(response.url || parsed.href);
  validateSourcePdfUrl(finalUrl.href);

  const contentType = response.headers.get("content-type") || "application/octet-stream";
  let parsedPdf: Awaited<ReturnType<typeof extractPdfText>>;

  try {
    parsedPdf = await extractPdfText(bytes);
  } catch (error) {
    throw new Error(
      `Source PDF text extraction failed: ${error instanceof Error ? error.message : "Unknown PDF parser error."}`,
    );
  }

  const text = parsedPdf.text || "";
  const identityCheck = inspectIdentityTerms(text, options?.identityHints);
  const identityWarnings = identityCheck?.missingTerms.length
    ? [`Source text did not include expected identity terms: ${identityCheck.missingTerms.join(", ")}.`]
    : [];

  return {
    originalUrl: parsed.href,
    finalUrl: finalUrl.href,
    sourceDomain: finalUrl.hostname,
    contentType,
    sizeBytes: bytes.length,
    fileHash: getHash(bytes),
    textHash: getHash(text),
    extractedTextCharacters: text.length,
    pageCount: parsedPdf.pages,
    title: getFilenameFromUrl(finalUrl),
    identityCheck,
    extractedText: options?.includeExtractedText ? text : undefined,
    warnings: [
      ...getSourceWarnings(finalUrl, contentType),
      ...identityWarnings,
      ...parsedPdf.diagnostics.warnings,
    ],
  };
}
