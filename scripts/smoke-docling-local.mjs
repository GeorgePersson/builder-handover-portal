#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const defaultPdf = "C:\\Users\\hunte\\Downloads\\2074 legal signed outline spec.pdf.pdf";
const inputPdf = process.env.DOCLING_TEST_PDF || defaultPdf;
const outDir = process.env.DOCLING_OUTPUT_DIR || path.join(".local-artifacts", "docling");
const python = process.env.DOCLING_PYTHON || "python";
const script = process.env.DOCLING_SCRIPT || path.join("scripts", "docling-convert.py");
const basename = process.env.DOCLING_OUTPUT_BASENAME || "2074-legal-signed-outline-spec";

if (!fs.existsSync(inputPdf)) {
  console.error(`Docling smoke input PDF not found: ${inputPdf}`);
  console.error("Set DOCLING_TEST_PDF to a local scanned PDF path if using a different fixture.");
  process.exit(2);
}

if (!fs.existsSync(path.join(repoRoot, script))) {
  console.error(`Docling converter script not found: ${script}`);
  process.exit(3);
}

fs.mkdirSync(outDir, { recursive: true });

const result = spawnSync(
  python,
  [script, inputPdf, "--out-dir", outDir, "--basename", basename],
  {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  },
);

if (result.stdout) {
  process.stdout.write(result.stdout);
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (result.error) {
  console.error(`Failed to start Docling smoke command: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
