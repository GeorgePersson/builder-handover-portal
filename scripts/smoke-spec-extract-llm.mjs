#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const repoRoot = process.cwd();
const defaultInput = path.join(repoRoot, ".local-artifacts", "docling", "2074-legal-signed-outline-spec.md");
const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultInput;
const limit = Number.parseInt(process.env.OPENAI_SPEC_CLASSIFIER_LIMIT || "12", 10);

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf-8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1].startsWith("#")) continue;
    if (process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

loadEnv(path.join(repoRoot, ".env.local"));
loadEnv(path.join(repoRoot, ".env"));

if (!fs.existsSync(inputPath)) {
  console.error(`Missing Docling markdown artifact: ${inputPath}`);
  console.error("Run npm.cmd run docling:smoke:local first, or pass a markdown file path.");
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required for spec-extract:llm-smoke.");
  process.exit(2);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "handover-spec-llm-smoke-"));

function readSource(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

function rewriteAliases(source) {
  return source
    .replaceAll('from "@/lib/ai/extraction-guardrails"', 'from "./extraction-guardrails.mjs"')
    .replaceAll('from "@/lib/ai/spec-normalize"', 'from "./spec-normalize.mjs"')
    .replaceAll('from "@/lib/ai/spec-evidence"', 'from "./spec-evidence.mjs"')
    .replaceAll('from "@/lib/ai/spec-classify"', 'from "./spec-classify.mjs"')
    .replaceAll('from "@/lib/ai/spec-candidates"', 'from "./spec-candidates.mjs"')
    .replaceAll('from "@/lib/ai/spec-llm"', 'from "./spec-llm.mjs"')
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

for (const name of [
  "extraction-guardrails",
  "spec-normalize",
  "spec-evidence",
  "spec-classify",
  "spec-extract",
  "spec-candidates",
  "spec-llm",
]) {
  transpileToMjs(`src/lib/ai/${name}.ts`, `${name}.mjs`);
}

const { buildSpecificationProposals } = await import(pathToFileURL(path.join(tmpDir, "spec-extract.mjs")));
const { buildSpecExtractionCandidates } = await import(pathToFileURL(path.join(tmpDir, "spec-candidates.mjs")));
const { applySpecLlmClassifications, classifySpecCandidatesWithOpenAi } = await import(pathToFileURL(path.join(tmpDir, "spec-llm.mjs")));

const markdown = fs.readFileSync(inputPath, "utf-8");
const proposals = buildSpecificationProposals(markdown);
const candidates = buildSpecExtractionCandidates(proposals);
const llmCandidates = candidates.filter((candidate) => candidate.needs_llm).slice(0, Math.max(1, limit));
const result = await classifySpecCandidatesWithOpenAi({ candidates: llmCandidates });
const llmEnhancedProposals = applySpecLlmClassifications(proposals, candidates, result.classifications);

const actionCounts = proposals.reduce((acc, item) => {
  acc[item.recommended_action] = (acc[item.recommended_action] || 0) + 1;
  return acc;
}, {});

console.log(JSON.stringify({
  input: inputPath,
  deterministicProposalCount: proposals.length,
  deterministicActionCounts: actionCounts,
  candidateCount: candidates.length,
  llmEligibleCount: candidates.filter((candidate) => candidate.needs_llm).length,
  llmSentCount: result.sentCandidateCount,
  llmAcceptedCount: result.acceptedCount,
  llmRejectedCount: result.rejectedCount,
  llmEnhancedProposalCount: llmEnhancedProposals.length,
  provider: result.provider,
  model: result.model,
  tokenUsage: result.tokenUsage,
  classifications: result.classifications.map((classification) => ({
    candidate_id: classification.candidate_id,
    accepted: classification.accepted,
    validation_errors: classification.validation_errors,
    keep: classification.keep,
    title: classification.title,
    item_type: classification.item_type,
    review_lane: classification.review_lane,
    recommended_action: classification.recommended_action,
    category: classification.category,
    confidence: classification.confidence,
    reason: classification.reason,
    source_quote: classification.source_quote,
  })),
}, null, 2));
