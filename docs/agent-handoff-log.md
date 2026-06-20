# Agent Handoff Log

## 2026-06-20 - Project Memory Documentation Setup

### What Changed

- Expanded `AGENTS.md` from only the Next.js warning into practical operating rules for future agents.
- Added stable project-memory entrypoint docs under `docs/`.
- Linked the new docs to the existing deeper architecture, phase, workflow, and handoff documents instead of replacing them.

### Files Changed

- `AGENTS.md`
- `docs/product-brief.md`
- `docs/phased-work.md`
- `docs/architecture.md`
- `docs/database-schema.md`
- `docs/domain-glossary.md`
- `docs/ux-rules.md`
- `docs/decisions.md`
- `docs/known-issues.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed.
- `npm.cmd run build` - passed.

### Unknowns/Risks

- Existing worktree had unrelated modified app/schema files before these docs were edited; this handoff entry does not claim ownership of those changes.
- README may still lag behind the current handoff/workflow docs.
- Cloudflare pipeline and Azure/LlamaCloud document context behaviour should be verified against current env/config before future implementation work.

### Suggested Next Task

Continue from `HANDOFF.md` and `docs/phased-work.md`. A good next prompt is:

```txt
Continue the Builder Handover Portal from C:\Users\hunte\OneDrive\Desktop\TestWebApp. Read HANDOFF.md, AGENTS.md, docs/product-brief.md, docs/phased-work.md, and docs/architecture.md first. Then pick up the next best work without changing the product direction.
```

## 2026-06-20 - Phase 3 Readiness And Docs Alignment

### What Changed

- Confirmed the next active implementation lane as Phase 3 builder review/edit hardening.
- Tightened workflow publish readiness so unresolved quote references, missing source details, or builder-context prompts block publish until resolved or explicitly reviewed.
- Replaced visible implementation-note copy in the builder review edit card with builder-facing review guidance.
- Clarified the docs front door: stable entrypoints remain `product-brief`, `phased-work`, and `architecture`; `greenfield-build-plan` is required for clean-start/rebuild planning; LlamaCloud is the preferred current path when configured, not a hard-coded provider.

### Files Changed

- `AGENTS.md`
- `HANDOFF.md`
- `docs/known-issues.md`
- `docs/agent-handoff-log.md`
- `src/components/builder/projects-workspace.tsx`
- `src/lib/workflow-readiness.ts`

### Checks Run

- `npm.cmd run lint` - passed.

### Unknowns/Risks

- Browser upload smoke for `/builder/projects` is still a manual follow-up because file attachment automation has been unreliable in this environment.
- Existing worktree changes from earlier slices are still present and should be treated as part of the broader branch state, not reverted.

## 2026-06-20 - Cloudflare Local R2 Smoke

### What Changed

- Added a dry-run Worker `/cache/smoke` endpoint that writes and reads one tiny synthetic JSON metadata record through the `SOURCE_PDF_BUCKET` binding.
- Documented the local-only R2 smoke command and warned that calling the deployed endpoint would write a small object to the real R2 bucket.
- Verified the local Worker queue and R2 paths with Wrangler local bindings only.

### Files Changed

- `cloudflare/handover-pipeline/src/index.js`
- `docs/cloudflare-pipeline-runbook.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `GET http://127.0.0.1:8787/health` - passed.
- `POST http://127.0.0.1:8787/jobs` plus follow-up `GET /jobs/local-test-codex-002` - passed, completed one dry-run batch.
- `POST http://127.0.0.1:8787/cache/smoke` - passed against local simulated R2.
- `node --check cloudflare\handover-pipeline\src\index.js` - passed.
- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed.

### Unknowns/Risks

- No deployed Cloudflare resources were created or written during this pass.
- The real `/builder/projects` desktop modal/upload smoke still needs manual confirmation; the route rendered in scaffold mode, but the in-app browser did not activate modal buttons.

## 2026-06-20 - Cloudflare D1 Pipeline SQL Scaffold

### What Changed

- Added the D1 schema for pipeline-only SQL metadata: jobs, events, context segments, identity lookup cache, source candidates/results, source cache indexes, idempotency keys, and cost events.
- Added optional Worker prepared-statement writes that mirror dry-run job creation, candidate queueing, batch completion, and zero-cost dry-run meter events when `PIPELINE_DB` is configured.
- Documented the D1 setup/apply flow and kept Supabase as the product/auth/review/homeowner source of truth.

### Files Changed

