#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const repoRoot = process.cwd();

function loadDotEnv(fileName) {
  const envPath = resolve(repoRoot, fileName);
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnv(".env.local");
loadDotEnv(".env");

const requiredTables = [
  "builder_organisations",
  "builder_memberships",
  "projects",
  "clients",
  "uploaded_documents",
  "document_extraction_jobs",
  "extracted_handover_items",
  "handover_items",
  "handover_approvals",
  "project_credit_events",
  "handover_open_events",
  "document_download_events",
];

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const optionalEnv = [
  {
    name: "NEXT_PUBLIC_SITE_URL",
    why: "needed for production magic-link redirects and invite links",
  },
  {
    name: "OPENAI_API_KEY",
    why: "needed for live structured extraction beyond deterministic/local fallbacks",
  },
  {
    name: "LLAMACLOUD_API_KEY",
    why: "needed to validate the preferred LlamaCloud Parse path for scanned/table-heavy PDFs",
  },
  {
    name: "CLOUDFLARE_PIPELINE_URL",
    why: "needed to dispatch source-ready unknowns to the dry-run/live-guarded Worker pipeline",
  },
  {
    name: "CLOUDFLARE_PIPELINE_SECRET",
    why: "needed when the Worker endpoint requires authenticated app-to-pipeline requests",
  },
  {
    name: "RESEND_API_KEY",
    why: "needed for real client invite email delivery",
  },
  {
    name: "STRIPE_SECRET_KEY",
    why: "needed for Stripe Checkout and billing webhook smoke tests",
  },
];

function printResult(symbol, message) {
  console.log(`${symbol} ${message}`);
}

function missingRequiredEnv() {
  return requiredEnv.filter((name) => !process.env[name]);
}

async function checkTable(supabase, tableName) {
  const { error } = await supabase.from(tableName).select("*", { count: "exact", head: true });
  if (error) throw new Error(error.message);
}

async function main() {
  console.log("Supabase app configuration smoke");
  console.log("No secret values are printed by this script.\n");

  const missing = missingRequiredEnv();
  if (missing.length > 0) {
    for (const name of missing) printResult("❌", `Missing required env var: ${name}`);
    console.log("\nAdd the missing values to .env.local on desktop, then rerun npm.cmd run smoke:supabase-config.");
    process.exitCode = 1;
    return;
  }

  for (const name of requiredEnv) printResult("✅", `Required env var is present: ${name}`);
  for (const item of optionalEnv) {
    printResult(process.env[item.name] ? "✅" : "⚠️", `${item.name}: ${process.env[item.name] ? "present" : `missing - ${item.why}`}`);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  console.log("\nChecking required REST tables...");
  let failures = 0;
  for (const tableName of requiredTables) {
    try {
      await checkTable(supabase, tableName);
      printResult("✅", `REST table reachable: ${tableName}`);
    } catch (error) {
      failures += 1;
      printResult("❌", `REST table check failed for ${tableName}: ${error.message}`);
    }
  }

  console.log("\nChecking storage bucket...");
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw new Error(error.message);
    const bucket = data.find((candidate) => candidate.name === "handover-documents");
    if (!bucket) throw new Error("handover-documents bucket was not found");
    printResult("✅", `Storage bucket exists: ${bucket.name}${bucket.public ? " (public - verify this is intentional)" : " (private)"}`);
  } catch (error) {
    failures += 1;
    printResult("❌", `Storage bucket check failed: ${error.message}`);
  }

  if (failures > 0) {
    console.log(`\nSmoke failed with ${failures} Supabase configuration issue(s).`);
    process.exitCode = 1;
    return;
  }

  console.log("\nSupabase app configuration smoke passed.");
}

main().catch((error) => {
  console.error("❌ Supabase app configuration smoke crashed:", error.message);
  process.exitCode = 1;
});
