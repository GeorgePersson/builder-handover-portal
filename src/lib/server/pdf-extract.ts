import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFParse } from "pdf-parse";
import Tesseract from "tesseract.js";

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
    ocrPageCount: number;
    ocrCharacterCount: number;
    warnings: string[];
  };
};

const maxChunkCharacters = 12000;
const minUsefulPageCharacters = 80;
const maxOcrPages = 3;
const tesseractWorkerPath = path.join(
  process.cwd(),
  "node_modules/tesseract.js/src/worker-script/node/index.js",
);
const tesseractCorePath = path.join(
  process.cwd(),
  "node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js",
);
const tesseractCachePath = path.join(process.cwd(), ".local-data/tesseract-cache");

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

function parseTableLikeRow(line: string) {
  const pipeCells = line.split("|").map(normalizeCell).filter(Boolean);

  if (pipeCells.length >= 3) {
    return pipeCells;
  }

  const spacedCells = line.split(/\s{2,}/).map(normalizeCell).filter(Boolean);

  if (spacedCells.length >= 3) {
    return spacedCells;
  }

  return null;
}

function parseLooseScheduleRow(line: string) {
  const cells = line.split(/\s+/).map(normalizeCell).filter(Boolean);
  return cells.length >= 3 ? cells : null;
}

function isLikelyScheduleHeader(row: string[]) {
  const headerTerms = new Set([
    "area",
    "description",
    "document",
    "item",
    "location",
    "maintenance",
    "notes",
    "product",
    "requirement",
    "type",
  ]);

  return row.some((cell) => headerTerms.has(cell.toLowerCase()));
}

function detectTextTables(pageTexts: ExtractedPdf["pageTexts"]) {
  const tables: ExtractedPdfTable[] = [];

  for (const page of pageTexts) {
    let currentRows: string[][] = [];

    function flushRows() {
      if (currentRows.length >= 2) {
        tables.push({ page: page.page, rows: currentRows });
      }

      currentRows = [];
    }

    for (const rawLine of page.text.split("\n")) {
      const row = parseTableLikeRow(rawLine);

      if (row) {
        currentRows.push(row);
        continue;
      }

      flushRows();
    }

    flushRows();

    let looseRows: string[][] = [];

    function flushLooseRows() {
      if (looseRows.length >= 3 && isLikelyScheduleHeader(looseRows[0])) {
        tables.push({ page: page.page, rows: looseRows });
      }

      looseRows = [];
    }

    for (const rawLine of page.text.split("\n")) {
      const row = parseLooseScheduleRow(rawLine);

      if (row) {
        looseRows.push(row);
        continue;
      }

      flushLooseRows();
    }

    flushLooseRows();
  }

  return tables;
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

async function ocrSparsePages(parser: PDFParse, pageNumbers: number[]) {
  if (pageNumbers.length === 0) {
    return { text: "", pageCount: 0, characterCount: 0, warnings: [] as string[] };
  }

  const warnings: string[] = [];
  const ocrPages: string[] = [];
  const worker = await Tesseract.createWorker("eng", Tesseract.OEM.LSTM_ONLY, {
    workerPath: tesseractWorkerPath,
    corePath: tesseractCorePath,
    cachePath: tesseractCachePath,
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
      preserve_interword_spaces: "1",
    });

    for (const pageNumber of pageNumbers.slice(0, maxOcrPages)) {
      try {
        const screenshot = await parser.getScreenshot({
          partial: [pageNumber],
          desiredWidth: 1800,
          imageBuffer: true,
          imageDataUrl: false,
        });
        const image = screenshot.pages[0]?.data;

        if (!image) {
          warnings.push(`OCR could not render page ${pageNumber}.`);
          continue;
        }

        const result = await worker.recognize(Buffer.from(image));
        const pageText = normalizeText(result.data.text);

        if (pageText) {
          ocrPages.push(`OCR text from page ${pageNumber}\n${pageText}`);
        } else {
          warnings.push(`OCR found no readable text on page ${pageNumber}.`);
        }
      } catch {
        warnings.push(`OCR failed on page ${pageNumber}.`);
      }
    }
  } finally {
    await worker.terminate();
  }

  const text = normalizeText(ocrPages.join("\n\n"));

  return {
    text,
    pageCount: ocrPages.length,
    characterCount: text.length,
    warnings,
  };
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
    const gridTables = tableResult.pages.flatMap((page) =>
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
    const textTables = detectTextTables(pageTexts);
    const tables = [...gridTables, ...textTables];
    const sparsePageNumbers = pageTexts
      .filter((page) => page.characterCount < minUsefulPageCharacters)
      .map((page) => page.page);
    let ocr = { text: "", pageCount: 0, characterCount: 0, warnings: [] as string[] };

    if (sparsePageNumbers.length > 0) {
      try {
        ocr = await ocrSparsePages(parser, sparsePageNumbers);
      } catch {
        ocr.warnings.push("OCR fallback could not start for sparse PDF pages.");
      }
    }

    const tableText = tables.map(tableToText).filter(Boolean).join("\n\n");
    const text = normalizeText(
      [
        parsed.text,
        tableText ? `Extracted tables\n\n${tableText}` : "",
        ocr.text ? `OCR fallback\n\n${ocr.text}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
    const chunks = chunkText(text);
    const sparsePageCount = pageTexts.filter((page) => page.characterCount < minUsefulPageCharacters).length;
    const averageCharactersPerPage = parsed.total > 0 ? Math.round(text.length / parsed.total) : 0;
    const warnings: string[] = [...ocr.warnings];

    if (text.length === 0) {
      warnings.push("No selectable text was found. The PDF may be scanned or image-only.");
    } else if (sparsePageCount > 0) {
      warnings.push(`${sparsePageCount} page${sparsePageCount === 1 ? "" : "s"} had very little selectable text.`);
    }

    if (ocr.pageCount > 0) {
      warnings.push(`OCR fallback added text for ${ocr.pageCount} sparse page${ocr.pageCount === 1 ? "" : "s"}.`);
    } else if (sparsePageNumbers.length > 0) {
      warnings.push("OCR fallback did not recover additional text from sparse pages.");
    }

    if (sparsePageNumbers.length > maxOcrPages) {
      warnings.push(`OCR fallback was limited to the first ${maxOcrPages} sparse pages.`);
    }

    if (gridTables.length === 0 && textTables.length === 0) {
      warnings.push("No grid-based tables were detected. Text extraction still ran across all pages.");
    } else if (gridTables.length === 0 && textTables.length > 0) {
      warnings.push(
        `${textTables.length} table-like text section${textTables.length === 1 ? " was" : "s were"} inferred from aligned text.`,
      );
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
        ocrPageCount: ocr.pageCount,
        ocrCharacterCount: ocr.characterCount,
        warnings,
      },
    };
  } finally {
    await parser.destroy();
  }
}
