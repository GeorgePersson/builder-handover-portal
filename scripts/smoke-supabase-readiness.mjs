import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadDotEnvFile(path) {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const [rawName, ...rawValueParts] = trimmed.split("=");
    const name = rawName.trim();
    let value = rawValueParts.join("=").trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("\'") && value.endsWith("\'"))) {
      value = value.slice(1, -1);
    }

    process.env[name] ??= value;
  }
}

loadDotEnvFile(".env.local");
loadDotEnvFile(".env");

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const expectedTables = [
  "organisations",
  "organisation_members",
  "projects",
  "uploaded_documents",
  "document_extraction_jobs",
  "extracted_handover_items",
  "handover_approvals",
  "handover_open_events",
  "document_download_events",
  "project_credit_events",
];

const expectedBuckets = ["handover-documents"];

function fail(message) {
  console.error(`❌ ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`✅ ${message}`);
}

function redactUrl(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "[invalid-url]";
  }
}

const missingEnv = requiredEnv.filter((name) => !process.env[name]);

if (missingEnv.length > 0) {
  fail(`Missing required Supabase env vars: ${missingEnv.join(", ")}`);
  console.log("Add them to .env.local or export them before running this smoke.");
  process.exit();
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

console.log(`Supabase readiness smoke for ${redactUrl(supabaseUrl)}`);

for (const table of expectedTables) {
  const { error } = await supabase.from(table).select("*", { count: "exact", head: true }).limit(1);

  if (error) {
    fail(`REST table check failed for ${table}: ${error.message}`);
  } else {
    pass(`REST table available: ${table}`);
  }
}

const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();

if (bucketError) {
  fail(`Storage bucket listing failed: ${bucketError.message}`);
} else {
  const bucketNames = new Set((buckets ?? []).map((bucket) => bucket.name));

  for (const bucket of expectedBuckets) {
    if (bucketNames.has(bucket)) {
      pass(`Storage bucket available: ${bucket}`);
    } else {
      fail(`Missing storage bucket: ${bucket}`);
    }
  }
}

if (process.exitCode) {
  console.error("Supabase readiness smoke failed.");
  process.exit(process.exitCode);
}

console.log("Supabase readiness smoke passed. Browser auth/upload smoke is still required separately.");
