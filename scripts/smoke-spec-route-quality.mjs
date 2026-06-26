#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").replace(/^['\"]|['\"]$/g, "");
  }
}

function containsBadVisibleText(value) {
  return /LLMReviewLane|LLMReviewReason|stand\s+ing|stand\s*ingfacing|lmainspressureelectric|kwelement|throostat|the\s+rmostat|overlapsbothfixedpanels|fixedpanels?|outsideof|shelfon|sideonend|bemountedonback|lookingat|mm-slides|NB:Slide/i.test(value || "");
}

function containsInvalidChecklistItem(value) {
  const text = String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return /\bproducer statements?\b.*\bcode compliance documents?\b/.test(text) ||
    /\bcode compliance documents?\b.*\bproducer statements?\b/.test(text) ||
    /\b(?:ccc|code compliance certificate)\b.*\b(?:producer statement|ps[1234])\b.*\b(?:documents?|certificates?)\b/.test(text);
}

loadDotEnvLocal();

const baseUrl = process.env.SPEC_ROUTE_SMOKE_BASE_URL || "http://127.0.0.1:3000";
const cookie = process.env.SPEC_ROUTE_SMOKE_COOKIE;
let projectId = process.env.SPEC_ROUTE_SMOKE_PROJECT_ID;
const pdfPath = process.env.SPEC_ROUTE_SMOKE_PDF || "C:/Users/hunte/Downloads/2074 legal signed outline spec.pdf.pdf";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.error("SPEC route quality smoke requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}
if (!fs.existsSync(pdfPath)) {
  console.error(`Smoke PDF not found: ${pdfPath}`);
  process.exit(1);
}

function projectRefFromUrl(url) {
  return new URL(url).hostname.split(".")[0];
}

function base64Url(value) {
  return Buffer.from(value, "utf-8").toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function createSmokeSession() {
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const email = `route-quality-smoke-${Date.now()}@example.com`;
  const password = `Smoke-${Date.now()}-Aa1!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(created.error?.message || "Could not create smoke user");
  const userId = created.data.user.id;
  const org = await admin.from("organisations").insert({ name: "Route quality smoke org", contact_email: email }).select("id").single();
  if (org.error) throw new Error(org.error.message);
  const member = await admin.from("organisation_members").insert({ organisation_id: org.data.id, user_id: userId, role: "builder_admin" });
  if (member.error) throw new Error(member.error.message);
  const project = await admin.from("projects").insert({
    organisation_id: org.data.id,
    name: "Route quality smoke project",
    address: "1 Smoke Test Lane",
    project_type: "new_build",
    status: "draft",
    created_by: userId,
  }).select("id").single();
  if (project.error) throw new Error(project.error.message);
  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const signedIn = await anon.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw new Error(signedIn.error?.message || "Could not sign in smoke user");
  const storageKey = `sb-${projectRefFromUrl(supabaseUrl)}-auth-token`;
  const cookieValue = `base64-${base64Url(JSON.stringify(signedIn.data.session))}`;
  return { cookie: `${storageKey}=${cookieValue}`, projectId: project.data.id, userId };
}

let authCookie = cookie;
if (!authCookie || !projectId) {
  const smoke = await createSmokeSession();
  authCookie = smoke.cookie;
  projectId = smoke.projectId;
}

const form = new FormData();
form.set("projectId", projectId);
const bytes = fs.readFileSync(pdfPath);
form.set("specificationPdf", new Blob([bytes], { type: "application/pdf" }), path.basename(pdfPath));

const response = await fetch(`${baseUrl}/api/specifications/process-pdf`, {
  method: "POST",
  headers: { Cookie: authCookie },
  body: form,
});
const body = await response.json().catch(() => ({}));
if (!response.ok) {
  console.error(JSON.stringify({ status: response.status, body }, null, 2));
  process.exit(1);
}

const uploadId = body.specification_id;
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const { data: reviewRows, error: reviewError } = await supabase
  .from("extracted_handover_items")
  .select("id,title,extracted_text,source_snippet,review_reason")
  .eq("specification_upload_id", uploadId);
if (reviewError) throw new Error(reviewError.message);

const { data: checklistRows, error: checklistError } = await supabase
  .from("project_handover_checklist_items")
  .select("id,title,extra_notes,source_metadata")
  .eq("project_id", projectId);
if (checklistError) throw new Error(checklistError.message);

const badReviewRows = (reviewRows || []).filter((row) => containsBadVisibleText(`${row.extracted_text || ""}\n${row.source_snippet || ""}`));
const badChecklistRows = (checklistRows || []).filter((row) => containsBadVisibleText(`${row.title || ""}\n${row.extra_notes || ""}\n${JSON.stringify(row.source_metadata || {})}`));
const invalidReviewRows = (reviewRows || []).filter((row) => containsInvalidChecklistItem(`${row.title || ""}\n${row.extracted_text || ""}\n${row.source_snippet || ""}`));
const invalidChecklistRows = (checklistRows || []).filter((row) => containsInvalidChecklistItem(`${row.title || ""}\n${row.extra_notes || ""}\n${JSON.stringify(row.source_metadata || {})}`));
const quality = body.final_quality_audit || {};

const summary = {
  uploadId,
  httpStatus: response.status,
  savedReviewRows: reviewRows?.length || 0,
  checklistRows: checklistRows?.length || 0,
  normalizer: body.ai_text_normalizer,
  classifier: {
    sent: body.ai_classifier?.sent_candidate_count,
    accepted: body.ai_classifier?.accepted_count,
    rejected: body.ai_classifier?.rejected_count,
  },
  finalCleanup: body.final_evidence_cleanup,
  finalQualityAudit: quality,
  badReviewCount: badReviewRows.length,
  badChecklistCount: badChecklistRows.length,
  invalidReviewCount: invalidReviewRows.length,
  invalidChecklistCount: invalidChecklistRows.length,
  badReviewSamples: badReviewRows.slice(0, 5),
  badChecklistSamples: badChecklistRows.slice(0, 5),
  invalidReviewSamples: invalidReviewRows.slice(0, 5),
  invalidChecklistSamples: invalidChecklistRows.slice(0, 5),
};
console.log(JSON.stringify(summary, null, 2));

if (!summary.savedReviewRows || !summary.checklistRows || badReviewRows.length || badChecklistRows.length || invalidReviewRows.length || invalidChecklistRows.length || (quality.needs_cleanup_count || 0) > 0) {
  process.exit(1);
}
