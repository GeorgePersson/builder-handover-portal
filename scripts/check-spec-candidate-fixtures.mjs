#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const repoRoot = process.cwd();
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "handover-spec-candidate-fixtures-"));

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
]) {
  transpileToMjs(`src/lib/ai/${name}.ts`, `${name}.mjs`);
}

const { buildSpecExtractionCandidates } = await import(pathToFileURL(path.join(tmpDir, "spec-candidates.mjs")));
const fixtures = JSON.parse(fs.readFileSync(path.join(repoRoot, "scripts", "fixtures", "spec-candidate-eligibility-fixtures.json"), "utf-8"));
const failures = [];

for (const fixture of fixtures) {
  const [candidate] = buildSpecExtractionCandidates([fixture.proposal]);

  if (!candidate) {
    failures.push(`${fixture.name}: no candidate returned`);
    continue;
  }

  if (candidate.needs_llm !== fixture.expectedNeedsLlm) {
    failures.push(`${fixture.name}: expected needs_llm=${fixture.expectedNeedsLlm}, got ${candidate.needs_llm} (${candidate.llm_reason})`);
  }

  if (fixture.expectedReasonIncludes && !candidate.llm_reason.toLowerCase().includes(fixture.expectedReasonIncludes.toLowerCase())) {
    failures.push(`${fixture.name}: expected reason to include ${JSON.stringify(fixture.expectedReasonIncludes)}, got ${JSON.stringify(candidate.llm_reason)}`);
  }

  if (typeof fixture.expectedPriority === "number" && candidate.spend_priority !== fixture.expectedPriority) {
    failures.push(`${fixture.name}: expected spend_priority=${fixture.expectedPriority}, got ${candidate.spend_priority}`);
  }

  if (typeof fixture.expectedMinPriority === "number" && candidate.spend_priority < fixture.expectedMinPriority) {
    failures.push(`${fixture.name}: expected spend_priority>=${fixture.expectedMinPriority}, got ${candidate.spend_priority}`);
  }
}

const orderingProposals = fixtures.map((fixture) => fixture.proposal);
const ordered = buildSpecExtractionCandidates(orderingProposals)
  .filter((candidate) => candidate.needs_llm)
  .sort((a, b) => b.spend_priority - a.spend_priority || a.id.localeCompare(b.id));

if (ordered.length >= 2 && ordered[0].spend_priority < ordered[1].spend_priority) {
  failures.push("candidate ordering is not descending by spend_priority");
}

if (failures.length > 0) {
  console.error(`Spec candidate fixture failures (${failures.length}):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ fixtureCount: fixtures.length, status: "passed" }, null, 2));
