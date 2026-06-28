import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type DoclingParseResult = {
  text: string;
  markdown?: string;
  diagnostics: {
    pageCount?: number;
    tableCount?: number;
    characterCount: number;
    warnings: string[];
    elapsedSeconds?: number;
    doclingVersion?: string;
    artifactJsonPath?: string;
  };
};

type ParseDocumentWithDoclingInput = {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
};

function getDoclingPython() {
  return process.env.DOCLING_PYTHON?.trim() || "python";
}

export function getDoclingScriptPath() {
  const configuredScript = process.env.DOCLING_SCRIPT?.trim();

  if (configuredScript) {
    return path.resolve(/* turbopackIgnore: true */ process.cwd(), configuredScript);
  }

  return path.join(/* turbopackIgnore: true */ process.cwd(), "scripts", "docling-convert.py");
}

export function hasDoclingLocalScript() {
  return existsSync(/* turbopackIgnore: true */ getDoclingScriptPath());
}

function getDoclingTimeoutMs() {
  const value = Number(process.env.DOCLING_TIMEOUT_MS || 10 * 60 * 1000);
  return Number.isFinite(value) && value > 0 ? value : 10 * 60 * 1000;
}

function extensionFromInput(input: ParseDocumentWithDoclingInput) {
  const fromName = path.extname(input.fileName);
  if (fromName) {
    return fromName;
  }

  if (input.mimeType === "application/pdf") {
    return ".pdf";
  }

  return ".bin";
}

function getOutputPath(diagnostics: Record<string, unknown>, key: "markdown" | "json") {
  const outputs = diagnostics.outputs;
  if (!outputs || typeof outputs !== "object") {
    return undefined;
  }

  const value = (outputs as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

export async function parseDocumentWithDoclingLocal(input: ParseDocumentWithDoclingInput): Promise<DoclingParseResult> {
  const scriptPath = getDoclingScriptPath();

  if (!existsSync(/* turbopackIgnore: true */ scriptPath)) {
    throw new Error(`Docling converter script not found at ${scriptPath}`);
  }

  const tempDir = await mkdtemp(path.join(tmpdir(), "handover-docling-"));
  const inputPath = path.join(tempDir, `input${extensionFromInput(input)}`);
  const outDir = path.join(tempDir, "out");

  try {
    await writeFile(/* turbopackIgnore: true */ inputPath, Buffer.from(input.bytes));

    const { stdout } = await execFileAsync(
      getDoclingPython(),
      [scriptPath, inputPath, "--out-dir", outDir, "--basename", "document-context", "--quiet"],
      {
        cwd: path.join(/* turbopackIgnore: true */ process.cwd()),
        timeout: getDoclingTimeoutMs(),
        maxBuffer: 20 * 1024 * 1024,
        windowsHide: true,
      },
    );

    const diagnosticsPath = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);

    if (!diagnosticsPath) {
      throw new Error("Docling converter did not report a diagnostics path.");
    }

    const diagnostics = JSON.parse(await readFile(/* turbopackIgnore: true */ diagnosticsPath, "utf-8")) as Record<string, unknown>;
    const markdownPath = getOutputPath(diagnostics, "markdown");
    const jsonPath = getOutputPath(diagnostics, "json");
    const markdown = markdownPath ? await readFile(/* turbopackIgnore: true */ markdownPath, "utf-8") : "";
    const text = markdown.trim();

    if (!text) {
      throw new Error("Docling returned no markdown/text output.");
    }

    return {
      text,
      markdown,
      diagnostics: {
        pageCount: typeof diagnostics.pageCount === "number" ? diagnostics.pageCount : undefined,
        tableCount: typeof diagnostics.tableCount === "number" ? diagnostics.tableCount : undefined,
        characterCount: text.length,
        warnings: Array.isArray(diagnostics.warnings) ? diagnostics.warnings.filter((warning): warning is string => typeof warning === "string") : [],
        elapsedSeconds: typeof diagnostics.elapsedSeconds === "number" ? diagnostics.elapsedSeconds : undefined,
        doclingVersion: typeof diagnostics.doclingVersion === "string" ? diagnostics.doclingVersion : undefined,
        artifactJsonPath: jsonPath,
      },
    };
  } finally {
    await rm(/* turbopackIgnore: true */ tempDir, { force: true, recursive: true });
  }
}
