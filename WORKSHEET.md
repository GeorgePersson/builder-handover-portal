# Project Worksheet

This is the live worksheet for agents working on this repository from local Hermes, Codex CLI, Codex cloud/mobile, or any other coding agent. Keep it short, current, and honest.

## Mandatory Agent Startup

Before changing code or docs, read these files in this order:

1. `AGENTS.md`
2. `HANDOFF.md`
3. `WORKSHEET.md`
4. `docs/product-brief.md`
5. `docs/phased-work.md`
6. `docs/architecture.md`
7. Any phase-specific docs relevant to the task

## Git Push / Handoff Rule

Before any `git push`, prepare a detailed explanation covering:

- What was changed
- Why it was changed
- Files touched
- Checks/tests run and their results
- Remaining risks, unknowns, or follow-up work

After the push, update this worksheet and `docs/agent-handoff-log.md` with what is done and what should happen next.

## Current Ground Truth

- Local project path: `C:\Users\hunte\OneDrive\Desktop\TestWebApp`
- GitHub remote: `https://github.com/GeorgePersson/builder-handover-portal.git`
- Active branch at setup time: `codex/llamacloud-greenfield`
- Product direction: builder uploads specification/supporting documents, extraction proposes package items, known matches are handled first, builder/admin review resolves uncertainty, and only reviewed/package-ready items become homeowner-facing.
- Stable planning docs: `HANDOFF.md`, `docs/product-brief.md`, `docs/phased-work.md`, and `docs/architecture.md`.

## Done

- Next.js/TypeScript/Tailwind app scaffold exists.
- Builder, admin, and client portal routes exist.
- Specification upload, extraction preview/review, package preview, and publish scaffolds exist.
- Supabase-ready schema and local scaffold persistence exist.
- LlamaCloud/document-context adapter work exists on the active branch.
- Cloudflare pipeline/D1/R2 dry-run scaffolding and runbooks exist.
- Agent startup and handoff rules are now documented in `AGENTS.md` and this worksheet.
- Supabase readiness smoke script is available as `npm.cmd run supabase:smoke:readiness` and passed locally against the configured Supabase project.
- Source-gap approval hardening is ported from Codex cloud work: source-gap items cannot be approved as correct until missing fields/quote references/builder-info prompts are resolved, and builder-supplied approval requires a project-specific note.
- Extraction admin-noise guardrails now filter pure contract/payment/preliminaries/site setup/scaffolding/temporary works/council/insurance/health-and-safety/generic workmanship text before it becomes homeowner handover candidates while preserving warranties/manuals/certificates/products/finishes/maintenance.

- Extraction admin-noise guardrails and quote/source-gap hardening from Codex cloud/mobile have been consolidated locally and pass smoke/lint/build checks.

- LlamaCloud/document-context readiness check exists as `npm.cmd run document-context:readiness`; current local check reports fallback to `local_pdf` until `LLAMA_CLOUD_API_KEY` is configured.

- Cloudflare-first deployment plan exists at `docs/cloudflare-nextjs-deployment-plan.md`; app host target is Cloudflare Workers/Pages via OpenNext, with Vercel fallback only for a proven blocker.

## Needs Doing / Next Work

- Configure `LLAMA_CLOUD_API_KEY` locally, set `DOCUMENT_CONTEXT_PROVIDER=llamacloud` for the realistic PDF pass, and run `npm.cmd run document-context:readiness` until it reports `willUseLlamaCloud: true`.
- Run the real scanned outline spec extraction smoke using `C:\Users\hunte\Downloads\2074 legal signed outline spec.pdf.pdf`; confirm extraction diagnostics use LlamaCloud and that admin/legal/preliminaries/site setup noise stays out of homeowner package candidates.
- Run the Supabase-mode browser workflow: login, builder workspace/project, upload, extraction/review queue, source-gap handling, builder-supplied note, supporting evidence/quote path, publish readiness, publish, and client portal visibility.
- Keep publish readiness strict: unresolved source gaps, quote references, or builder-context prompts should not silently become client-facing. Approved-as-correct rows with lingering source-gap signals are counted as publish blockers unless edited, excluded, or marked builder-supplied with a note.
- After the workflow smoke, fix only blockers discovered in the run, then consider the Cloudflare/OpenNext app deploy config from `docs/cloudflare-nextjs-deployment-plan.md`.
- Verify current app checks before pushing meaningful app changes: `npm.cmd run document-context:readiness`, `npm.cmd run supabase:smoke:readiness`, `npm.cmd run lint`, and `npm.cmd run build`.

## Last Updated

