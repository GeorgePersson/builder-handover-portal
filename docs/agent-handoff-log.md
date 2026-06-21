# Agent Handoff Log
## 2026-06-21 - Docling Planning Branch Push Completed

### What Changed

- Pushed Docling local-context planning work to GitHub.
- Branch: `codex/docling-local-context`.
- Commit pushed: `8565528`.
- Left local `.codex/` and `.hermes/` untracked and uncommitted.

### Files Changed

- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `git push -u origin HEAD` - passed.
- `git status --short --branch` - branch is aligned with origin except untracked local agent folders.

### Unknowns/Risks

- Docling is still a plan only; it has not been installed or run against the real scanned PDF yet.

### Suggested Next Task

Implement Phase D1 from `docs/docling-phased-work.md`: install/run Docling locally, create `scripts/docling-convert.py`, process the real scanned spec, and inspect ignored artifacts under `.local-artifacts/docling/` before wiring `DOCUMENT_CONTEXT_PROVIDER=docling_local`.

## 2026-06-21 - Docling Local Parser Spike Planned

### What Changed

- Created a new feature branch direction for Docling: `codex/docling-local-context`.
- Added a local-first Docling parser plan at `docs/docling-local-context-plan.md`.
- Added detailed Docling phased work at `docs/docling-phased-work.md`.
- Updated `docs/phased-work.md`, `docs/architecture.md`, and `WORKSHEET.md` so future agents know Docling is the next active parser spike while LlamaCloud remains available for later comparison.
- The plan intentionally starts with local Docling testing against the real scanned outline spec before adding VPS, Cloudflare Container, Azure, or LlamaCloud dependency.

### Files Changed

- `docs/docling-local-context-plan.md`
- `docs/docling-phased-work.md`
- `docs/phased-work.md`
- `docs/architecture.md`
- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- Planning/docs-only change. Lightweight validation should check conflict markers and git status before push.

### Unknowns/Risks

- Docling is not installed or tested yet in this entry.
- The real scanned PDF still needs a local Docling parse quality test.
- Future VPS hosting is plausible but intentionally deferred until local parse quality and resource usage are known.
- LlamaCloud should not be removed; it remains an optional future quality comparison provider.

### Suggested Next Task

Install/run Docling locally, create `scripts/docling-convert.py`, process `C:\Users\hunte\Downloads\2074 legal signed outline spec.pdf.pdf`, save ignored artifacts under `.local-artifacts/docling/`, then decide whether to wire `DOCUMENT_CONTEXT_PROVIDER=docling_local` into the app.

## 2026-06-21 - Phone Codex Cloud Consolidation Push Completed

### What Changed

- Pushed the consolidated phone/Codex cloud work to GitHub.
- Commit pushed: `e3bfe66` on branch `codex/llamacloud-greenfield`.
- Left local `.codex/` and `.hermes/` untracked and uncommitted.

### Files Changed

- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `git push origin HEAD` - passed.
- `git status --short --branch` - branch is aligned with origin except untracked local agent folders.

### Unknowns/Risks

- `LLAMA_CLOUD_API_KEY` still needs to be configured locally before realistic scanned-PDF extraction.
- Full browser workflow smoke remains the next active task.

### Suggested Next Task

Add the LlamaCloud API key to local `.env.local` only, run `npm.cmd run document-context:readiness`, then run the full Supabase-mode workflow smoke with the real scanned outline spec.

## 2026-06-21 - Phone Codex Cloud Consolidation Anchored

### What Changed

- Fetched and consolidated the four new Codex cloud/mobile branches into `codex/llamacloud-greenfield`:
  - `be5640b` docs: Cloudflare-first Next.js deployment plan.
  - `8f57b8a` LlamaCloud/document-context readiness check.
  - `43aad2a` extraction admin-noise guardrails.
  - `8f3f1db` quote/source-gap approval and publish-readiness hardening.
- Resolved worksheet/handoff-log conflicts by keeping all relevant cloud entries and updating the current next-work plan.
- Updated `docs/architecture.md` so the app host target is Cloudflare Workers/Pages with OpenNext, with Vercel only as fallback for a documented blocker.
- Anchored the next work around LlamaCloud configuration and a full Supabase-mode browser/user workflow test.

