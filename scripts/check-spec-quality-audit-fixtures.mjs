#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const repoRoot = process.cwd();
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "handover-spec-quality-audit-fixtures-"));

const source = fs.readFileSync(path.join(repoRoot, "src", "lib", "ai", "spec-quality-audit.ts"), "utf-8")
  .replaceAll('from "@/lib/ai/spec-extract"', 'from "./spec-extract.mjs"')
  .replaceAll('from "@/lib/ai/spec-normalize"', 'from "./spec-normalize.mjs"');
const result = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, strict: true },
  fileName: "spec-quality-audit.ts",
});
const normalizeResult = ts.transpileModule(fs.readFileSync(path.join(repoRoot, "src", "lib", "ai", "spec-normalize.ts"), "utf-8"), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, strict: true },
  fileName: "spec-normalize.ts",
});
fs.writeFileSync(path.join(tmpDir, "spec-quality-audit.mjs"), result.outputText, "utf-8");
fs.writeFileSync(path.join(tmpDir, "spec-normalize.mjs"), normalizeResult.outputText, "utf-8");
fs.writeFileSync(path.join(tmpDir, "spec-extract.mjs"), "export {};\n", "utf-8");

const { auditVisibleSpecItemText } = await import(pathToFileURL(path.join(tmpDir, "spec-quality-audit.mjs")));
const fixtures = JSON.parse(fs.readFileSync(path.join(repoRoot, "scripts", "fixtures", "spec-quality-audit-fixtures.json"), "utf-8"));
const failures = [];

for (const fixture of fixtures) {
  const audit = auditVisibleSpecItemText(fixture.input, 0);
  if (audit.status !== fixture.expectedStatus) failures.push(`${fixture.name}: expected status ${fixture.expectedStatus}, got ${audit.status}`);
  for (const issue of fixture.expectedIssues || []) {
    if (!audit.issues.includes(issue)) failures.push(`${fixture.name}: expected issue ${issue}, got ${audit.issues.join(",")}`);
  }
  for (const issue of audit.issues) {
    if (!(fixture.expectedIssues || []).includes(issue)) failures.push(`${fixture.name}: unexpected issue ${issue}`);
  }
}

if (failures.length > 0) {
  console.error(`Spec quality audit fixture failures (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({ fixtureCount: fixtures.length, status: "passed" }, null, 2));