- 2026-06-21: Anchored after phone/Codex cloud consolidation: merged Cloudflare deployment plan, LlamaCloud readiness, extraction guardrails, and quote/source-gap hardening; local readiness, Supabase smoke, lint, and build passed.
- 2026-06-21: Hardened quote/source-gap approval and readiness checks so Supabase approvals load source-gap fields, approved-as-correct gaps remain publish blockers, and supporting-evidence uploads include audit metadata.
- 2026-06-21: Hardened extraction guardrails for admin/legal/contract/preliminaries/site setup noise; lint passed in Codex cloud and local verification is pending.
- 2026-06-21: Added secret-safe LlamaCloud/document-context readiness reporting and documented the LLAMA_CLOUD_API_KEY configuration path.
- 2026-06-21: Pushed consolidated Supabase smoke/source-gap readiness work to `codex/llamacloud-greenfield` at commit `9d8ff14`.
- 2026-06-21: Consolidated selected Codex cloud branches: Supabase readiness smoke plus source-gap/publish-readiness hardening; lint/build passed.
- 2026-06-21: Added bedtime Codex cloud/mobile handoff prompt and clarified that local Hermes cannot continue after the computer is off.
- 2026-06-21: Pushed Supabase migration verification and agent skills setup to `codex/llamacloud-greenfield` at commit `9332619`.
- 2026-06-21: Applied all repo Supabase add-migrations, verified missing REST tables now exist, and installed Supabase agent skills.
- 2026-06-21: Pushed cross-agent worksheet/setup documentation to `codex/llamacloud-greenfield` at commit `ead6510`.
- 2026-06-21: Added cross-agent ground-truth workflow and push/handoff discipline.
- 2026-06-21: Verified Supabase service-role access, created/confirmed `handover-documents`, and documented remaining migration gaps.

## Setup Status

### Supabase

- `.env.local` has Supabase URL, anon key, service role key, and direct Postgres `SUPABASE_DB_URL` configured locally. Do not commit `.env.local`.
- Service-role REST access and direct Postgres migration access were verified against the Supabase project.
- Private storage bucket `handover-documents` was created/confirmed for app uploads. An older underscore bucket `handover_documents` also exists but the app expects the hyphenated bucket.
- All repo Supabase add-migrations in `docs/supabase-add-*.sql` were applied successfully on 2026-06-21.
- REST verification now passes for `uploaded_documents`, `document_extraction_jobs`, `project_credit_events`, `handover_open_events`, `document_download_events`, and `handover_approvals`.
- Database verification confirms the newer workflow tables, project credit tables, handover event/approval tables, expected enums, and `ensure_builder_workspace` / `accept_project_client_invite` RPCs exist.

### LlamaCloud

- Not configured yet. This does not block local development because `DOCUMENT_CONTEXT_PROVIDER=local_pdf` can continue using the local PDF fallback.
- It does block validation of the preferred LlamaCloud Parse path for real PDFs, scanned/table-heavy specs, latency, and failure handling.

### Test Spec

- User provided a real outline spec PDF at `C:\Users\hunte\Downloads\2074 legal signed outline spec.pdf.pdf` for extraction/upload testing. Initial `pdf-parse` check found 34 pages but only ~957 text characters, so it is likely scanned/image-heavy; local plain-text parsing alone is not enough for realistic extraction. LlamaCloud or OCR-capable processing will be important for this file.

### Agent Skills

- Installed Supabase agent skills via `npx skills add supabase/agent-skills --yes`. The repo now has `.agents/skills/supabase`, `.agents/skills/supabase-postgres-best-practices`, and `skills-lock.json` so compatible coding agents can load Supabase-specific guidance.

## Bedtime / Phone Codex Cloud Prompt

Use this from Codex cloud/mobile when handing off from local Hermes:

```txt
Continue the Builder Handover Portal on branch codex/llamacloud-greenfield. First read AGENTS.md, HANDOFF.md, WORKSHEET.md, docs/product-brief.md, docs/phased-work.md, docs/architecture.md, and docs/agent-handoff-log.md.

Current state: Supabase URL/anon/service-role/direct Postgres access were configured locally by Hermes, the private handover-documents bucket exists, all docs/supabase-add-*.sql migrations were applied successfully, and Supabase REST verification passed for uploaded_documents, document_extraction_jobs, project_credit_events, handover_open_events, document_download_events, and handover_approvals. Supabase agent skills are committed under .agents/skills.

Do not assume secrets are available in Codex cloud unless configured there. If cloud secrets are missing, do code/docs work only and document exactly which secret is needed. Do not print secrets.

Next best task: run or prepare the Supabase-mode app smoke test for magic-link login, builder workspace bootstrap, project/spec upload, extraction/review queue creation, and publish-readiness behavior. The real test PDF is scanned/image-heavy, so plain local pdf-parse sees very little text; LlamaCloud/OCR is still needed for realistic extraction. If you cannot access the local PDF from cloud, add a clear test checklist or use repo demo assets instead.

Before any git push, write a detailed explanation of what changed, why, files touched, checks run, and remaining risks. After pushing, update WORKSHEET.md and docs/agent-handoff-log.md.
```

## 2026-06-21 - Cloudflare-first Next.js app deployment plan

- Completed a docs-only Cloudflare-first deployment plan for hosting the Next.js 16 product app on Cloudflare Workers with the OpenNext Cloudflare adapter.
- Added compatibility findings, package/config changes, environment variable handling, Supabase key guidance, routes needing workerd review, deployment commands, validation steps, and risks in `docs/cloudflare-nextjs-deployment-plan.md`.
- Next recommended task: implement the smallest OpenNext/Wrangler product-app config PR, then run `npm run preview` against Supabase + LlamaCloud configuration before any custom-domain cutover.
