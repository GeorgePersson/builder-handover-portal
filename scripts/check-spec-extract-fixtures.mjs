#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const repoRoot = process.cwd();
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "handover-spec-extract-fixtures-"));

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

const { buildSpecificationProposals, getInitialExtractedItemReviewReason } = await import(pathToFileURL(path.join(tmpDir, "spec-extract.mjs")));
const fixturePath = path.join(repoRoot, "scripts", "fixtures", "spec-extract-row-fixtures.json");
const fixtures = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
const failures = [];

for (const fixture of fixtures) {
  const proposals = buildSpecificationProposals(fixture.markdown);
  for (const forbiddenTitle of fixture.forbiddenTitles || []) {
    if (proposals.some((item) => item.title === forbiddenTitle)) {
      failures.push(`${fixture.name}: unexpectedly extracted forbidden title ${JSON.stringify(forbiddenTitle)}`);
    }
  }

  if (!fixture.expectedTitle) {
    continue;
  }

  const proposal = proposals.find((item) => item.title === fixture.expectedTitle);

  if (!proposal) {
    failures.push(`${fixture.name}: missing expected title ${fixture.expectedTitle}. Got: ${proposals.map((item) => item.title).join(", ")}`);
    continue;
  }

  const source = proposal.source_snippet || proposal.extracted_text || "";
  const reviewReason = getInitialExtractedItemReviewReason(proposal);

  if (fixture.expectedAction && proposal.recommended_action !== fixture.expectedAction) {
    failures.push(`${fixture.name}: expected action ${fixture.expectedAction}, got ${proposal.recommended_action}`);
  }

  if (fixture.expectedCategory && proposal.category !== fixture.expectedCategory) {
    failures.push(`${fixture.name}: expected category ${fixture.expectedCategory}, got ${proposal.category}`);
  }

  for (const expected of fixture.expectedSourceIncludes || []) {
    if (!source.includes(expected) && !proposal.extracted_text.includes(expected)) {
      failures.push(`${fixture.name}: expected source/text to include ${JSON.stringify(expected)}. Got ${JSON.stringify(source)}`);
    }
  }

  for (const forbidden of fixture.forbiddenSourceIncludes || []) {
    if (source.includes(forbidden) || proposal.extracted_text.includes(forbidden)) {
      failures.push(`${fixture.name}: source/text included forbidden text ${JSON.stringify(forbidden)}. Got ${JSON.stringify(source)}`);
    }
  }

  if (fixture.expectedReviewReasonIncludes && !reviewReason.includes(fixture.expectedReviewReasonIncludes)) {
    failures.push(`${fixture.name}: expected review reason to include ${JSON.stringify(fixture.expectedReviewReasonIncludes)}. Got ${JSON.stringify(reviewReason)}`);
  }
}

if (failures.length > 0) {
  console.error(`Spec extraction fixture failures (${failures.length}):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(JSON.stringify({ fixtureCount: fixtures.length, status: "passed" }, null, 2));
