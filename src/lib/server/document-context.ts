import { extractPdfText, type ExtractedPdf } from "@/lib/server/pdf-extract";
import { hasLlamaCloudConfig, parseDocumentWithLlamaCloud } from "@/lib/server/llamacloud";

export type DocumentContextProvider = "local_pdf" | "llamacloud_parse";

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

function shouldUseLlamaCloud() {
  const provider = process.env.DOCUMENT_CONTEXT_PROVIDER?.trim().toLowerCase();
  if (provider === "local_pdf") {
    return false;
  }

  if (provider === "llamacloud") {
    return true;
  }

  return hasLlamaCloudConfig();
}

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

export async function extractDocumentContext(input: ExtractDocumentContextInput): Promise<DocumentContextResult> {
  if (!shouldUseLlamaCloud()) {
    return extractLocalPdfContext(input);
  }

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
