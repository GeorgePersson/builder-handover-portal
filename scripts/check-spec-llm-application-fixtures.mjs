#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const repoRoot = process.cwd();
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "handover-spec-llm-application-fixtures-"));

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

const { buildSpecExtractionCandidates } = await import(pathToFileURL(path.join(tmpDir, "spec-candidates.mjs")));
const { applySpecLlmClassifications } = await import(pathToFileURL(path.join(tmpDir, "spec-llm.mjs")));
const fixtures = JSON.parse(fs.readFileSync(path.join(repoRoot, "scripts", "fixtures", "spec-llm-application-fixtures.json"), "utf-8"));
const failures = [];

for (const fixture of fixtures) {
  const proposals = [fixture.proposal];
  const candidates = buildSpecExtractionCandidates(proposals);
  const classifications = fixture.classifications || [fixture.classification];
  const result = applySpecLlmClassifications(proposals, candidates, classifications);

  if (result.length !== fixture.expectedCount) {
    failures.push(`${fixture.name}: expected ${fixture.expectedCount} proposals, got ${result.length}`);
    continue;
  }

  if (result.length === 0) continue;

  for (const expectedItem of fixture.expectedItems || []) {
    const item = result.find((candidate) => candidate.title === expectedItem.expectedTitle);
    if (!item) {
      failures.push(`${fixture.name}: missing split item ${expectedItem.expectedTitle}. Got ${result.map((candidate) => candidate.title).join(", ")}`);
      continue;
    }

    if (expectedItem.expectedAction && item.recommended_action !== expectedItem.expectedAction) {
      failures.push(`${fixture.name}: ${expectedItem.expectedTitle} expected action ${expectedItem.expectedAction}, got ${item.recommended_action}`);
    }

    for (const expected of expectedItem.expectedTextIncludes || []) {
      if (!item.extracted_text.includes(expected)) {
        failures.push(`${fixture.name}: ${expectedItem.expectedTitle} expected extracted_text to include ${JSON.stringify(expected)}. Got ${JSON.stringify(item.extracted_text)}`);
      }
    }

    for (const forbidden of expectedItem.forbiddenTextIncludes || []) {
      if (item.extracted_text.includes(forbidden) || (item.source_snippet || "").includes(forbidden)) {
        failures.push(`${fixture.name}: ${expectedItem.expectedTitle} found forbidden text ${JSON.stringify(forbidden)} in output`);
      }
    }
  }

  if (fixture.expectedItems?.length) continue;

  const [item] = result;

  if (fixture.expectedAction && item.recommended_action !== fixture.expectedAction) {
    failures.push(`${fixture.name}: expected action ${fixture.expectedAction}, got ${item.recommended_action}`);
  }

  if (fixture.expectedTitle && item.title !== fixture.expectedTitle) {
    failures.push(`${fixture.name}: expected title ${fixture.expectedTitle}, got ${item.title}`);
  }

  for (const expected of fixture.expectedTextIncludes || []) {
    if (!item.extracted_text.includes(expected)) {
      failures.push(`${fixture.name}: expected extracted_text to include ${JSON.stringify(expected)}. Got ${JSON.stringify(item.extracted_text)}`);
    }
  }

  if (fixture.expectedSourceIncludes && !(item.source_snippet || "").includes(fixture.expectedSourceIncludes)) {
    failures.push(`${fixture.name}: expected source_snippet to include ${JSON.stringify(fixture.expectedSourceIncludes)}. Got ${JSON.stringify(item.source_snippet)}`);
  }

  for (const forbidden of fixture.forbiddenTextIncludes || []) {
    if (item.extracted_text.includes(forbidden) || (item.source_snippet || "").includes(forbidden)) {
      failures.push(`${fixture.name}: found forbidden text ${JSON.stringify(forbidden)} in output`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Spec LLM application fixture failures (${failures.length}):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ fixtureCount: fixtures.length, status: "passed" }, null, 2));
