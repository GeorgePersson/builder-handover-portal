# Implementation Phases

This is the active source-of-truth phase plan for the Builder Handover Portal.
Use it with `HANDOFF.md`, `docs/technical-architecture-source-of-truth.md`, and
`docs/cloudflare-pipeline-runbook.md`.

For the clean-start rebuild direction, use `docs/greenfield-build-plan.md`
first. That document locks the stack, product rules, data ownership, and build
order before implementation starts.

Completed work is intentionally compressed here so the active path stays clear.
Do not re-add completed task lists unless there is new work attached to them.

## Settled Tech Stack

The stack is settled in `docs/final-tech-stack-decision.md`:

- Next.js 16 app on Vercel.
- Supabase as the system of record for auth, relational data, RLS, storage,
  review state, billing state, and homeowner publication.
- Cloudflare Workers/Queues/Durable Objects/R2 for long-running source pipeline
  work and cache/temporary storage.
- Cloudflare D1 for pipeline SQL metadata, source cache indexes, idempotency,
  and cost/job events when the Worker pipeline needs relational state.
- Azure AI Content Understanding or Azure AI Document Intelligence as an
  optional document/context adapter for readable schema extraction, grounding,
  layout, and confidence checks.
- OpenAI Responses API for context-first structured extraction and selective
  source summarisation.
- Stripe for project credits.
- Resend for transactional email.

Future phases should refine this stack rather than reopening the product
database decision. A full Cloudflare-first app database migration would be a
separate project; the current rework uses Cloudflare SQL for pipeline state.

## Completed Baseline

The app has already completed the core local/Supabase document workflow through
final builder approval:

- Phase 0: architecture decision and controlled test setup.
- Phase 1: extraction usage/cost instrumentation.
- Phase 2: controlled 100-item OpenAI extraction test scaffolding.
- Phase 3: product identity evidence, fingerprints, dedupe metrics, and
  matching against approved products.
- Phase 4: source/versioning model documented.
- Phase 5: safe direct source-PDF downloader scaffold.
- Phase 6: source-search/enrichment benchmark routes and real scanned-spec
  sampling.
- Phase 7: project-credit usage-metering direction documented.
- Phase 8: initial Cloudflare dry-run Worker/Queue/Durable Object/R2 scaffold.
- Phase 9: privacy-minimal mode kept as a later product experiment.
- Phase 10: upload, review, publish-readiness, final approval, and
  homeowner-safe handover hardening.

Current important caveat: real source enrichment remains dry-run/off by default
in the product workflow. OpenAI/web-search enrichment should only be enabled
after context-first extraction, builder source-gap capture, the Cloudflare
dry-run pipeline, cost guards, and review persistence are working end to end.

New architecture reference:
`docs/azure-cloudflare-context-processing-architecture.md` defines the
Azure/Cloudflare rework, including Azure conversion checks, Cloudflare D1
pipeline storage, database-first matching, builder clarification, and
search-last enrichment.

## Phase 11A: Context-First Extraction And Source Gaps

Goal: make the uploaded document and builder review loop the default path before
paid source enrichment.

Current status: started. The OpenAI extraction schema now asks for context
classification, document evidence, missing fields, and builder info needed. The
builder project review queue shows those prompts when present. Marking an item
as builder-supplied records review metadata that keeps it project-specific and
admin-review-required for global reuse.

Tasks:

- Keep the upload workflow spec/document-first.
- Extract into a strict context schema before internet/source enrichment.
- Classify rows as source-ready, builder-input-needed, project document,
  generic allowance, admin/contract, or not handover-relevant.
- Show missing fields and builder info prompts in the project review queue.
- Treat unfindable/custom/trade/supplier-quote items as source gaps that the
  builder can resolve with supplied information or evidence.
- Store builder-supplied items as project-safe handover records only after
  builder review/final approval.
- Keep global reuse behind admin review.

Exit criteria:

- A supported upload can produce visible missing-field/builder-info prompts.
- Builder-supplied source-gap items are eligible for the project handover but
  are not globally approved automatically.
- Source-ready counts shrink to items that actually deserve optional search.
- No live web search, crawling, source PDF fetching, or paid enrichment is
  required for this phase.

## Phase 11B: Azure Context Processing Spike

Goal: decide whether Azure AI Content Understanding or Azure AI Document
Intelligence should become the first-pass PDF/context processor before schema
extraction and search.

Tasks:

- Add an adapter boundary for document context extraction so the app can switch
  between the current local extractor and Azure.