### Files Changed

- `HANDOFF.md`
- `WORKSHEET.md`
- `docs/agent-handoff-log.md`
- `docs/architecture.md`
- `docs/cloudflare-nextjs-deployment-plan.md`
- `docs/context-first-extraction-and-source-gap-strategy.md`
- `docs/llamacloud-greenfield-implementation.md`
- `package.json`
- `scripts/check-document-context-readiness.mjs`
- `src/app/api/specifications/document-context-readiness/route.ts`
- `src/lib/ai/extraction-guardrails.ts`
- `src/lib/ai/outline-spec-normalize.ts`
- `src/lib/ai/spec-extract.ts`
- `src/lib/extraction/outline-spec-schema.ts`
- `src/lib/server/actions.ts`
- `src/lib/server/document-context-readiness.ts`
- `src/lib/server/document-context.ts`
- `src/lib/server/document-extraction.ts`
- `src/lib/workflow-readiness.ts`

### Checks Run

- `npm.cmd run document-context:readiness` - passed; currently reports `local_pdf` fallback because `LLAMA_CLOUD_API_KEY` is not configured locally yet.
- `npm.cmd run supabase:smoke:readiness` - passed.
- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed locally.

### Current Plan

1. Add `LLAMA_CLOUD_API_KEY` locally and set `DOCUMENT_CONTEXT_PROVIDER=llamacloud` for the realistic extraction pass.
2. Run `npm.cmd run document-context:readiness` and confirm it reports LlamaCloud will be used without printing the key.
3. Run the real scanned outline spec through the app and confirm LlamaCloud-backed extraction quality plus admin-noise guardrails.
4. Run the full Supabase-mode browser workflow: login, workspace/project, upload, extraction/review, source-gap/builder-supplied/supporting evidence, publish readiness, publish, and client portal visibility.
5. Fix only blockers found in that workflow, then revisit Cloudflare/OpenNext app deploy implementation.

### Unknowns/Risks

- LlamaCloud API key is still not configured locally in this anchored state, so realistic scanned-PDF extraction is not proven yet.
- Browser-level workflow smoke has not run after the merge.
- OpenNext/Cloudflare app hosting is planned but not configured yet.

### Suggested Next Task

Configure LlamaCloud locally, confirm document-context readiness, and start the full Supabase-mode workflow smoke with the real scanned outline spec.

## 2026-06-21 - Quote Source-Gap Approval Guard

### What Changed

- Loaded quote-reference status and raw extraction metadata in the Supabase approve-as-correct guard so server-side source-gap checks use the same signals as the UI/local path.
- Kept publish readiness strict for rows that somehow became `approved` while still carrying unresolved quote references, missing fields, or builder-info prompts.
- Added explicit pending-resolution metadata to supporting evidence uploads so quote/evidence attachment is auditable without pretending the item is automatically resolved.
- Updated the worksheet and handoff notes with the current behavior.

### Files Changed

- `src/lib/server/actions.ts`
- `src/lib/workflow-readiness.ts`
- `HANDOFF.md`
- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm run lint` - passed in Codex cloud.
- `npm run supabase:smoke:readiness` - failed in Codex cloud because Supabase secrets were not configured there.
- `npm run build` - failed in Codex cloud because Next.js could not fetch Google-hosted Geist fonts from that environment.
- `npx tsc --noEmit` - passed in Codex cloud.

### Unknowns/Risks

- Supabase-mode smoke still needs an environment with Supabase URL, anon key, and service-role key.
- Full Next build should be rerun locally where Google Fonts can be fetched or after switching to local fonts.
- Browser smoke for edit/evidence/builder-supplied resolution paths remains a follow-up.

### Suggested Next Task

Run the Supabase-mode browser smoke with secrets available, then verify that quote-like source gaps cannot be approved as correct, supporting evidence creates an audit action, edited or builder-supplied rows can proceed, and publish remains blocked for unresolved approved-as-correct gaps.

## 2026-06-21 - LlamaCloud Readiness Check

### What Changed

- Added a secret-safe document-context readiness helper and API route that reports whether uploads will use LlamaCloud Parse or local PDF/OCR fallback without printing `LLAMA_CLOUD_API_KEY`.
- Added `npm.cmd run document-context:readiness` for local/cloud checklist verification of provider selection.
- Updated LlamaCloud implementation docs and the worksheet with canonical `LLAMA_CLOUD_API_KEY` setup and fallback behavior.

### Files Changed

- `src/lib/server/document-context-readiness.ts`
- `src/lib/server/document-context.ts`
- `src/app/api/specifications/document-context-readiness/route.ts`
- `scripts/check-document-context-readiness.mjs`
- `package.json`
- `docs/llamacloud-greenfield-implementation.md`
- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm run document-context:readiness` - passed and reported local fallback because no LlamaCloud key was present in Codex cloud.
- `DOCUMENT_CONTEXT_PROVIDER=llamacloud LLAMA_CLOUD_API_KEY=<redacted> npm run document-context:readiness` - passed and confirmed the command reports `llamacloud_parse` without printing the key.
- `npm run lint` - passed in Codex cloud.
- `npm run build` - failed in Codex cloud because Next.js could not fetch Google-hosted Geist fonts during the production build.

