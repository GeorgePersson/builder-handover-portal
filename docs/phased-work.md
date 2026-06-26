# Phased Work

Use this as the simple routing map for future Codex/Hermes prompts. The fuller active roadmap remains in `docs/implementation-phases.md`; this file is the stable product-memory index and should list only current/future work, with completed work kept as short context so agents do not repeat it.

## Current Source Of Truth

- Product direction: `docs/product-brief.md`.
- Architecture entrypoint: `docs/architecture.md`.
- Current `/builder/projects` UI contract: `docs/builder-project-workspace-ui-contract.md`.
- Live work tracker: `WORKSHEET.md`.
- Chronological handoff: `docs/agent-handoff-log.md`.

## Current Active Slice - Project Workspace Hardening

Completed baseline, do not rebuild from scratch: `/builder/projects` is now a standalone project workspace for manual handover package prep. It supports project browser -> project workspace, dashboard `?projectId=...` deep links, top workspace header, right-sidebar client access/status, stateful module filters, manual/add-item flow with database suggestions first, documents/legal upload, and the visible section title `Handover Items & Products`.

Remaining work only:

1. Add Playwright or equivalent browser smoke coverage for the project-workspace contract:
   - `/builder` dashboard active project/client request/package rows deep-link to `/builder/projects?projectId=<projectId>`.
   - `/builder/projects?projectId=<projectId>` auto-opens the selected project workspace.
   - Module filters work: Overview shows all primary modules, Items shows only `Handover Items & Products`, Documents shows required/legal upload first, and Spec automation shows only the coming-soon module.
   - Add-item modal opens with database suggestions/search above long manual fields.
   - Document upload forms do not emit the React/Next server-action `encType`/`method` warning.
2. Add desktop visual regression snapshots for:
   - project browser,
   - workspace overview,
   - Items tab,
   - Documents tab,
   - add-item modal with database suggestions area visible.
3. Run a real browser demo smoke before investor/demo use:
   - open one project from the browser list,
   - open one project from a dashboard deep link,
   - add one manual item,
   - add one database-autofilled item,
   - upload a Code Compliance Certificate/consent placeholder,
   - switch every module filter,
   - confirm package/client output remains homeowner-safe.
4. Keep any future document upload forms that use React/Next server actions free of explicit `encType` or `method`.
5. Fix or suppress the known Docling/Turbopack NFT tracing warnings separately from UI hardening. Do not mix that warning cleanup into project-workspace layout changes.
6. After any code or docs change in this area, rerun `npm.cmd run lint` and `npm.cmd run build`. The build may still show the known Docling/Turbopack NFT warnings until that separate task is done.

## Phase 1 - Core Project And Handover Checklist

Goal: builders can create/open a project and manage handover items inside that project. Each item tracks identity, care instructions, manuals, warranty information, invoices, Code of Compliance information, uploaded supporting documents, notes, completion state, and audit trail.

Completed context, do not rework unless regressed:

- Project workspace shell and project browser exist.
- Dashboard deep links and `projectId` auto-open are implemented.
- Manual handover item creation and database autofill are visible in the add-item modal.
- The item list is titled `Handover Items & Products` and has clickable category/group filters.
- Right sidebar status/client access exists.
- Project details and Add client document sit side by side on wide screens.

Remaining work:

1. Freeze the current UI contract with browser tests and snapshots from the active slice above.
2. Make item-card editing/completion states durable enough for demo use: complete, needs review, missing manual, missing warranty, missing compliance document, not enough information, accepted incomplete.
3. Ensure incomplete acceptance writes an auditable reason, actor, timestamp, and missing-section summary for both Supabase and local scaffold mode.
4. Add a small deterministic demo fixture set so categories/counts/sidebar summaries never appear empty during smoke tests.
5. If tests reveal layout regressions, fix toward `docs/builder-project-workspace-ui-contract.md`, not older modal/split-pane notes.

Prompt routing: project setup, checklist dashboard, add-item modal, item detail/review modal, item completion states, manual entry/upload paths, incomplete acceptance, document records, local scaffold persistence.

## Phase 2 - Item Extraction And Categorisation

Goal: extract candidate handover items and supporting evidence from uploaded specs, quotes, invoices, manuals, warranties, supplier schedules, photos, and other documents, then feed those candidates into the project checklist for review.

Completed context, do not redo as one-off row patches:

- Local PDF/OCR helpers, Docling local provider work, OpenAI schema/normalizer/classifier/final-cleanup paths, and extraction-to-checklist sync exist.
- The user expects systemic fixture-backed fixes: bad or missed rows become regression fixtures and pipeline-stage improvements.
- Recent extraction work has proven that dropping from ~80-90 Docling candidates/items to ~30 is a regression to debug at parser/normalizer boundaries.

Remaining work:

1. Run a fresh end-to-end upload -> Docling OCR -> extraction -> review/checklist smoke, not just cached-artifact tests.
2. Confirm diagnostics show parser breadth, proposal counts, LLM sent/accepted counts, final cleanup counts, and saved checklist rows.
3. Add coverage-audit checks for skipped rows with real service/equipment/product signals.
4. Keep LlamaCloud/Azure only as quality benchmarks unless a clear cost/quality reason justifies switching away from local-first Docling.
5. Fix the known Docling/Turbopack NFT tracing build warnings separately from extraction quality work.
6. Continue adding regression fixtures before changing parser/normalizer/evidence/classification logic.

Prompt routing: extraction schemas, OCR/table parsing, Docling local/VPS provider work, category logic, missing fields, source snippets, confidence scoring, mapping extracted rows into checklist items.

## Phase 3 - Builder Review/Edit Workflow

Goal: builders review, edit, upload documents for, search for, mark complete, exclude, or accept incomplete each project handover item before publish.

Completed context:

- Review queues and item edit forms exist for extracted rows.
- Project workspace exposes manual and database-autofilled checklist items.
- Builder/admin review concepts, review reasons, source gaps, care labels, and package-ready statuses exist.

Remaining work:

1. Give manual checklist items the same review power as extracted rows: edit every identity/detail field, upload/link documents, set section statuses, and preserve original/source metadata where present.
2. Make completion-state transitions explicit and server-enforced, not only UI labels.
3. Add tests for accepted incomplete, excluded, complete, and not-enough-information flows.
4. Ensure publish readiness blocks unresolved source gaps and unsafe review states.
5. Keep client-facing output clean: no raw AI text, internal review prompts, uncertain source notes, or private documents.

Prompt routing: review queues, item edit forms/modals, completion state machine, audit trail, incomplete acceptance, publish readiness, safe status labels.

## Phase 4 - Supplier Vs Manufacturer Handling

Goal: keep manufacturer/brand/product identity separate from supplier, supplier SKU, quote/source document, and project availability.

Completed context:

- Schema/type scaffolding and builder edit fields exist for manufacturer, supplier, supplier SKU, quantity, finish, colour, and approved category.

Remaining work:

1. Build source-backed product/database ingestion tooling from supplied PDFs, supplier exports, invoices/manuals, or manufacturer pages.
2. Add review/dedupe tooling before reusable catalogue rows become approved database records.
3. Keep manual ChatGPT/Pro spreadsheet extraction as an acceptable low-cost path: source docs -> CSV rows with source/snippet/confidence -> manual review -> import/paste later.
4. Do not seed reusable product catalogue rows from unsourced model memory.
5. Preserve supplier-vs-manufacturer fields through extraction, matching, checklist editing, and client output.

Prompt routing: supplier records, supplier SKU, product matching, identity fingerprints, manufacturer/source authority.

## Phase 5 - Quote Upload And Item Detail Linking

Goal: when a spec says `as per quote`, builders can upload the quote and link it back to the missing item details.

Completed context:

- Quote/supplier document roles, parent extracted item links, and quote reference statuses are scaffolded.
- Quote-like rows should ask for a quote or builder context instead of going straight to source search.

Remaining work:

1. Add a compact quote/supporting-document upload path from the project workspace or item detail flow.
2. Link uploaded quote rows to the affected checklist item(s).
3. Re-run extraction/matching on quote documents and merge results into the existing item without losing builder edits.
4. Track whether a quote reference is unresolved, linked, extracted, or builder-accepted incomplete.
5. Add fixtures for `as per quote` rows so they do not become vague client-facing handover items.

Prompt routing: quote upload action, linked extraction jobs, resolving quote references, source-gap prompts.

## Phase 6 - Care, Manual, Warranty, Invoice, And Compliance Sections

Goal: provide or collect the required handover documentation sections for each item: care instructions, manuals, warranty information, invoice data, Code of Compliance information where relevant, uploaded supporting documents, and notes.