- Test direct PDFs, scanned PDFs, image-only PDFs, table-heavy schedules, Word,
  and Excel inputs.
- Confirm whether each file type can be sent directly to Azure or needs local
  conversion/OCR first.
- Preserve page, section, table, snippet, and confidence/grounding metadata.
- Normalize Azure output into the strict handover context schema.
- Compare cost, latency, source evidence quality, and failure modes against the
  current local extraction path.

Exit criteria:

- A real builder spec can produce grounded schema rows through the Azure
  adapter.
- The review UI can show source snippets/page evidence from Azure-normalized
  output.
- The system records when Azure was skipped, failed, or required fallback
  conversion.

## Phase 11C: Database-First Builder Clarification Gate

Goal: eliminate repeat source-search spend by matching known items and asking
for missing context before live internet/source search.

Tasks:

- Match extracted rows against approved product/source records before search.
- Show high-confidence database matches to the builder for accept/edit/reject.
- Route possible matches to confirmation instead of search.
- Ask for more context on low-confidence rows before search.
- Re-run database matching after builder context is supplied.
- Queue only builder-confirmed source-ready unknowns for Cloudflare search
  batches.

Exit criteria:

- High-confidence known matches can become package-ready without web search.
- Low-confidence rows cannot trigger source search until the builder supplies
  enough identity/context.
- Clarified rows are matched against the database again before any paid source
  work.

## Phase 11D: Cloudflare D1 Pipeline SQL

Goal: give the Worker pipeline SQL state without moving the whole product
database.

Current status: remote D1 is created and schema-applied. The Cloudflare account
now has a `builder-handover-pipeline` D1 database bound as `PIPELINE_DB` in
`cloudflare/handover-pipeline/wrangler.jsonc`. The schema apply created the
pipeline metadata tables and the readback confirmed the expected table list.
The dry-run Worker mirrors job creation, candidate queueing, batch completion,
and zero-cost dry-run meter events through prepared statements when the binding
is active. No raw PDFs, auth records, billing truth, review state, or homeowner
publication data is stored in D1.

Tasks:

- Add D1 schema for pipeline jobs, job events, source candidates, source
  results, source cache indexes, idempotency keys, and cost meter events.
- Bind D1 to the Worker and use prepared statements for reads/writes.
- Keep raw files and source PDFs in R2, not D1.
- Keep app auth, tenant permissions, billing, review state, and homeowner
  publication in Supabase/local scaffold during this phase.

Exit criteria:

- Worker dry-run jobs can create/read/update D1 pipeline rows.
- D1 state is mirrored or synced back to the app where builders need progress.
- No homeowner-facing or auth-critical product truth has moved to D1 by
  accident.

Remaining setup:

- Run a local Worker D1 dry-run job smoke with the bound database and confirm
  `/jobs` mirrors rows into D1 as expected.

## Phase 11: Cloudflare Dry-Run Local Dispatch

Goal: connect the existing upload/extraction flow to the Cloudflare pipeline
without calling OpenAI, web search, crawling, or paid enrichment services.

Current status: local dry-run contracts are smoke-tested. `cloudflare/handover-pipeline/`
contains a dry-run Worker with a Queue producer/consumer, SQLite-backed Durable
Object job status, and R2 binding. The Next.js app can dispatch source-ready
identities to a configured dry-run Worker through `CLOUDFLARE_PIPELINE_URL`; if
the URL is not configured, the extraction job records `skipped/not_configured`.
The local Worker accepted a dry-run job and completed its queued batch after the
local queue timeout. The builder project modal renders completed job metrics,
source-ready counts, and `Cloudflare dry-run` status from local scaffold job
usage metrics. A credentialed/manual UI file-upload smoke is still useful
because Codex browser automation could not attach a file to the upload input.

Tasks:

- Keep the Cloudflare Worker hard-coded dry-run until explicit live-enrichment
  phases begin.
- Use `CLOUDFLARE_PIPELINE_URL=http://127.0.0.1:8787` for local Worker tests.
- Dispatch source-ready candidates after extraction and product matching.
- Store Cloudflare dispatch status in extraction job usage metrics.
- Show the dry-run dispatch status in the builder project workspace.
- Add a local smoke checklist for upload -> extraction -> Cloudflare dry-run
  queue -> project modal status -> publish readiness.

Exit criteria:

- A local project document upload can create extracted items and queue a
  Cloudflare dry-run job.
- The builder project modal shows source-ready counts and Cloudflare dry-run
  status.
