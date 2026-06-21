#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const repoRoot = process.cwd();
const defaultInput = path.join(repoRoot, ".local-artifacts", "docling", "2074-legal-signed-outline-spec.md");
const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultInput;

if (!fs.existsSync(inputPath)) {
  console.error(`Missing Docling markdown artifact: ${inputPath}`);
  console.error("Run npm.cmd run docling:smoke:local first, or pass a markdown file path.");
  process.exit(1);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "handover-spec-extract-"));

function readSource(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

function rewriteAliases(source) {
  return source
    .replaceAll('from "@/lib/ai/extraction-guardrails"', 'from "./extraction-guardrails.mjs"')
    .replaceAll('from "@/lib/ai/spec-normalize"', 'from "./spec-normalize.mjs"')
    .replaceAll('from "@/lib/ai/spec-evidence"', 'from "./spec-evidence.mjs"')
    .replaceAll('from "@/lib/ai/spec-classify"', 'from "./spec-classify.mjs"')
    .replaceAll('from "@/lib/ai/spec-extract"', 'from "./spec-extract.mjs"');
}

function transpileToMjs(relativePath, outfile) {
  const result = ts.transpileModule(rewriteAliases(readSource(relativePath)), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      strict: true,
    },
    fileName: outfile.replace(/\.mjs$/, ".ts"),
  });

  fs.writeFileSync(path.join(tmpDir, outfile), result.outputText, "utf-8");
}

transpileToMjs("src/lib/ai/extraction-guardrails.ts", "extraction-guardrails.mjs");
transpileToMjs("src/lib/ai/spec-normalize.ts", "spec-normalize.mjs");
transpileToMjs("src/lib/ai/spec-evidence.ts", "spec-evidence.mjs");
transpileToMjs("src/lib/ai/spec-classify.ts", "spec-classify.mjs");
transpileToMjs("src/lib/ai/spec-extract.ts", "spec-extract.mjs");

const { buildSpecificationProposals } = await import(pathToFileURL(path.join(tmpDir, "spec-extract.mjs")));
const markdown = fs.readFileSync(inputPath, "utf-8");
const proposals = buildSpecificationProposals(markdown);
const byType = proposals.reduce((acc, item) => {
  acc[item.item_type] = (acc[item.item_type] || 0) + 1;
  return acc;
}, {});

console.log(JSON.stringify({
  input: inputPath,
  characters: markdown.length,
  proposalCount: proposals.length,
  byType,
  titles: proposals.map((item) => ({
    type: item.item_type,
    title: item.title,
    category: item.category,
    confidence: item.confidence_score,
    action: item.recommended_action,
  })),
}, null, 2));

if (proposals.length < 15) {
  console.error(`Expected at least 15 proposals from the real Docling artifact, got ${proposals.length}.`);
  process.exit(1);
}
