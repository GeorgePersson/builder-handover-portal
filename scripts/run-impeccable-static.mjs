import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

const outDir = ".hermes/reports";
const outPath = `${outDir}/impeccable-static.json`;
const command = process.execPath;
const args = [
  ".agents/skills/impeccable/scripts/detect.mjs",
  "--json",
  "src/app",
  "src/components",
  "src/app/globals.css",
];

await mkdir(outDir, { recursive: true });

const child = spawn(command, args, {
  cwd: process.cwd(),
  shell: false,
  stdio: ["ignore", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk) => {
  stdout += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

const exitCode = await new Promise((resolve) => {
  child.on("close", resolve);
});

await writeFile(outPath, stdout || "[]\n");

let findingCount = null;
try {
  const parsed = JSON.parse(stdout || "[]");
  if (Array.isArray(parsed)) {
    findingCount = parsed.length;
  } else if (Array.isArray(parsed.findings)) {
    findingCount = parsed.findings.length;
  } else if (typeof parsed.total === "number") {
    findingCount = parsed.total;
  }
} catch {
  // Leave findingCount unknown; preserve raw report for inspection.
}

if (stderr.trim()) {
  console.error(stderr.trim());
}

const countText = findingCount === null ? "unknown number of" : findingCount;

if (exitCode === 0) {
  console.log(`Impeccable static audit passed with ${countText} finding(s). Report: ${outPath}`);
  process.exitCode = 0;
} else if (exitCode === 2) {
  console.log(`Impeccable static audit completed with ${countText} finding(s). Report: ${outPath}`);
  process.exitCode = 0;
} else {
  console.error(`Impeccable static audit failed with exit code ${exitCode}. Report: ${outPath}`);
  process.exitCode = Number(exitCode) || 1;
}
