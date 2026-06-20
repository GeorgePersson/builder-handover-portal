#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadDotEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;

  const lines = readFileSync(path, "utf8").split(/\r?\n/);
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

function present(name) {
  return Boolean(process.env[name]?.trim());
}

function logCheck(ok, label, detail) {
  const marker = ok ? "PASS" : "BLOCKED";
  console.log(`${marker} ${label}${detail ? ` - ${detail}` : ""}`);
}

async function assertTableReadable(client, table) {
  const { error } = await client.from(table).select("*", { count: "exact", head: true }).limit(1);
  if (error) throw new Error(`${error.code ?? "REST_ERROR"}: ${error.message}`);
}

async function main() {
  loadDotEnvLocal();

  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const missing = required.filter((name) => !present(name));

  console.log("Supabase-mode smoke preflight");
  console.log("Secrets are never printed by this script.");

  for (const name of required) {
    logCheck(present(name), name, present(name) ? "configured" : "missing");
  }

  if (missing.length > 0) {
    console.log(`\nCannot run Supabase REST/auth smoke checks until these secrets are configured: ${missing.join(", ")}.`);
    console.log("Optional for realistic extraction: OPENAI_API_KEY and/or LLAMACLOUD_API_KEY.");
    console.log("Optional for password-login automation: TEST_BUILDER_EMAIL and TEST_BUILDER_PASSWORD.");
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const tables = [
    "organisations",
    "organisation_members",
    "projects",
    "uploaded_documents",
    "document_extraction_jobs",
    "extracted_items",
    "project_credit_events",
    "handover_open_events",
    "document_download_events",
    "handover_approvals",
  ];

  for (const table of tables) {
    await assertTableReadable(adminClient, table);
    logCheck(true, `REST table ${table}`, "readable with service role");
  }

  const { data: buckets, error: bucketError } = await adminClient.storage.listBuckets();
  if (bucketError) throw new Error(`Storage bucket list failed: ${bucketError.message}`);
  const hasBucket = buckets?.some((bucket) => bucket.name === "handover-documents");
  if (!hasBucket) throw new Error("Storage bucket handover-documents was not found.");
  logCheck(true, "Storage bucket handover-documents", "exists");

  if (present("TEST_BUILDER_EMAIL") && present("TEST_BUILDER_PASSWORD")) {
    const authClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data, error } = await authClient.auth.signInWithPassword({
      email: process.env.TEST_BUILDER_EMAIL,
      password: process.env.TEST_BUILDER_PASSWORD,
    });
    if (error) throw new Error(`Builder password login failed: ${error.message}`);
    logCheck(Boolean(data.user), "Builder password login", "authenticated test builder");
    await authClient.auth.signOut();
  } else {
    logCheck(false, "Builder password login", "set TEST_BUILDER_EMAIL and TEST_BUILDER_PASSWORD to automate this step");
  }

  if (!present("OPENAI_API_KEY") && !present("LLAMACLOUD_API_KEY")) {
    logCheck(false, "Realistic document extraction", "OPENAI_API_KEY and/or LLAMACLOUD_API_KEY missing; app can still exercise mocked/local fallback paths");
  } else {
    logCheck(true, "Extraction provider secret", "at least one realistic extraction provider key is configured");
  }

  console.log("\nPreflight complete. Next manual/browser step: run npm.cmd run dev, sign in, upload docs/demo-assets/bayview-demo-spec.csv from /builder/projects, resolve review blockers, and verify publish readiness.");
}

main().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