- `cloudflare/handover-pipeline/schema.sql`
- `cloudflare/handover-pipeline/src/index.js`
- `cloudflare/handover-pipeline/wrangler.jsonc`
- `docs/cloudflare-pipeline-runbook.md`
- `docs/implementation-phases.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `node --check cloudflare\handover-pipeline\src\index.js` - passed.

### Unknowns/Risks

- No real D1 database was created or bound in this pass.
- The next D1 verification needs `wrangler d1 create`, a real `database_id`, schema application, and a local dry-run `/jobs` smoke with `PIPELINE_DB` configured.

## 2026-06-20 - Cloudflare Progress Sync Scaffold

### What Changed

- Added a Cloudflare Worker job-status fetch helper for `GET /jobs/<jobId>`.
- Added a server action that merges Worker dry-run progress back into extraction job usage metrics in Supabase mode or local scaffold mode.
- Added a builder project card refresh action and clearer Cloudflare queued, processing, and completed status copy.

### Files Changed

- `src/lib/server/cloudflare-pipeline.ts`
- `src/lib/server/actions.ts`
- `src/components/builder/projects-workspace.tsx`
- `docs/implementation-phases.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed.

### Unknowns/Risks

- End-to-end refresh was not clicked through a real browser with a running local Worker in this pass.
- Publish-readiness blocking on incomplete pipeline work is still intentionally deferred until live enrichment mode exists.

## 2026-06-20 - Cloudflare D1 Remote Setup

### What Changed

- Logged into Cloudflare through Wrangler OAuth.
- Created the remote D1 database `builder-handover-pipeline` in region `OC`.
- Bound the database as `PIPELINE_DB` in `cloudflare/handover-pipeline/wrangler.jsonc`.
- Applied `cloudflare/handover-pipeline/schema.sql` to the remote database.
- Verified the remote table list through `wrangler d1 execute --remote`.

### Files Changed

- `cloudflare/handover-pipeline/wrangler.jsonc`
- `docs/implementation-phases.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `npx.cmd wrangler d1 create builder-handover-pipeline` - passed.
- `npx.cmd wrangler d1 execute builder-handover-pipeline --remote --config cloudflare/handover-pipeline/wrangler.jsonc --file cloudflare/handover-pipeline/schema.sql` - passed, 19 queries, 36 rows written, 0.13 MB database.
- `npx.cmd wrangler d1 execute builder-handover-pipeline --remote --config cloudflare/handover-pipeline/wrangler.jsonc --command "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;"` - passed.

### Unknowns/Risks

- No Worker deployment or live pipeline job used the remote D1 database yet.
- Next verification should run a tiny dry-run Worker job with D1 active and confirm pipeline rows are mirrored.

## 2026-06-20 - Cloudflare Public Worker Dry Run

### What Changed

- Created Cloudflare Queue `builder-handover-source-enrichment`.
- Created R2 bucket `builder-handover-source-cache`.
- Set `PIPELINE_SHARED_SECRET` on the Worker with a generated random value.
- Deployed the dry-run Worker to `https://builder-handover-pipeline.gpersson2002.workers.dev`.
- Updated local `.env.local` to point at the public dry-run Worker URL with the matching shared secret.

### Checks Run

- `GET /health` on the public Worker - passed with `d1Configured=true`.
- Authenticated `POST /jobs` on the public Worker - passed for `public-dry-run-d1-smoke-001`, 2 candidates, 1 batch, `d1State.skipped=false`.
- Follow-up `GET /jobs/public-dry-run-d1-smoke-001` - passed with `completed`, 1 completed batch, 0 failed batches, 2 dry-run results.
- Remote D1 count query - passed with 1 job, 2 candidates, 3 events, and 1 cost meter event for the smoke job.

### Unknowns/Risks

- The app upload flow has not yet dispatched to the public Worker from `/builder/projects`.
- R2 bucket exists for binding, but no object write was performed in this pass.
- Live source enrichment remains disabled.

## 2026-06-20 - Cloudflare Failed-Batch Retry Primitive

### What Changed

- Added Worker route `POST /jobs/<jobId>/retry-failed`.
- Failed dry-run queue batches now store candidate payloads in Durable Object job status.
- Retry requeues only failed batches with incremented retry attempts.
- D1 mirror writes now record failed batches and retry-queued events.

### Files Changed

- `cloudflare/handover-pipeline/src/index.js`
- `docs/cloudflare-pipeline-runbook.md`
- `docs/implementation-phases.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `node --check cloudflare\handover-pipeline\src\index.js` - passed.
- Direct Worker module mock for `POST /jobs/<jobId>/retry-failed` - passed.
- `npx.cmd wrangler deploy --config cloudflare/handover-pipeline/wrangler.jsonc` - passed, version `f390a04e-9895-47aa-91e5-2da9873b9299`.
- Public `POST /jobs/public-dry-run-d1-smoke-001/retry-failed` - passed with `no_failed_batches`.

### Unknowns/Risks

- No app-side retry button exists yet.

## 2026-06-20 - Cloudflare App-Side Failed-Batch Retry

### What Changed

- Added a server helper for `POST /jobs/<jobId>/retry-failed` against the
  configured Cloudflare Worker.
- Added a builder server action that persists retry status, requeued batch
  count, retry timestamp, and cleared retry errors into extraction job usage
  metrics.
- Added a `Retry failed batches` action to builder project extraction job cards
  when stored Cloudflare dry-run metrics indicate a failed job or failed batch
  count.
- Updated the runbook and phase docs so the remaining work is a failing-scenario
  UI smoke instead of adding the button.

### Files Changed

- `src/lib/server/cloudflare-pipeline.ts`
- `src/lib/server/actions.ts`
- `src/components/builder/projects-workspace.tsx`
- `docs/cloudflare-pipeline-runbook.md`
- `docs/implementation-phases.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed.