- No OpenAI source enrichment, web search, crawling, or paid Cloudflare resource
  behavior is triggered by this phase.

Remaining manual check:

- Upload a supported project document through the real `/builder/projects`
  modal with the local Worker running, then confirm the same status appears from
  the app-created extraction job rather than the local scaffold smoke record.

## Phase 12: Cloudflare Account And Public Worker Dry Run

Goal: deploy the same dry-run pipeline to Hunter's Cloudflare account and prove
it works from a public Workers domain.

Current status: public dry-run Worker is deployed and smoke-tested at
`https://builder-handover-pipeline.gpersson2002.workers.dev`. The Cloudflare
queue, R2 bucket, D1 binding, Durable Object binding, and shared secret are
configured. Public `/health` returned `d1Configured: true`; authenticated
`POST /jobs` accepted a two-candidate dry-run job; the queue consumer completed
one batch with `dry_run_not_enriched` results; D1 readback confirmed 1 job,
2 source candidates, 3 job events, and 1 zero-cost meter event. No R2 objects,
OpenAI calls, web searches, or live source enrichment ran.

Tasks:

- Run `npx.cmd wrangler login`.
- Create the queue `builder-handover-source-enrichment`.
- Create the R2 bucket `builder-handover-source-cache`.
- Set `PIPELINE_SHARED_SECRET` as a Wrangler secret before public testing.
- Deploy with `npm.cmd run cloudflare:deploy`.
- Set `CLOUDFLARE_PIPELINE_URL` in `.env.local` to the deployed Workers URL.
- Set `CLOUDFLARE_PIPELINE_SHARED_SECRET` locally to match the Worker secret.
- Run a small upload through the app and confirm the public Worker receives a
  dry-run job.

Exit criteria:

- Public `/health` works.
- Public `POST /jobs` works with the shared secret.
- Next.js can dispatch source-ready identities to the public Worker.
- Job status is readable through the Worker for manual verification.

Remaining setup:

- Run the real `/builder/projects` app upload smoke against the public Worker
  URL in `.env.local` and confirm the project modal can refresh persisted
  pipeline status.

## Phase 13: Progress Sync And Supabase Persistence

Goal: make Cloudflare job progress durable in the main app database, not only in
the Worker Durable Object.

Current status: started. The app now has a server action that reads a dry-run
Worker job status and merges the latest Cloudflare progress back into
`document_extraction_jobs.usage_metrics` in Supabase mode, or the local scaffold
job record in local mode. The builder project workspace exposes a refresh
control for dispatched Worker jobs and displays completed/processing batch
progress from the stored usage metrics.

The Worker also has a dry-run batch retry primitive:
`POST /jobs/<jobId>/retry-failed` requeues only failed batches using the
candidates retained in Durable Object job status. The endpoint is authenticated
with the same `PIPELINE_SHARED_SECRET` as the other Worker routes and does not
call OpenAI, web search, R2 source writes, or live enrichment. The builder
project workspace now exposes this retry route through a `Retry failed batches`
action when stored Cloudflare metrics indicate a failed job or failed batch
count, then persists retry status and requeued counts back into usage metrics.
The local module smoke `npm.cmd run cloudflare:smoke:retry` confirms the
Worker's failure-test mode fails a batch once, requeues only that failed batch,
and completes the retry without touching public Cloudflare resources.

Tasks:

- Add Supabase columns or a companion table for pipeline job id, status,
  candidate count, batch count, completed batch count, failed batch count, and
  last sync time.
- Mirror the same fields into local scaffold persistence.
- Add a server-side poll/sync action or internal route that reads Worker job
  status and stores it on the extraction job.
- Show batch progress and failure state in the project workspace.
- Ensure publish readiness can block on incomplete pipeline work once live
  enrichment begins.

Exit criteria:

- Refreshing the app does not lose Cloudflare pipeline progress.
- Supabase and local scaffold modes show equivalent pipeline status.
- Failed or incomplete Cloudflare jobs are visible and retryable.

Remaining setup:

- Run a real local Worker smoke from `/builder/projects`, click the refresh
  control after queue completion, and confirm the persisted metrics survive page
  refresh in both local scaffold and Supabase modes.
- Smoke a failing dry-run scenario from the project workspace to prove the retry
  button surfaces the already-tested Worker retry path and the follow-up refresh
  survives page reload in both local scaffold and Supabase modes.
- Decide the publish-readiness blocking rule for incomplete pipeline work before
  live enrichment is enabled.

## Phase 14: Source Cache And R2 Dry-Run Records