Completed context:

- Care text and care guidance source labels exist in workflow types and handover items.
- Project document upload exists and defaults client-visible for the current demo workflow.

Remaining work:

1. Make care/manual/warranty/invoice/compliance/supporting-document sections first-class item completion requirements.
2. Add per-section upload/link controls where needed, rather than only project-level documents.
3. Clearly distinguish manufacturer/supplier/builder/general AI care guidance.
4. Allow general warranty/care guidance only when clearly labelled as general guidance, not as a builder-specific warranty document.
5. Ensure uploaded legal/compliance documents are easy to find from the Documents tab and item detail context.

Prompt routing: care guidance labels, manufacturer/supplier/builder/general AI care text, manual/warranty/invoice/compliance fields, document upload links, warranty-safe wording, fallback guidance.

## Phase 7 - Client-Facing Handover View/Export

Goal: publish a clean homeowner-facing portal or export after builder approval.

Completed context:

- `/client/portal` reads published package data and groups items by approved category.
- Client document visibility and portal open/download events are scaffolded.

Remaining work:

1. Browser-smoke package preview and client portal after adding manual and database-autofilled checklist items.
2. Verify only reviewed/client-safe fields appear.
3. Add grouped homeowner presentation for documents, warranties, manuals, maintenance, and care guidance.
4. Add export/print/PDF flow after portal content is stable.
5. Keep client access controls in the project workspace sidebar unless the UI contract changes.

Prompt routing: homeowner grouping, document display, export, client access, privacy-safe copy.

## Phase 8 - Multi-Unit Replication And Variations

Goal: replicate a base project for multiple units, then adjust per-unit variations without losing the base handover structure.

Completed context:

- Schema contains project replication batches and project units.

Remaining work:

1. Defer until single-project checklist, document, review, and publish flows are stable.
2. Design base-project cloning and per-unit variation diffs.
3. Ensure unit-specific edits do not overwrite base records blindly.
4. Add per-unit package readiness and client-facing grouping.

Prompt routing: base project cloning, unit records, variation diffs, per-unit package readiness.

## Phase 9 - Confidence Scoring, Audit Trail, And AI Review Improvements

Goal: make AI uncertainty visible and auditable across extraction, matching, source enrichment, builder edits, and final approval.

Completed context:

- Confidence scores, review reasons, value history, review actions, handover approvals, audit logs, source quality, and usage metrics are partly implemented.

Remaining work:

1. Standardise confidence/source-quality labels across extraction, matching, source search, and manual/database-autofilled item flows.
2. Make audit events consistent for item edits, document uploads, accepted incomplete, publish, client opens, and downloads.
3. Add regression tests for review-state transitions and publish blockers.
4. Keep AI uncertainty builder/admin-facing only; never expose it raw to clients.

Prompt routing: confidence labels, review reasons, source quality, audit logs, admin review, source enrichment gates.

## Phase 10+ - Durable Source Pipeline And Production Hardening

Goal: move long-running source work into durable background processing while keeping Supabase as product truth and keeping Cloudflare as the preferred app/pipeline host.

Completed context:

- Cloudflare Worker/Queue/Durable Object/R2/D1 pipeline scaffolding exists mostly as dry-run/smoke-tested infrastructure.
- Cloudflare-first deployment is preferred; Vercel is fallback only if Cloudflare/OpenNext has a documented blocker.

Remaining work:

1. Fix or suppress the known Docling/Turbopack NFT tracing warnings.
2. Implement the smallest OpenNext/Wrangler product-app config and preview smoke against Supabase configuration.
3. Keep live source enrichment disabled until explicit budget/safety gates are set.
4. Add durable source pipeline states only when the product flow needs background source work.
5. Add production deployment, secrets, storage, billing, email, and monitoring hardening after core demo/project workflow is stable.

Prompt routing: Cloudflare Worker/Queue/Durable Object/R2/D1 pipeline work, OpenNext/Cloudflare deployment, source-search budget guards, progress sync, production deploy.

## Verification Rule For This File

After editing `docs/phased-work.md`, `WORKSHEET.md`, `docs/agent-handoff-log.md`, or the UI contract, run:

```bash
npm.cmd run lint
npm.cmd run build
```

If build passes with the known Docling/Turbopack NFT tracing warnings, report the warnings as non-blocking and keep the warning cleanup as a separate Phase 10+ task.