### Unknowns/Risks

- No real LlamaCloud parse was run because Codex cloud did not expose a `LLAMA_CLOUD_API_KEY` or the real scanned PDF.
- The readiness check proves provider selection only; a real OCR-quality smoke still needs a configured key and representative PDF.

### Suggested Next Task

Configure `LLAMA_CLOUD_API_KEY` in a local or cloud secret store, run `npm.cmd run document-context:readiness`, then process a representative scanned specification PDF and confirm extraction diagnostics show `provider: llamacloud_parse` before continuing source-search work.

## 2026-06-21 - Consolidation Push Completed

### What Changed

- Pushed the consolidated Supabase readiness smoke and source-gap/publish-readiness hardening work to GitHub.
- Commit pushed: `9d8ff14` on branch `codex/llamacloud-greenfield`.
- Left local `.codex/` untracked and uncommitted.

### Files Changed

- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `git push origin HEAD` - passed.
- `git status --short --branch` - branch is aligned with origin except existing untracked `.codex/`.

### Unknowns/Risks

- Browser-level Supabase smoke remains the next step.
- LlamaCloud/OCR remains needed for realistic scanned-PDF extraction.

### Suggested Next Task

Run the app locally in Supabase mode and complete the browser smoke from `docs/hunter-testing-checklist.md`, starting with `npm.cmd run supabase:smoke:readiness`, then magic-link login/workspace bootstrap/upload/review/publish-readiness checks.
## 2026-06-21 - Cloud Branch Consolidation: Supabase Smoke And Source-Gap Readiness

### What Changed

- Fetched Codex cloud branches and selectively consolidated the safest changes into `codex/llamacloud-greenfield`.
- Added `scripts/smoke-supabase-readiness.mjs` and `npm.cmd run supabase:smoke:readiness` for a secret-safe Supabase readiness check.
- Updated the hunter testing checklist to run the Supabase readiness smoke before browser testing.
- Ported source-gap publish/readiness hardening from the Codex cloud branch: unresolved quote references, missing fields, and builder-info prompts block normal “Approve as correct”.
- Added a builder-supplied review form that requires notes explaining the project-specific source/quote/site decision/builder knowledge.
- Adjusted the source-gap helper typing so both full UI workflow items and minimal server review items can be checked safely.

### Files Changed

