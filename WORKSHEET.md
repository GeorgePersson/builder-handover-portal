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

## Needs Doing / Next Work

- Continue from `HANDOFF.md` and `docs/phased-work.md`; do not change product direction without documenting the decision.
- Keep hardening Phase 3 builder review/edit workflow unless the user gives a more specific priority. Next useful check: browser-smoke the project workspace review cards and confirm missing-field prompts, required builder-supplied notes, evidence upload, exclude, and publish readiness behave together.
- Verify current app checks before pushing meaningful app changes: usually `npm.cmd run lint` and `npm.cmd run build`.
- Keep publish readiness strict: unresolved source gaps, quote references, or builder-context prompts should not silently become client-facing.
- Continue documenting any Cloudflare/LlamaCloud/Supabase production setup steps as they are actually verified.

## Last Updated

- 2026-06-20: Hardened the Phase 3 builder-supplied review action so project-specific source-gap approvals require an explanatory note in the builder workspace.
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
