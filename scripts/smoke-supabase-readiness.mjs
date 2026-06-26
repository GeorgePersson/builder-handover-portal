import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").replace(/^['"]|['"]$/g, "");
    }
  }
}

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const missing = requiredEnv.filter((key) => !process.env[key]);

function pass(message) { console.log(`PASS ${message}`); }
function fail(message) { console.error(`FAIL ${message}`); }

if (missing.length > 0) {
  fail(`Missing required local secret(s): ${missing.join(", ")}`);
  console.error("Configure them in .env.local or the cloud secret store. Secret values are intentionally not printed.");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
};

async function checkRestTable(table) {
  const url = `${supabaseUrl}/rest/v1/${table}?select=*&limit=1`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${table} returned HTTP ${response.status}: ${body.slice(0, 240)}`);
  }
  pass(`REST table reachable: ${table}`);
}

async function checkBucket(bucket) {
  const response = await fetch(`${supabaseUrl}/storage/v1/bucket/${bucket}`, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`bucket ${bucket} returned HTTP ${response.status}: ${body.slice(0, 240)}`);
  }
  const payload = await response.json();
  if (payload.public !== false) throw new Error(`bucket ${bucket} is not private`);
  pass(`Private storage bucket reachable: ${bucket}`);
}

async function checkRpcExists(functionName) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ org_name: "Codex Readiness Smoke", trading_name: null, contact_phone: null }),
  });

  const body = await response.text();
  if (response.status === 401 || response.status === 403) {
    pass(`RPC exposed and auth-protected: ${functionName}`);
    return;
  }
  if (response.status === 400 && /not_authenticated|auth\.uid|JWT/i.test(body)) {
    pass(`RPC exposed and requires authenticated user: ${functionName}`);
    return;
  }
  if (response.ok) {
    pass(`RPC callable with service role: ${functionName}`);
    return;
  }
  throw new Error(`${functionName} returned HTTP ${response.status}: ${body.slice(0, 240)}`);
}

const tables = [
  "uploaded_documents",
  "document_extraction_jobs",
  "project_credit_events",
  "handover_open_events",
  "document_download_events",
  "handover_approvals",
];

try {
  for (const table of tables) await checkRestTable(table);
  await checkBucket("handover-documents");
  await checkRpcExists("ensure_builder_workspace");
  console.log("PASS Supabase app readiness smoke completed without printing secrets.");
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
