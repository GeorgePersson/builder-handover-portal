#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const repoRoot = process.cwd();
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "handover-spec-text-normalizer-fixtures-"));

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
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      strict: true,
    },
    fileName: outfile.replace(/\.mjs$/, ".ts"),
  });
  fs.writeFileSync(path.join(tmpDir, outfile), result.outputText, "utf-8");
}

for (const name of ["spec-normalize", "spec-text-normalizer"]) {
  transpileToMjs(`src/lib/ai/${name}.ts`, `${name}.mjs`);
}

const { validateTextNormalizationRow } = await import(pathToFileURL(path.join(tmpDir, "spec-text-normalizer.mjs")));
const fixtures = JSON.parse(fs.readFileSync(path.join(repoRoot, "scripts", "fixtures", "spec-text-normalizer-fixtures.json"), "utf-8"));
const failures = [];

for (const fixture of fixtures) {
  const sourceById = new Map([[fixture.source.row_id, fixture.source]]);
  const result = validateTextNormalizationRow(fixture.row, sourceById);

  if (result.accepted !== fixture.expectedAccepted) {
    failures.push(`${fixture.name}: expected accepted=${fixture.expectedAccepted}, got ${result.accepted} errors=${result.validation_errors.join(",")}`);
  }

  for (const expected of fixture.expectedTextIncludes || []) {
    if (!result.normalized_text.includes(expected)) {
      failures.push(`${fixture.name}: expected normalized_text to include ${JSON.stringify(expected)}. Got ${JSON.stringify(result.normalized_text)}`);
    }
  }

  for (const expected of fixture.expectedErrors || []) {
    if (!result.validation_errors.includes(expected)) {
      failures.push(`${fixture.name}: expected validation error ${expected}. Got ${result.validation_errors.join(",")}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Spec text normalizer fixture failures (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({ fixtureCount: fixtures.length, status: "passed" }, null, 2));