- `package.json`
- `scripts/smoke-supabase-readiness.mjs`
- `docs/hunter-testing-checklist.md`
- `src/lib/workflow-readiness.ts`
- `src/lib/server/actions.ts`
- `src/components/builder/projects-workspace.tsx`
- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm.cmd run supabase:smoke:readiness` - passed.
- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed.

### Unknowns/Risks

- Browser-level Supabase smoke is still the next step; this pass verified build/readiness but did not click through magic-link login or upload flows.
- The real outline spec PDF remains scanned/image-heavy, so LlamaCloud/OCR is still needed for realistic extraction quality.
- Other cloud branches added overlapping smoke scripts and extraction/admin-noise guardrails; these were reviewed but not all merged blindly. Extraction guardrails should be considered in a follow-up after the app smoke test.

### Suggested Next Task

Run the Supabase-mode browser smoke: sign in, confirm builder workspace bootstrap, upload a demo asset or the real PDF when LlamaCloud is ready, verify extraction/review queue creation, test builder-supplied/source-gap paths, and confirm publish-readiness blocks unsafe handover publication.
## 2026-06-21 - Bedtime Codex Cloud Handoff Prompt

### What Changed

- Added a copy/paste prompt to `WORKSHEET.md` for running one final Codex cloud/mobile command from the phone.
- The prompt tells the cloud agent what to read first, what Supabase setup was completed locally, what secrets may be missing in cloud, and what the next best smoke-test task is.
- Clarified that local-only files like the scanned PDF may not be available to Codex cloud unless uploaded or present in the repo.

### Files Changed

- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- Documentation-only update; no app checks required.

### Unknowns/Risks

- Codex cloud will only have access to pushed repo files and any cloud-configured secrets, not this local machine after it is powered off.
- LlamaCloud is still not configured, so scanned-PDF extraction remains a future realistic-testing dependency.

### Suggested Next Task

From phone/Codex cloud, use the prompt in `WORKSHEET.md` to prepare or run the Supabase-mode smoke test, depending on cloud secret availability.
## 2026-06-21 - Supabase Migration Setup Push Completed

### What Changed

- Pushed Supabase migration/setup documentation and Supabase agent skills to GitHub on branch `codex/llamacloud-greenfield`.
- Commit pushed: `9332619`.
- Left `.env.local` and `.codex/` uncommitted.

### Files Changed

- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `git push origin HEAD` - passed.
- `git status --short --branch` - branch is aligned with origin except existing untracked `.codex/`.

### Unknowns/Risks

- This entry records the push; app/browser smoke tests still need to be run separately.

### Suggested Next Task

Run the app in Supabase mode and test magic-link login, builder workspace bootstrap, document upload, extraction/review queue creation, and publish-readiness behavior.
## 2026-06-21 - Supabase Migrations Applied And Agent Skills Installed

### What Changed

- Added the direct Supabase Postgres connection string to local `.env.local` only; no secrets were committed.
- Installed Supabase agent skills with `npx skills add supabase/agent-skills --yes`, adding `.agents/skills/supabase`, `.agents/skills/supabase-postgres-best-practices`, and `skills-lock.json` for compatible agents.
- Applied every repo migration file matching `docs/supabase-add-*.sql` to the Supabase database.
- Verified previously missing workflow/billing/event tables are now available through both direct Postgres checks and Supabase REST.

### Migration Files Applied

- `docs/supabase-add-document-workflow-phase1.sql`
- `docs/supabase-add-builder-workspace-bootstrap.sql`
- `docs/supabase-add-client-extracted-items-policy.sql`
- `docs/supabase-add-client-invite-acceptance.sql`
- `docs/supabase-add-document-download-events.sql`
- `docs/supabase-add-extracted-item-review-reason.sql`
- `docs/supabase-add-extraction-usage-metrics.sql`
- `docs/supabase-add-handover-approvals.sql`
- `docs/supabase-add-handover-open-events.sql`
- `docs/supabase-add-maintenance-completion-policies.sql`
- `docs/supabase-add-organisation-update-policy.sql`
- `docs/supabase-add-project-credits-stripe.sql`

### Files Changed

- `.env.local` locally only, ignored by git
- `.agents/skills/supabase/**`
- `.agents/skills/supabase-postgres-best-practices/**`
- `skills-lock.json`
- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- Direct Postgres connection check as `postgres` - passed.
- Applied all listed migration files - passed.
- Direct database table verification - passed for `uploaded_documents`, `document_extraction_jobs`, `project_credit_accounts`, `project_credit_events`, `handover_open_events`, `document_download_events`, `handover_approvals`, and related workflow types/RPCs.
- Supabase REST verification - passed for `uploaded_documents`, `document_extraction_jobs`, `project_credit_events`, `handover_open_events`, `document_download_events`, and `handover_approvals`.
- Supabase Storage bucket check for `handover-documents` - passed.

### Unknowns/Risks

- Magic-link login itself still needs a browser/app smoke test.
- The provided outline spec PDF is scanned/image-heavy, so realistic extraction still needs LlamaCloud or another OCR-capable path.
- `.codex/` remains untracked and was not committed.

### Suggested Next Task

Run the app in Supabase mode and perform an end-to-end smoke test: magic-link login, builder workspace bootstrap, project/spec upload using the provided PDF, extraction/review queue creation, and publish-readiness behavior.
## 2026-06-21 - Documentation Push Completed

### What Changed

- Pushed the cross-agent worksheet and setup-status documentation to GitHub on branch `codex/llamacloud-greenfield`.
- Commit pushed: `ead6510`.
- Left `.env.local` and `.codex/` uncommitted.

### Files Changed

- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `git push origin HEAD` - passed.
- `git status --short --branch` - branch is aligned with origin except existing untracked `.codex/`.

### Unknowns/Risks

- This entry records the push; it does not apply pending Supabase SQL migrations.

### Suggested Next Task

Apply missing Supabase add-migrations with DB migration access, then run a Supabase-mode upload/review smoke test using the provided scanned outline spec PDF and LlamaCloud/OCR-capable parsing when available.
## 2026-06-21 - Supabase Local Environment And Storage Check

### What Changed

- Added the Supabase service role key to local `.env.local` only; no secrets were committed.
- Verified service-role REST access to the configured Supabase project.
- Created/confirmed the private `handover-documents` storage bucket required by the app.
- Documented that an older `handover_documents` bucket also exists, but the app code uses `handover-documents`.
- Recorded current Supabase readiness in `WORKSHEET.md`.

### Files Changed

- `.env.local` locally only, ignored by git
- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- Queried representative REST tables with the service-role key.
- Listed Supabase storage buckets and created/confirmed `handover-documents`.
- Confirmed `organisations`, `organisation_members`, `projects`, and `extracted_handover_items` are reachable.

### Unknowns/Risks

- Several later migration tables were not found through PostgREST: `uploaded_documents`, `document_extraction_jobs`, `project_credit_events`, and `handover_open_events`. Full Supabase-mode testing needs the relevant `docs/supabase-add-*.sql` migrations applied.
- Applying SQL migrations still needs database-owner access, a Supabase access token/project link, or the database password; the service role JWT is enough for app/server API access but not enough for arbitrary SQL migration execution through the standard REST API.
- Magic-link configuration was reported by the user but not verified through the dashboard/API in this pass.
- The provided outline spec PDF is likely scanned/image-heavy: `pdf-parse` saw 34 pages but only about 957 text characters, so LlamaCloud or OCR-capable processing is important for realistic extraction testing.

### Suggested Next Task

Apply the pending `docs/supabase-add-*.sql` migrations through the Supabase SQL editor or provide database migration access, then run a real Supabase-mode upload/review smoke test with the provided outline spec PDF.

## 2026-06-21 - Cross-Agent Ground Truth And Push Handoff Rules

### What Changed

- Confirmed the active local project is `C:\Users\hunte\OneDrive\Desktop\TestWebApp`.
- Verified the repository remote points to `https://github.com/GeorgePersson/builder-handover-portal.git` and the active branch is `codex/llamacloud-greenfield`.
- Added explicit cross-agent ground-truth rules so Hermes, local Codex, Codex cloud/mobile, and future agents read the same required docs before changing the project.
- Added a push discipline: before `git push`, provide a detailed explanation of the work, checks, risks, and follow-ups; after pushing, update the worksheet and handoff log.
- Created `WORKSHEET.md` as the simple live tracker for done/next work.

### Files Changed

- `AGENTS.md`
- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- Verified `git ls-remote --heads origin` succeeded for the GitHub remote.
- Verified global git identity is configured as `George Persson <129338143+GeorgePersson@users.noreply.github.com>`.
- No app build/lint needed because this was documentation-only.

### Unknowns/Risks

- GitHub CLI (`gh`) is not installed in this environment, so GitHub API/PR tasks will use plain `git`/HTTPS unless `gh` is installed later.
- No push was performed for this documentation update yet.

### Suggested Next Task

Use this prompt from local or cloud Codex:

```txt
Continue the Builder Handover Portal from C:\Users\hunte\OneDrive\Desktop\TestWebApp. Read AGENTS.md, HANDOFF.md, WORKSHEET.md, docs/product-brief.md, docs/phased-work.md, and docs/architecture.md first. Follow the worksheet and update it plus docs/agent-handoff-log.md after meaningful work.
```

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

## 2026-06-20 - Publish Readiness Pipeline Gate

### What Changed

- Added a shared workflow readiness blocker for Cloudflare pipeline work that
  is explicitly marked live/required for publish.
- The blocker counts required pipeline jobs unless their stored pipeline status
  is `completed`; failed status sync also blocks.
- Current dry-run jobs remain non-blocking unless future metadata marks them as
  required for publish.
- Updated the handoff, implementation phase plan, and testing log.

### Files Changed

- `src/lib/workflow-readiness.ts`
- `docs/implementation-phases.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed.

### Unknowns/Risks

- The future live-pilot implementation must deliberately set
  `requiredForPublish`, `liveEnrichmentRequired`, `pipelineMode=live_pilot`, or
  equivalent live metadata when a source job should block publish.

## 2026-06-20 - Source Cache Metadata Dry Run

### What Changed

- Added deterministic planned source-cache references to Worker dry-run results
  and aggregate job status.
- Used the key pattern
  `dry-run/source-cache/<job>/<identity>/<source-hash>.json`.
- Parsed and persisted planned source-cache references during app-side
  Cloudflare status sync.
- Mirrored planned cache keys into D1 `source_cache_index` with
  `status='planned'` and linked `identity_lookup_cache.source_cache_key` when
  the D1 binding is present.
- Updated the builder project extraction job card to show `Source cache
  dry-run` metadata.
- Updated Worker module smokes, including a D1 mock assertion, plus the
  runbook, phase plan, handoff, and testing log.

### Files Changed

- `cloudflare/handover-pipeline/src/index.js`
- `scripts/smoke-cloudflare-live-guard.mjs`
- `scripts/smoke-cloudflare-retry.mjs`
- `src/lib/server/cloudflare-pipeline.ts`
- `src/lib/server/actions.ts`
- `src/components/builder/projects-workspace.tsx`
- `docs/cloudflare-pipeline-runbook.md`
- `docs/implementation-phases.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `node --check cloudflare\handover-pipeline\src\index.js` - passed.
- `npm.cmd run cloudflare:smoke:retry` - passed and confirmed the D1 mock
  received planned `source_cache_index` writes.
- `npm.cmd run cloudflare:smoke:live-guard` - passed.
- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed after tightening TypeScript narrowing in the
  app-side cache-reference parsers.

### Unknowns/Risks

- Planned cache keys are metadata only. The normal dry-run queue path still
  does not write R2 objects; `/cache/smoke` remains the only synthetic R2 write
  endpoint and should not be called publicly without confirmation.

## 2026-06-21 - Cloudflare Safety Metadata App Sync

### What Changed

- Added app-side parsing for the Worker `safety` snapshot from job creation and
  status responses.
- Preserved `pipelineMode`, `dryRunEnrichment`, `liveEnrichmentEnabled`, and
  the full safety/budget snapshot when Cloudflare status refresh merges into
  extraction job usage metrics.
- Updated builder project extraction job cards to label guarded live-pilot
  metadata separately from ordinary dry-run jobs.
- Updated the phase plan, handoff, and testing log so future live-pilot work
  knows the app-side publish gate can read stored Worker metadata.

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
- `npm.cmd run cloudflare:smoke:live-guard` - passed.
- `npm.cmd run cloudflare:smoke:retry` - passed.
- `npm.cmd run build` - passed.

### Unknowns/Risks

- This only persists safety metadata. It does not enable live source
  enrichment, public Cloudflare calls, R2 writes, OpenAI calls, or web search.

## 2026-06-21 - Cloudflare D1 Dry-Run Smoke

### What Changed

- Added `scripts/smoke-cloudflare-d1-dry-run.mjs`.
- Added `npm.cmd run cloudflare:smoke:d1-dry-run`.
- The smoke imports the Worker module and uses mocked Durable Object, Queue, and
  D1 bindings to verify the local dry-run D1 write contract.
- It covers job creation, source candidate inserts, job events, zero-cost meter
  events, planned source-cache index rows, identity cache links, and completed
  dry-run job status.
- Updated the phase plan, handoff, and testing log so Phase 11D has a local
  repeatable D1 smoke without remote Cloudflare.

### Files Changed

- `package.json`
- `scripts/smoke-cloudflare-d1-dry-run.mjs`
- `docs/implementation-phases.md`
- `HANDOFF.md`
- `TESTING_LOG.txt`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm.cmd run cloudflare:smoke:d1-dry-run` - passed.
- `npm.cmd run cloudflare:smoke:live-guard` - passed.
- `npm.cmd run cloudflare:smoke:retry` - passed.
- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed.

### Unknowns/Risks

- This is a module-level smoke with mocked bindings. A Wrangler-local simulated
  binding smoke is still useful before relying on local dev behavior, but no
  public Cloudflare, R2, OpenAI, source search, source PDF fetch, or live
  enrichment ran here.

## 2026-06-21 - Cloudflare-first Next.js App Deployment Plan

### What Changed

- Added a docs-only deployment plan for hosting the Next.js 16 product app on Cloudflare Workers with the OpenNext Cloudflare adapter.
- Documented current compatibility findings from repo inspection and current Cloudflare/OpenNext/Supabase docs.
- Identified likely package/config additions, required app and secret environment variables, Supabase key handling rules, routes/server actions needing workerd compatibility review, deployment commands, validation steps, risks, and blockers.
- Updated `WORKSHEET.md` with the completed planning item and next recommended implementation task.

### Files Changed

- `docs/cloudflare-nextjs-deployment-plan.md`
- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm.cmd run lint` - not available in Codex cloud's Linux shell; reran as `npm run lint`.
- `npm run lint` - passed in Codex cloud.

### Unknowns/Risks

- This was intentionally docs/config planning only; no OpenNext packages or root app Wrangler config were added yet.
- The largest expected blockers remain PDF/OCR compatibility under workerd, accidental local filesystem fallback in production, large upload limits, and Supabase auth/proxy behavior in Workers preview.
- A real `opennextjs-cloudflare build`/preview smoke is still required before declaring the Next.js app production-ready on Cloudflare.

### Suggested Next Task

Implement the smallest OpenNext/Wrangler product-app config PR, then run Cloudflare preview against Supabase + LlamaCloud configuration before any custom-domain cutover.

## 2026-06-21 - Extraction Admin-Noise Guardrails

### What Changed

- Added shared extraction guardrails that identify pure admin/legal/contract/preliminaries/site setup/scaffolding/temporary works/council/insurance/health-and-safety/generic workmanship noise while preserving homeowner-relevant warranties, manuals, certificates, producer statements, appliances, fixtures/fittings, flooring, cladding, roofing, paint/finish selections, and maintenance requirements.
- Applied the guardrails to deterministic spec preview extraction and outline-spec workflow normalization so pure admin noise is filtered before review/package rows are created.
- Tightened the OpenAI extraction prompt and outline-spec schema description to avoid promoting admin noise and to use the current `source_ready_unknown` classification name.
- Documented the guardrail policy in the context-first extraction/source-gap strategy.

### Files Changed

- `src/lib/ai/extraction-guardrails.ts`
- `src/lib/ai/spec-extract.ts`
- `src/lib/ai/outline-spec-normalize.ts`
- `src/lib/extraction/outline-spec-schema.ts`
- `src/lib/server/document-extraction.ts`
- `docs/context-first-extraction-and-source-gap-strategy.md`
- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `npm run lint` - passed in Codex cloud.
- `npm run build` - failed in Codex cloud because `next/font` could not fetch Geist and Geist Mono from Google Fonts in that environment.

### Unknowns/Risks

- Guardrails are intentionally conservative and may drop pure admin-only rows entirely; if the business wants rejected/noise audit rows, add a separate non-handover extraction log instead of putting them into homeowner package candidates.
- Build should be rerun locally where Google Fonts can be fetched or after switching to vendored/local fonts.

### Suggested Next Task

Run a real/scanned outline spec through LlamaCloud or OCR-backed extraction and confirm the review queue contains homeowner-relevant products/documents/maintenance only, with admin/preliminaries/site setup noise absent from package candidates.
