#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const repoRoot = process.cwd();
const defaultInput = path.join(repoRoot, ".local-artifacts", "docling", "2074-legal-signed-outline-spec.md");
const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultInput;

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf-8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1].startsWith("#")) continue;
    if (process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

loadEnv(path.join(repoRoot, ".env.local"));
loadEnv(path.join(repoRoot, ".env"));

if (!fs.existsSync(inputPath)) {
  console.error(`Missing Docling markdown artifact: ${inputPath}`);
  process.exit(1);
}
if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required for spec-normalizer:smoke.");
  process.exit(2);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "handover-spec-normalizer-smoke-"));

function readSource(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

function rewriteAliases(source) {
  return source
    .replaceAll('from "@/lib/ai/spec-normalize"', 'from "./spec-normalize.mjs"')
    .replaceAll('from "@/lib/ai/spec-text-normalizer"', 'from "./spec-text-normalizer.mjs"');
}

function transpileToMjs(relativePath, outfile) {
  const result = ts.transpileModule(rewriteAliases(readSource(relativePath)), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, strict: true },
    fileName: outfile.replace(/\.mjs$/, ".ts"),
  });
  fs.writeFileSync(path.join(tmpDir, outfile), result.outputText, "utf-8");
}

for (const name of ["spec-normalize", "spec-text-normalizer"]) {
  transpileToMjs(`src/lib/ai/${name}.ts`, `${name}.mjs`);
}

const { normalizeSpecTextWithOpenAi } = await import(pathToFileURL(path.join(tmpDir, "spec-text-normalizer.mjs")));
const markdown = fs.readFileSync(inputPath, "utf-8");
process.env.OPENAI_SPEC_NORMALIZER_ENABLED = "true";
process.env.OPENAI_SPEC_NORMALIZER_LIMIT = process.env.OPENAI_SPEC_NORMALIZER_LIMIT || "20";
process.env.OPENAI_SPEC_NORMALIZER_BATCH_SIZE = process.env.OPENAI_SPEC_NORMALIZER_BATCH_SIZE || "10";

const { text, normalizationResult } = await normalizeSpecTextWithOpenAi({ text: markdown });
const changedRows = normalizationResult.rows.filter((row) => row.accepted && row.normalized_text !== row.source_text);

console.log(JSON.stringify({
  input: inputPath,
  originalCharacters: markdown.length,
  normalizedCharacters: text.length,
  inputRowCount: normalizationResult.inputRowCount,
  selectedRowCount: normalizationResult.selectedRowCount,
  acceptedCount: normalizationResult.acceptedCount,
  rejectedCount: normalizationResult.rejectedCount,
  provider: normalizationResult.provider,
  model: normalizationResult.model,
  tokenUsage: normalizationResult.tokenUsage,
  changedSamples: changedRows.slice(0, 12).map((row) => ({
    row_id: row.row_id,
    source_text: row.source_text,
    normalized_text: row.normalized_text,
    corrections: row.corrections,
    confidence: row.confidence,
  })),
  rejectedSamples: normalizationResult.rows.filter((row) => !row.accepted).slice(0, 8).map((row) => ({
    row_id: row.row_id,
    errors: row.validation_errors,
    source_text: row.source_text,
    normalized_text: row.normalized_text,
  })),
}, null, 2));