### Unknowns/Risks

- A synthetic failing dry-run job still needs to be smoked through the real
  `/builder/projects` UI to prove the retry action end to end.

## 2026-06-20 - Cloudflare Local Retry Smoke Harness

### What Changed

- Added `scripts/smoke-cloudflare-retry.mjs`.
- Added `npm.cmd run cloudflare:smoke:retry`.
- The script imports the Worker module, mocks Durable Object storage and the
  Queue, runs `PIPELINE_MODE=dry_run_failure_test`, confirms the first batch
  fails once, retries exactly that failed batch, and confirms the retry
  completes with dry-run results.
- Updated the runbook, handoff, implementation phases, and testing log with the
  new repeatable local smoke.

### Files Changed

- `scripts/smoke-cloudflare-retry.mjs`
- `package.json`
- `docs/cloudflare-pipeline-runbook.md`
- `docs/implementation-phases.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm.cmd run cloudflare:smoke:retry` - passed.

### Unknowns/Risks

- The real `/builder/projects` UI still needs to click through the failing
  dry-run retry flow with a running Worker/dev app.

## 2026-06-20 - Cloudflare Live-Pilot Admission Guard

### What Changed

- Added Worker safety metadata for pipeline mode, live-pilot enablement,
  candidate cap, search/cost budget state, and live-enrichment implementation
  state.
- Added a default-closed live-pilot admission gate:
  `PIPELINE_MODE=live_pilot` requires `LIVE_PILOT_ENABLED=true`.
- Added `LIVE_PILOT_MAX_CANDIDATES`, defaulting to 1, before any live source
  implementation exists.
- Added required `LIVE_PILOT_MAX_SEARCHES` and
  `LIVE_PILOT_MAX_ESTIMATED_COST_USD` admission checks.
- Persisted the admitted safety/budget snapshot into Durable Object job status
  and copied it onto queue messages.
- Added queue-time rejection for `PIPELINE_MODE=live_pilot` messages that do
  not carry the admitted safety/budget snapshot.
- Added zero-cost dry-run `budgetUsage` recording on completed batches and
  aggregate job status.
- Added `scripts/smoke-cloudflare-live-guard.mjs` and
  `npm.cmd run cloudflare:smoke:live-guard`.
- Updated the handoff, implementation phases, runbook, and testing log.

### Files Changed

- `cloudflare/handover-pipeline/src/index.js`
- `scripts/smoke-cloudflare-live-guard.mjs`
- `package.json`
- `docs/cloudflare-pipeline-runbook.md`
- `docs/implementation-phases.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm.cmd run cloudflare:smoke:live-guard` - passed, including missing-budget
  rejection, tampered queue-message rejection, and safety/budget propagation to
  job status plus queue messages, plus zero-cost budget usage on completion.
- `npm.cmd run cloudflare:smoke:retry` - passed with zero-cost budget usage.

### Unknowns/Risks

- Live source enrichment is still not implemented and remains intentionally
  disabled. The next live-pilot step needs a concrete per-job cost/search budget
  before any OpenAI or web-search call is wired behind the gate.

## 2026-06-20 - Cloudflare Budget Usage In App Status

### What Changed

- Added app-side parsing for Worker `budgetUsage` returned by
  `/jobs/<jobId>`.
- Merged synced `budgetUsage` into extraction job usage metrics for Supabase
  and local scaffold persistence.
- Updated the builder project extraction job card to show pipeline usage as
  searches used plus estimated cost.
- Updated the handoff, implementation phase plan, runbook, and testing log.

### Files Changed

- `src/lib/server/cloudflare-pipeline.ts`
- `src/lib/server/actions.ts`
- `src/components/builder/projects-workspace.tsx`
- `docs/cloudflare-pipeline-runbook.md`
- `docs/implementation-phases.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `node --check src\lib\server\cloudflare-pipeline.ts` - passed.
- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed.
- `npm.cmd run cloudflare:smoke:live-guard` - passed.
- `npm.cmd run cloudflare:smoke:retry` - passed.

### Unknowns/Risks

- Still needs a real `/builder/projects` UI smoke with a running Worker to
  click refresh and confirm the displayed 0-search/$0.00 usage survives reload.
