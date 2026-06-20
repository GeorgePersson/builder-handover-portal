import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env.local");
const envFile = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

function readEnvValue(key) {
  if (process.env[key]) return { source: "process", set: true };
  const match = envFile.match(new RegExp(`^${key}=(.*)$`, "m"));
  return { source: match ? ".env.local" : "missing", set: Boolean(match?.[1]?.trim()) };
}

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
];
const optionalRealExtraction = ["LLAMACLOUD_API_KEY", "OPENAI_API_KEY"];
const optionalEmail = ["RESEND_API_KEY", "RESEND_FROM_EMAIL"];
const repoChecks = [
  "src/app/login/page.tsx",
  "src/lib/server/auth-actions.ts",
  "src/lib/server/actions.ts",
  "src/components/builder/projects-workspace.tsx",
  "src/lib/workflow-readiness.ts",
  "docs/demo-assets/bayview-demo-spec.csv",
];

console.log("Supabase-mode app smoke readiness\n");
console.log("Required configuration:");
let missingRequired = 0;
for (const key of required) {
  const value = readEnvValue(key);
  if (!value.set) missingRequired += 1;
  console.log(`- ${value.set ? "OK" : "MISSING"} ${key} (${value.source})`);
}

console.log("\nOptional realistic extraction configuration:");
for (const key of optionalRealExtraction) {
  const value = readEnvValue(key);
  console.log(`- ${value.set ? "OK" : "MISSING"} ${key} (${value.source})`);
}

console.log("\nOptional email delivery configuration:");
for (const key of optionalEmail) {
  const value = readEnvValue(key);
  console.log(`- ${value.set ? "OK" : "MISSING"} ${key} (${value.source})`);
}

console.log("\nRepository smoke prerequisites:");
let missingRepoFiles = 0;
for (const relativePath of repoChecks) {
  const ok = existsSync(path.join(root, relativePath));
  if (!ok) missingRepoFiles += 1;
  console.log(`- ${ok ? "OK" : "MISSING"} ${relativePath}`);
}

console.log("\nManual smoke checklist:");
console.log("1. Start the app with `npm.cmd run dev` or `npm run dev`.");
console.log("2. Request a magic link from `/login` for the builder test email; do not paste tokens into chat/logs.");
console.log("3. Confirm `/builder/onboarding` or `/builder/projects` bootstraps the builder workspace.");
console.log("4. Create/open a project and upload `docs/demo-assets/bayview-demo-spec.csv` through the project document flow, or use the real scanned PDF only when LlamaCloud/OCR is configured.");
console.log("5. Confirm an uploaded document row and extraction job row are created, then confirm review items appear.");
console.log("6. Try publishing before resolving review/source blockers and confirm the publish-readiness gate blocks it.");
console.log("7. Resolve/approve items, complete the builder approval checkboxes, publish, and open `/client/portal` as the matching client email.");

if (missingRequired || missingRepoFiles) {
  console.log("\nResult: NOT READY for Supabase-mode browser smoke in this environment.");
  process.exitCode = 1;
} else {
  console.log("\nResult: READY for Supabase-mode browser smoke. This script does not contact Supabase or print secrets.");
}
