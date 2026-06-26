#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const repoRoot = process.cwd();
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "handover-spec-final-quality-fixtures-"));

function readSource(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

function rewriteAliases(source) {
  return source
    .replaceAll('from "@/lib/ai/spec-extract"', 'from "./spec-extract.mjs"')
    .replaceAll('from "@/lib/ai/spec-normalize"', 'from "./spec-normalize.mjs"')
    .replaceAll('from "@/lib/ai/spec-quality-audit"', 'from "./spec-quality-audit.mjs"');
}

function transpileToMjs(relativePath, outfile) {
  const result = ts.transpileModule(rewriteAliases(readSource(relativePath)), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, strict: true },
    fileName: outfile.replace(/\.mjs$/, ".ts"),
  });
  fs.writeFileSync(path.join(tmpDir, outfile), result.outputText, "utf-8");
}

for (const name of ["spec-normalize", "spec-quality-audit", "spec-final-cleanup"]) {
  transpileToMjs(`src/lib/ai/${name}.ts`, `${name}.mjs`);
}
fs.writeFileSync(path.join(tmpDir, "spec-extract.mjs"), "export {};\n", "utf-8");

const { cleanFinalSpecificationEvidence } = await import(pathToFileURL(path.join(tmpDir, "spec-final-cleanup.mjs")));
const fixtures = JSON.parse(fs.readFileSync(path.join(repoRoot, "scripts", "fixtures", "spec-final-quality-fixtures.json"), "utf-8"));
const failures = [];

process.env.OPENAI_SPEC_FINAL_CLEANUP_MODE = "off";

for (const fixture of fixtures) {
  const { items, result } = await cleanFinalSpecificationEvidence([fixture.input]);
  const output = `${items[0]?.extracted_text || ""}\n${items[0]?.source_snippet || ""}`;
  for (const expected of fixture.expectedContains || []) {
    if (!output.includes(expected)) failures.push(`${fixture.name}: expected output to include ${JSON.stringify(expected)}. Got ${JSON.stringify(output)}`);
  }
  for (const forbidden of fixture.expectedNotContains || []) {
    if (output.includes(forbidden)) failures.push(`${fixture.name}: forbidden visible text ${JSON.stringify(forbidden)} remained. Got ${JSON.stringify(output)}`);
  }
  if (result.dirtyAfterCount !== 0) failures.push(`${fixture.name}: expected dirtyAfterCount 0, got ${result.dirtyAfterCount}`);
  if (typeof fixture.expectedUnresolvedQualityCount === "number" && result.unresolvedQualityCount !== fixture.expectedUnresolvedQualityCount) {
    failures.push(`${fixture.name}: expected unresolvedQualityCount ${fixture.expectedUnresolvedQualityCount}, got ${result.unresolvedQualityCount}`);
  }
  if (fixture.expectedReviewNoteContains) {
    const note = items[0]?.quality_review_note || "";
    for (const expected of fixture.expectedReviewNoteContains) {
      if (!note.includes(expected)) failures.push(`${fixture.name}: expected quality_review_note to include ${JSON.stringify(expected)}. Got ${JSON.stringify(note)}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Spec final quality fixture failures (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({ fixtureCount: fixtures.length, status: "passed" }, null, 2));
