import { extractPdfText, type ExtractedPdf } from "@/lib/server/pdf-extract";
import { parseDocumentWithLlamaCloud } from "@/lib/server/llamacloud";
import { parseDocumentWithUnstructured } from "@/lib/server/unstructured";
import { shouldUseDoclingLocalProvider, shouldUseLlamaCloudProvider, shouldUseUnstructuredProvider } from "@/lib/server/document-context-readiness";

export type DocumentContextProvider = "local_pdf" | "llamacloud_parse" | "docling_local" | "docling_http" | "unstructured_api";

export type DocumentContextResult = {
  provider: DocumentContextProvider;
  text: string;
  markdown?: string;
  parsedPdf?: ExtractedPdf;
  diagnostics: {
    pageCount?: number;
    tableCount?: number;
    chunkCount?: number;
    characterCount: number;
    warnings: string[];
    fallbackUsed: boolean;
    externalJobId?: string;
    externalFileId?: string;
  };
};

type ExtractDocumentContextInput = {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
};

function toLocalResult(parsed: ExtractedPdf, warnings: string[] = []): DocumentContextResult {
  return {
    provider: "local_pdf",
    text: parsed.text,
    parsedPdf: parsed,
    diagnostics: {
      pageCount: parsed.pages,
      tableCount: parsed.diagnostics.tableCount,
      chunkCount: parsed.diagnostics.chunkCount,
      characterCount: parsed.text.length,
      warnings: [...parsed.diagnostics.warnings, ...warnings],
      fallbackUsed: warnings.length > 0,
    },
  };
}

async function extractLocalPdfContext(input: ExtractDocumentContextInput, warnings: string[] = []) {
  const parsed = await extractPdfText(Buffer.from(input.bytes));
  return toLocalResult(parsed, warnings);
}

async function extractDoclingContext(input: ExtractDocumentContextInput): Promise<DocumentContextResult> {
  try {
    const { parseDocumentWithDoclingLocal } = await import("@/lib/server/docling");
    const parsed = await parseDocumentWithDoclingLocal(input);

    if (!parsed.text.trim()) {
      return extractLocalPdfContext(input, ["Docling returned no text or markdown, so the local PDF extractor was used."]);
    }

    return {
      provider: "docling_local",
      text: parsed.text,
      markdown: parsed.markdown,
      diagnostics: {
        pageCount: parsed.diagnostics.pageCount,
        tableCount: parsed.diagnostics.tableCount,
        characterCount: parsed.diagnostics.characterCount,
        warnings: parsed.diagnostics.warnings,
        fallbackUsed: false,
      },
    };
  } catch (error) {
    return extractLocalPdfContext(input, [
      error instanceof Error
        ? `Docling parse failed and local PDF extraction was used: ${error.message}`
        : "Docling parse failed and local PDF extraction was used.",
    ]);
  }
}

async function extractLlamaCloudContext(input: ExtractDocumentContextInput): Promise<DocumentContextResult> {
  try {
    const parsed = await parseDocumentWithLlamaCloud(input);
    const text = parsed.markdown || parsed.text;

    if (!text.trim()) {
      return extractLocalPdfContext(input, [
        "LlamaCloud returned no text or markdown, so the local PDF extractor was used.",
      ]);
    }

    return {
      provider: "llamacloud_parse",
      text,
      markdown: parsed.markdown,
      diagnostics: {
        characterCount: text.length,
        warnings: parsed.text && parsed.markdown ? [] : ["LlamaCloud returned partial parse output."],
        fallbackUsed: false,
        externalJobId: parsed.jobId,
        externalFileId: parsed.fileId,
      },
    };
  } catch (error) {
    return extractLocalPdfContext(input, [
      error instanceof Error
        ? `LlamaCloud parse failed and local PDF extraction was used: ${error.message}`
        : "LlamaCloud parse failed and local PDF extraction was used.",
    ]);
  }
}

async function extractUnstructuredContext(input: ExtractDocumentContextInput): Promise<DocumentContextResult> {
  try {
    const parsed = await parseDocumentWithUnstructured(input);
    const text = parsed.markdown || parsed.text;

    if (!text.trim()) {
      return extractLocalPdfContext(input, [
        "Unstructured returned no text or markdown, so the local PDF extractor was used.",
      ]);
    }

    return {
      provider: "unstructured_api",
      text,
      markdown: parsed.markdown,
      diagnostics: {
        pageCount: parsed.diagnostics.pageCount,
        tableCount: parsed.diagnostics.tableCount,
        chunkCount: parsed.diagnostics.elementCount,
        characterCount: parsed.diagnostics.characterCount,
        warnings: parsed.diagnostics.warnings,
        fallbackUsed: false,
      },
    };
  } catch (error) {
    return extractLocalPdfContext(input, [
      error instanceof Error
        ? `Unstructured parse failed and local PDF extraction was used: ${error.message}`
        : "Unstructured parse failed and local PDF extraction was used.",
    ]);
  }
}

export async function extractDocumentContext(input: ExtractDocumentContextInput): Promise<DocumentContextResult> {
  if (shouldUseUnstructuredProvider()) {
    return extractUnstructuredContext(input);
  }

  if (shouldUseDoclingLocalProvider()) {
    return extractDoclingContext(input);
  }

  if (shouldUseLlamaCloudProvider()) {
    return extractLlamaCloudContext(input);
  }

  return extractLocalPdfContext(input);
}