Goal: prove source document cache metadata and R2 object paths without fetching
or storing real source PDFs yet.

Tasks:

- Add a dry-run R2 write/read smoke path using synthetic text metadata only.
- Define source cache object key format by product fingerprint/source hash.
- Store source-cache references in job metadata.
- Confirm local Wrangler uses simulated bindings unless remote bindings are
  deliberately enabled.

Exit criteria:

- The Worker can write and read a harmless synthetic cache record.
- The app can display the cache key/status as dry-run metadata.
- No real third-party PDFs are downloaded in this phase.

## Phase 15: Live Source Enrichment Pilot

Goal: enable one tightly capped live source-enrichment batch after dry-run,
progress sync, context-first filtering, builder source-gap capture, and cost
guards are working.

Current status: guardrails started. The Worker rejects `PIPELINE_MODE=live_pilot`
unless `LIVE_PILOT_ENABLED=true`, caps admission with
`LIVE_PILOT_MAX_CANDIDATES` defaulting to 1, requires explicit
`LIVE_PILOT_MAX_SEARCHES` and `LIVE_PILOT_MAX_ESTIMATED_COST_USD`, and still
reports `liveEnrichmentEnabled: false` plus `dryRunEnrichment: true`. This means
the gate can be tested before any live search/enrichment implementation exists.
`npm.cmd run cloudflare:smoke:live-guard` verifies disabled live-pilot jobs are
rejected, oversized jobs are rejected, missing-budget jobs are rejected, and a
budgeted one-candidate admitted job still queues dry-run work only. The admitted
safety snapshot is persisted in Durable Object job status and copied onto queue
messages, so later live source logic can consume the approved budget rather than
reading fresh mutable environment state mid-job. The queue consumer rejects
`PIPELINE_MODE=live_pilot` messages that do not carry the admitted safety
budget.

Tasks:

- Keep the explicit `PIPELINE_MODE=live_pilot` / `LIVE_PILOT_ENABLED=true` gate
  default-off.
- Keep the max candidate count plus explicit per-job search/cost budgets.
- Preserve the admitted budget snapshot on job status and source batch messages.
- Reject live-pilot queue messages that do not carry the admitted budget
  snapshot.
- Run one source-ready candidate through official-source search.
- Do not search builder-input-needed or generic/source-gap rows until the
  builder supplies enough identity detail.
- Inspect at most one direct PDF only when the candidate has strong identity.
- Store confidence, missing fields, source URLs, and review reasons.
- Route uncertain or generic results to builder/admin review.

Exit criteria:

- Live-pilot admission remains impossible unless the explicit enable flag is
  present, the candidate cap is respected, and search/cost budgets are set.
- Accepted live-pilot jobs expose the admitted budget snapshot through status
  and queue payloads.
- Live-pilot queue execution refuses messages without that admitted budget
  snapshot.
- One live candidate can be enriched and reviewed.
- Cost/search usage is recorded and visible.
- No homeowner-facing data changes until the builder/admin approves it.

## Phase 16: Full Upload-To-Send-Off Cloudflare Workflow

Goal: use Cloudflare for the long-running pipeline while keeping Next.js and
Supabase as the product app/system of record.

Tasks:

- Move long source enrichment batches out of Next.js request time.
- Keep extraction, matching, review, source enrichment, publish readiness, final
  approval, and homeowner handover data connected.
- Queue batches by unique source-ready identity after cache lookup.
- Sync completed source findings back to Supabase/local scaffold.
- Let builders resolve missing-info rows, supplier quote references, generic
  allowances, and low-confidence findings before sending.
- Verify local and public-domain flows:
  upload -> extraction -> Cloudflare batches -> review -> final approval ->
  send package -> homeowner visibility.

Exit criteria:

- A real project can be processed locally and through a public Worker domain.
- The builder can complete review and send the package.
- The homeowner portal only shows approved homeowner-safe handover items.

## Phase 17: Production Hardening

Goal: make the Cloudflare pipeline safe enough for real paid builder projects.

Tasks:

- Idempotency keys for uploads, extraction jobs, source batches, and retries.
- Dead-letter handling and operator recovery.
- Audit logs for AI calls, search calls, source changes, approvals, and publish.
- Cost anomaly monitoring and hard spend limits.
- Raw upload/source cache retention controls.
- Public-domain security review and rate limiting.
- Admin tools for retrying failed batches and approving/rejecting sources.

Exit criteria:

- The workflow is measurable, reviewable, recoverable, cost-guarded, and honest
  about missing fields and source quality.
