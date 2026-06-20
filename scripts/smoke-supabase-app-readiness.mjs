import fs from "node:fs";
import path from "node:path";

const envFiles = [".env.local", ".env"];
for (const file of envFiles) {
  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) continue;
  const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const optionalRealExtractionEnv = ["OPENAI_API_KEY", "LLAMA_CLOUD_API_KEY"];
const requiredTables = [
  "organisations",
  "organisation_members",
  "projects",
  "clients",
  "uploaded_documents",
  "document_extraction_jobs",
  "extracted_handover_items",
  "project_credit_events",
  "handover_open_events",
  "document_download_events",
  "handover_approvals",
];

const checks = [];
const add = (ok, label, detail = "", required = true) => checks.push({ ok, label, detail, required });

for (const name of requiredEnv) add(Boolean(process.env[name]), `${name} is configured`);
for (const name of optionalRealExtractionEnv) {
  add(Boolean(process.env[name]), `${name} is configured`, `${name} is optional for scaffold smoke but required for realistic scanned/OCR extraction.`, false);
}

const demoAsset = path.join(process.cwd(), "docs", "demo-assets", "bayview-demo-spec.csv");
add(fs.existsSync(demoAsset), "demo upload asset exists", "docs/demo-assets/bayview-demo-spec.csv");

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function checkRestTable(table) {
  const url = `${supabaseUrl}/rest/v1/${table}?select=*&limit=1`;
  const response = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 180)}`);
  }
}

async function checkStorageBucket() {
  const response = await fetch(`${supabaseUrl}/storage/v1/bucket/handover-documents`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 180)}`);
  }
  const bucket = await response.json();
  if (bucket.public) throw new Error("handover-documents bucket is public; expected private bucket");
}

if (supabaseUrl && serviceRoleKey) {
  for (const table of requiredTables) {
    try {
      await checkRestTable(table);
      add(true, `Supabase REST table reachable: ${table}`);
    } catch (error) {
      add(false, `Supabase REST table reachable: ${table}`, error instanceof Error ? error.message : String(error));
    }
  }
  try {
    await checkStorageBucket();
    add(true, "private handover-documents bucket reachable");
  } catch (error) {
    add(false, "private handover-documents bucket reachable", error instanceof Error ? error.message : String(error));
  }
} else {
  add(false, "Supabase REST checks skipped", "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
}

const failed = checks.filter((check) => !check.ok && check.required);
for (const check of checks) {
  const icon = check.ok ? "✅" : check.required ? "❌" : "⚠️";
  console.log(`${icon} ${check.label}${check.detail ? ` - ${check.detail}` : ""}`);
}
const passed = checks.filter((check) => check.ok).length;
const warnings = checks.filter((check) => !check.ok && !check.required).length;
console.log(`\n${passed}/${checks.length} checks passed. ${warnings} optional warning${warnings === 1 ? "" : "s"}.`);
if (failed.length) process.exit(1);
