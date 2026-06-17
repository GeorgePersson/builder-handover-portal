import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFParse } from "pdf-parse";

export type ExtractedPdfTable = {
  page: number;
  rows: string[][];
};

export type ExtractedPdfChunk = {
  index: number;
  text: string;
  characterCount: number;
};

export type ExtractedPdf = {
  pages: number;
  text: string;
  pageTexts: { page: number; text: string; characterCount: number }[];
  tables: ExtractedPdfTable[];
  chunks: ExtractedPdfChunk[];
  diagnostics: {
    tableCount: number;
    chunkCount: number;
    averageCharactersPerPage: number;
    warnings: string[];
  };
};

const maxChunkCharacters = 12000;
const minUsefulPageCharacters = 80;

function normalizeText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeCell(cell: string) {
  return cell.replace(/\s+/g, " ").trim();
}

function tableToText(table: ExtractedPdfTable) {
  const rows = table.rows
    .map((row) => row.map(normalizeCell).filter(Boolean))
    .filter((row) => row.length > 0);

  if (rows.length === 0) {
    return "";
  }

  return [`Table on page ${table.page}`, ...rows.map((row) => row.join(" | "))].join("\n");
}

function chunkText(text: string) {
  const sections = text.split(/\n{2,}/).map((section) => section.trim()).filter(Boolean);
  const chunks: ExtractedPdfChunk[] = [];
  let current = "";

  for (const section of sections) {
    const next = current ? `${current}\n\n${section}` : section;

    if (next.length <= maxChunkCharacters) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push({
        index: chunks.length + 1,
        text: current,
        characterCount: current.length,
      });
    }

    if (section.length <= maxChunkCharacters) {
      current = section;
      continue;
    }

    for (let start = 0; start < section.length; start += maxChunkCharacters) {
      const slice = section.slice(start, start + maxChunkCharacters).trim();
      if (slice) {
        chunks.push({
          index: chunks.length + 1,
          text: slice,
          characterCount: slice.length,
        });
      }
    }
    current = "";
  }

  if (current) {
    chunks.push({
      index: chunks.length + 1,
      text: current,
      characterCount: current.length,
    });
  }

  return chunks;
}

export async function extractPdfText(buffer: Buffer): Promise<ExtractedPdf> {
  PDFParse.setWorker(
    pathToFileURL(path.join(process.cwd(), "node_modules/pdf-parse/dist/worker/pdf.worker.mjs")).toString(),
  );

  const parser = new PDFParse({ data: buffer });

  try {
    const parsed = await parser.getText({
      cellSeparator: " | ",
      pageJoiner: "\n\n--- Page page_number of total_number ---\n\n",
    });
    const tableResult = await parser.getTable();
    const tables = tableResult.pages.flatMap((page) =>
      page.tables.map((table) => ({
        page: page.num,
        rows: table.map((row) => row.map(normalizeCell)),
      })),
    );
    const pageTexts = parsed.pages.map((page) => {
      const text = normalizeText(page.text);

      return {
        page: page.num,
        text,
        characterCount: text.length,
      };
    });
    const tableText = tables.map(tableToText).filter(Boolean).join("\n\n");
    const text = normalizeText([parsed.text, tableText ? `Extracted tables\n\n${tableText}` : ""].filter(Boolean).join("\n\n"));
    const chunks = chunkText(text);
    const sparsePageCount = pageTexts.filter((page) => page.characterCount < minUsefulPageCharacters).length;
    const averageCharactersPerPage = parsed.total > 0 ? Math.round(text.length / parsed.total) : 0;
    const warnings: string[] = [];

    if (text.length === 0) {
      warnings.push("No selectable text was found. The PDF may be scanned or image-only.");
    } else if (sparsePageCount > 0) {
      warnings.push(`${sparsePageCount} page${sparsePageCount === 1 ? "" : "s"} had very little selectable text.`);
    }

    if (tables.length === 0) {
      warnings.push("No grid-based tables were detected. Text extraction still ran across all pages.");
    }

    return {
      pages: parsed.total,
      text,
      pageTexts,
      tables,
      chunks,
      diagnostics: {
        tableCount: tables.length,
        chunkCount: chunks.length,
        averageCharactersPerPage,
        warnings,
      },
    };
  } finally {
    await parser.destroy();
  }
}
