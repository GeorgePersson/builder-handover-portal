# Agent Handoff Log
## 2026-06-22 - OpenAI Second-Pass Spec Classifier

### Goal

Keep Docling/code as the cheap deterministic parser/cleanup layer, then use OpenAI only for compact source-backed candidates that need semantic classification. This keeps the pay-as-you-go model while avoiding sending whole PDFs to the LLM.

### Changes

- Added `src/lib/ai/spec-candidates.ts`.
  - Converts deterministic proposals into `SpecExtractionCandidate` records.
  - Tracks source text, deterministic title/category/action/confidence, and whether the row is worth LLM spend.
  - Skips obvious existing matches, existing tasks, source-document rows, and note/noise rows.
- Added `src/lib/ai/spec-llm.ts`.
  - Uses OpenAI Responses API with strict JSON schema.
  - Requires source-grounded `source_quote` values.
  - Validates candidate IDs, item types, review lanes, source quote grounding, title support, and confidence range.
  - Normalizes LLM confidence returned as `0-1` into `0-100`.
  - Applies accepted classifications back to proposals while preserving deterministic fallback for rejected/low-confidence results.
- Wired optional enhancement into:
  - `src/app/api/specifications/extract-pdf/route.ts`
  - `src/app/api/specifications/process-pdf/route.ts`
- Added script/package command:
  - `scripts/smoke-spec-extract-llm.mjs`
  - `npm.cmd run spec-extract:llm-smoke`

### Runtime Controls

- Deterministic extraction remains the default.
- Set `OPENAI_SPEC_CLASSIFIER_ENABLED=true` to enable the second-pass classifier in app/API extraction routes.
- Set `OPENAI_SPEC_CLASSIFIER_LIMIT=30` or lower/higher to cap candidates sent per extraction.
- Uses `OPENAI_SPEC_CLASSIFIER_MODEL`, falling back to `OPENAI_EXTRACTION_MODEL`, then `gpt-5.1-mini`.

### Verification

- `npm.cmd run spec-extract:fixtures` passed: 7 fixtures.
- `npm.cmd run spec-extract:smoke` passed: 90 deterministic proposals.
- `OPENAI_SPEC_CLASSIFIER_LIMIT=6 npm.cmd run spec-extract:llm-smoke` passed.
  - Deterministic proposals: 90
  - LLM-eligible candidates: 73
  - Sent candidates: 6
  - Accepted: 6
  - Rejected: 0
  - Enhanced proposal count: 90
  - Model used in local env: `gpt-5.4-mini`
  - Token usage: 1,171 input / 534 output / 1,705 total
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT tracing warnings.

### Notes / Next Work

- Current implementation is source-grounded and optional; OpenAI failure logs a warning and falls back to deterministic proposals.
- The next quality step is to tune `needs_llm` gating so only the highest-value ambiguous rows are sent, then run a larger LLM smoke and compare before enabling in production.
- The LLM should remain a classifier/repair stage, not a free-form extractor; Docling/code still own parsing, cleanup, traceability, and fallback behavior.

## 2026-06-22 - Full Docling Rerun and Extraction Output Review

### Goal

Run the real PDF through Docling again, run the fixture/smoke harness, inspect the extraction output, and convert any obvious bad output patterns into systemic fixtures/fixes.

### Commands / Results

- `npm.cmd run docling:smoke:local` passed.
  - PDF: `C:\Users\hunte\Downloads\2074 legal signed outline spec.pdf.pdf`
  - Docling: 2.104.0
  - Pages: 34
  - Markdown characters: 89,871
  - Tables: 16
  - Elapsed: ~163s
- `npm.cmd run spec-extract:fixtures` passed: 7 fixtures.
- `npm.cmd run spec-extract:smoke` passed: 90 proposals.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT tracing warnings.

### Output Review Findings

The focused extraction review initially found systemic bad patterns that fixtures did not yet cover:

- `Ceramic tile floor finishes` could still choose repeated `FLOOR FINISHES` heading/carpet evidence.
- Generic schema-row duplicates such as `Paint` duplicated the canonical paint proposal.
- `Bathroom&` could become a bogus product title for a GIB ceiling row.
- `Please Note:` electrical-positioning notes could be extracted as a product.
- `Doors tops` was an OCR/readability issue for `Door stops`.

### Fixes

- Added fixtures for repeated floor-heading evidence, generic paint duplicate suppression, bathroom ampersand ceiling rows, and `Please Note:` note-row suppression.
- Enhanced evidence scoring/selection to prefer candidates that also match the extraction rule pattern, not just loose evidence terms.
- Removed `FLOOR FINISHES` as an evidence term for ceramic tile floor finishes because it is a repeated section heading, not source evidence.
- Added OCR normalization for `Door stops`, `mm gibboard`, `gibboard ceilings`, `throughouts`, and split `stopped` artifacts.
- Mapped paint colour-scheme rows and GIB ceiling rows to canonical proposal titles so schema-row duplicates are suppressed by the existing `seen` key.
- Skipped `Please Note:` rows in schema extraction.

### Current Focused Check

The focused review now reports no suspicious matches for the checked patterns: repeated all-caps heading snippets, generic `Paint`, `Bathroom&`, `Please Note:`, or `Doors tops` titles. Key fixture-backed rows now use clean evidence:

- `Interior flush panel doors` -> actual door row.
- `Interior paint finish and colour scheme` -> paint colour scheme row.
- `Ceramic tile floor finishes` -> ceramic tile floor row, not floor-heading/carpet evidence.
- `GIB board ceiling linings` -> GIB ceiling row.
- `Door stops` -> normalized hardware row.

## 2026-06-22 - Systemic Docling Extraction Rework Started

### Goal

Stop fixing individual Docling rows one at a time. Move extraction toward a deployable staged system with fixture coverage for known row classes.

### Changes

- Added a fixture-based regression harness:
  - `scripts/fixtures/spec-extract-row-fixtures.json`
  - `scripts/check-spec-extract-fixtures.mjs`
  - package script: `npm.cmd run spec-extract:fixtures`
- Refactored extraction helpers out of `src/lib/ai/spec-extract.ts` into staged modules:
  - `src/lib/ai/spec-normalize.ts` for OCR/text/table cleanup and cell dedupe.
  - `src/lib/ai/spec-evidence.ts` for evidence matching and scoring.
  - `src/lib/ai/spec-classify.ts` for review lanes and recommended action mapping.
- Updated `scripts/smoke-spec-extract.mjs` so smoke tests transpile the new helper modules as well as `spec-extract.ts`.
- Current fixtures cover:
  - interior flush panel doors must use the real door row instead of repeated headings.
  - Builder's-range tiling must collapse duplicated table cells and become context-before-search.
  - paint colour scheme must be treated as a general finish item and avoid duplicated evidence tails.

### Verification

- `npm.cmd run spec-extract:fixtures` passed: 3 fixtures.
- `npm.cmd run spec-extract:smoke` passed: 96 proposals, preserving broad recall.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT tracing warnings.

### Next Rule

For any future bad extraction row, add a fixture first in `scripts/fixtures/spec-extract-row-fixtures.json`, then change normalization/evidence/classification logic so the fixture passes. Do not patch single titles directly in the main extractor.

## 2026-06-22 - General Finish Items and Door Evidence Cleanup

### Goal

Incorporate review feedback that finish-style items such as tiles, paint, carpet/flooring, and doors often do not need warranty documents. These rows should usually be treated as general builder-reviewed handover context: supplier/range/colour/location/selection matters more than forcing a source-document/manual search.

### Changes

- `getInitialExtractedItemReviewReason()` now gives tiles, paint, flooring/carpet, and doors a general finish review note: confirm supplier/range/colour/location/selection where available; warranty docs may not be required before inclusion.
- Evidence selection now prefers chunks containing higher-priority evidence terms before looser pattern matches, so rule rows do not get captured by repeated section headings.
- Low-information repeated headings such as `INTERIOR DOORS INTERIOR DOORS` are ignored as evidence candidates.
- Short evidence rows are no longer cropped around the matched term, which keeps the full door row visible.
- Added OCR/readability fixes for interior door and paint rows, including `Hollow core`, `flush panel pre-hung doors`, `Semi-gloss paint finish`, `Interior colour scheme`, and paint colour spacing.
- Added repeated-tail cleanup so duplicated Docling table columns collapse in rule-based snippets as well as schema row snippets.

### Verification

- Current `Interior flush panel doors` proposal now uses the actual row: `Doors Type Size Finish Frames Hollow core flush panel pre-hung doors 2200 mm Semi-gloss paint finish 19 mm pine flush jamb for architraves with Semi-gloss paint finish Interior Door Flush Panel`.
- Current paint and wall-tile evidence no longer duplicates the repeated table column.
- Backfilled current Supabase rows for `Interior flush panel doors`, `Interior paint finish and colour scheme`, `Bathroom and wet-area ceramic wall tiles`, and `Garage carpet` with the cleaned evidence and general finish review reason.
- `npm.cmd run spec-extract:smoke` passed: 96 proposals.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known Docling/Turbopack NFT tracing warnings.

## 2026-06-22 - Context Flags and Tiling Row Cleanup

### Goal

Respond to fresh PDF review feedback: context classification should be a flag explaining what the system needs before source search, not a builder-facing "Request context" button. Also clean the duplicated/poorly spaced Docling tiling rows seen in review.

### Changes

- Removed the manual "Request context" button and its unused server action.
- Added non-clickable amber context flags to the builder review queue for:
  - missing brand/model/supplier/code before source search
  - missing quote/manual/warranty/certificate/source document
  - missing builder context before source search
- Added duplicate table-cell cleanup so Docling rows with repeated columns only persist one copy in `extracted_text` and `source_snippet`.
- Stopped stripping the word `Builder` from evidence text so `Builder's range` remains readable.
- Added OCR/readability fixes for Builder's-range tiling phrases, `freestanding`, tiled shower/feature-wall/window-jamb text, punctuation spacing, and comma spacing.
- Prioritized `selected` / `Builder's range` rows into `request_more_context` before falling back to `needs_model_code`.

### Verification

- `npm.cmd run spec-extract:smoke` passed: 96 proposals, preserving recall.
- Spot-check for the reported row now returns title `Wall Tiling- Bathroom(freestanding bath)`, action `request_more_context`, and a single clean source snippet: `Selected ceramic tiles from the Builder's range. All walls tiled floor to ceiling, tiled shower. 1 x tiled feature wall. Tiled into window recess. Tiled into window jamb, sills`.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with the known Docling/Turbopack NFT tracing warnings.

## 2026-06-22 - Request-More-Context Review Classification

### Goal

Add a first-pass workflow so over-extracted Docling rows are not all just "needs review". Keep recall-first extraction intact while classifying uncertainty into actionable builder/admin follow-up buckets.

### Changes

- `src/lib/ai/spec-extract.ts` now classifies extracted proposals into:
  - `review_new_product`
  - `needs_model_code`
  - `needs_source_document`
  - `request_more_context`
  - existing document/task actions
- Added `getInitialExtractedItemReviewReason()` so inserted rows carry clear reviewer notes such as "Request model/code", "Request source document", or "Request more context".
- Added optional enum statuses in code/docs for `request_more_context`, `needs_source_document`, and `needs_model_code`.
- Added `docs/supabase-add-extracted-item-context-statuses.sql` for the enum migration.
- `/api/specifications/process-pdf` now attempts the richer statuses, but falls back to `admin_review` plus the explicit review note if the database enum has not been migrated yet.
- Builder review UI now includes a Context requests metric and non-clickable context flags that explain what is missing before source search.
- Builder dashboard/product awaiting counts include the new context-request statuses.

### Verification

- Pushed implementation commit `e52e623` to `codex/docling-local-context`.
- `npm.cmd run spec-extract:smoke` passed: 96 proposals, preserving the current broad recall.
- Action breakdown from the smoke artifact: 50 standard product review, 25 needs model/code, 8 request more context, 7 needs source document, 2 request document, 3 manual review, 1 attach existing task.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known local Docling/Turbopack NFT tracing warnings.

### Data Backfill

- Latest full Docling upload `96386625-c705-4895-9f89-40c09a899d04` was backfilled by title where possible.
- 75 of 100 rows matched the current proposal titles and had review notes refreshed.
- Current visible review-note grouping on that upload: 68 standard review, 9 needs source document, 16 needs model/code, 7 request more context.
- The DB enum migration could not be applied from this machine because direct Supabase Postgres access on port 5432 was blocked, so backfill used `admin_review` status with explicit review notes.

### Remaining Work

- Apply `docs/supabase-add-extracted-item-context-statuses.sql` from an environment with direct Supabase DB access or via Supabase SQL editor if we want true status values instead of review-note fallback.
- Add dedicated UI filters/tabs for context buckets.
- Add a builder-facing request workflow that creates assignable prompts/tasks rather than just a review note.
- Keep recall-first tuning toward 200-300 possible rows; do not suppress uncertain source-backed candidates just to reduce noise.

## 2026-06-22 - Docling OCR Readability and Title Dedupe Pass

### Goal

Continue the Docling local-first extraction work with slice A from the cloud-Codex prompt: improve OCR/readability normalization and collapse obvious duplicate title variants without making extraction conservative.

### Changes

- Added an OCR phrase-fix table in `src/lib/ai/spec-extract.ts` for recurring Docling/OCR artifacts.
- Applied OCR fixes before and after generic spacing normalization so introduced split-word artifacts can be repaired.
- Added title normalization for extracted row titles.
- Changed proposal de-dupe keys to use compact normalized titles, collapsing obvious case/spacing variants like Garage carpet/Garage Carpet and Grohe kitchen mixer/Grohe Kitchen Mixer.

### Examples Improved

- `Blockworkonfooting` -> `Blockwork on footing`
- `Cavity Slider Hand les` -> `Cavity Slider Handles`
- `To ilet`/`To iletroll` cases now normalize into toilet/toilet-roll titles where matched.
- `Heated To wel Rail` -> `Heated Towel Rail`
- `Gasheating` -> `Gas heating`
- Some source snippets now improve `Internalreticulation`, `Garagecarpetgluefixed`, `irresistiblybeautiful`, and related glued phrases.

### Verification

- Baseline smoke before this pass: 97 proposals.
- After this pass: 96 proposals (90 products, 4 maintenance, 2 documents). The small count drop is from duplicate title collapse, not from conservative filtering.
- `npm.cmd run spec-extract:smoke` passed.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with the known local Docling/Turbopack NFT tracing warnings.

### Remaining Work

- Continue expanding OCR/readability normalization based on fresh full-workflow rows.
- Add richer `request more context` / `needs source document` workflow instead of all rows being simple `admin_review`.
- Keep recall-first behavior: the spec may have 200-300 potential rows, so do not make extraction conservative merely to reduce noise.
- Later build Azure Content Understanding comparison harness using the same schema as a benchmark only.

## 2026-06-21 - Full Docling Workflow Quality Assessment

### Fresh Run Observed

Full UI upload -> Docling parse -> schema-inspired extraction -> Supabase review queue produced upload `96386625-c705-4895-9f89-40c09a899d04`.

Counts:

- Total rows: 100
- Products: 95
- Maintenance: 3
- Documents: 2
- Status: all `admin_review`
- No rows missing `source_snippet`

Category distribution was strongest in bathroom fixtures, tapware, doors/hardware, flooring, electrical, and tiles. Many rows are genuinely useful and include manufacturer/code/search-query details, especially bathroom fixtures and tapware.

### Quality Issues

- OCR spacing remains the largest quality problem: examples include `Finalpositionsofall`, `Internalreticulation`, `To ilet`, `Hand les`, `squote`, etc.
- Some false positives/generic rows remain: `Please Note:`, `Doors tops`, `Pipe work`, generic `Kitchen`/`Scullery` quote rows, etc.
- Duplicate normalization still needs work: e.g. Garage carpet and Grohe kitchen mixer case variants.
- All rows currently go to `admin_review`; UX needs a separate "request more context" workflow instead of only review/approve/reject.

### Recommendation

Keep refining Docling as the default local-first path for now. The fresh run proves the local pipeline can reach useful breadth without paying a managed extractor for every run. However, run Azure Content Understanding as a benchmark/comparison spike, not an immediate replacement. If Azure is materially better on spacing, item identity, page evidence, and structured fields after using the same schema, then decide whether its quality justifies provider cost/lock-in or whether it should remain an optional paid extraction tier.

### Next Engineering Steps

1. Add OCR/readability normalization pass before persistence.
2. Add duplicate/title normalization.
3. Add false-positive filters for generic note rows.
4. Add "request more context" review action and status.
5. Add an Azure comparison harness using the same schema and same PDF, storing outputs side-by-side for evaluation.

## 2026-06-21 - Azure-Schema-Inspired Table Extraction

### User Feedback

User shared the Azure Context Understanding schema that performed better: exhaustive `Items[]` with item-centric fields including Name, Manufacturer, Supplier, ProductRange, ModelName, ProductCode/SKU, Finish/Colour/Size/Quantity, Category/Location, Description/Notes, HasIdentifier, and SuggestedSearchQuery.

### Implementation

- Kept Docling as the local parser/OCR layer.
- Added schema-inspired extraction from Docling markdown table rows in `src/lib/ai/spec-extract.ts`.
- Table-row candidates now preserve structured detail inside `extracted_text` using fields such as Name, Manufacturer/Supplier, ProductCode, Finish, Size, Category, Location, Description, HasIdentifier, and SuggestedSearchQuery.
- Source snippets are original row text rather than large merged chunks where possible.

### Verification / Data Repair

- `npm.cmd run spec-extract:smoke` now returns 97 proposals from the real Docling artifact.
- Latest upload `f8eb73cd-3359-404f-b708-63d1681df522` was repaired: existing 25 rows updated and 70 missing rows inserted, leaving 95 review rows after de-dupe.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known local Docling Turbopack NFT warnings.

### Caution / Next Tuning

This is a deterministic schema-inspired extractor, not Azure semantic extraction yet. It is intentionally more exhaustive and will include noisy/generic rows. Next pass should tune false positives, improve title generation, and map the structured fields to first-class DB columns if the review UI proves useful.

## 2026-06-21 - Table-Row Evidence Snippet Tightening

### Issue

The Grohe kitchen mixer row still had source/evidence snippets polluted by adjacent shower-table text and footer OCR such as Builder/Client/quality-home-builder fragments.

### Fix

- Evidence selection now prefers original Docling markdown/table lines before broader merged chunks.
- Evidence cleanup strips Builder/Client footer fragments and other repeated OCR/footer noise.
- Latest upload `f8eb73cd-3359-404f-b708-63d1681df522` was backfilled: 25 rows had `extracted_text` and `source_snippet` regenerated from the tighter evidence selector.

### Verification

- Grohe row now backfills as: `Grohe,Essence Kitchen Mixer with pullout spray-brushed warm sunset 30270 DLO Kitchen Mixer`.
- `npm.cmd run spec-extract:smoke` passed with 28 proposals.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with known local Docling Turbopack NFT warnings.

### Next Step

Refresh the open edit page and spot-check more rows. If a row still blends adjacent table cells, tune its specific rule/evidenceTerms or add table-cell extraction instead of chunk fallback.

## 2026-06-21 - Source Snippet Persistence Fix

### Issue

After the broader Docling extraction run, about 25 rows were inserted, but review edit pages still warned that no source snippet was attached. The form displayed fallback `extracted_text` in the source snippet textarea, while the database `source_snippet` column was null. Evidence snippets also included Docling image/comment artifacts such as `<!-- image -->`.

### Fix

- `ProposedSpecItem` now carries `source_snippet` and `source_page` fields.
- `src/lib/ai/spec-extract.ts` now strips Docling image/comment artifacts before saving evidence text/snippets.
- `/api/specifications/process-pdf` now persists `source_snippet` and `source_page` when inserting `extracted_handover_items`.
- Latest upload `b13c6801-6a3d-4100-85ca-b43d149b6e59` was backfilled: 25 existing rows updated with generated source snippets.

### Verification

- `npm.cmd run spec-extract:smoke` passed with 27 proposals.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with the known local Docling Turbopack NFT warnings.

### Next Step

Refresh the current review edit page. The yellow "No source snippet" warning should disappear for backfilled rows. Snippet readability is improved but still limited by OCR spacing; further tuning should focus on cleaner source chunking/page attribution.

## 2026-06-21 - Broader Docling Extraction Push Completed

### Push

- Branch: `codex/docling-local-context`
- Implementation commit: `214872f`
- Commit message: `feat: broaden Docling spec extraction`

### Current Ground Truth

The app previously completed Docling parse/upload but inserted only 5 rows because `src/lib/ai/spec-extract.ts` was too narrow. That function now emits 27 proposals from the real Docling markdown smoke artifact while keeping the workflow contract unchanged.

### Next Step

Restart or refresh the local dev app, reprocess the same PDF through `/builder/specifications/new`, then inspect `/builder/specifications/review`. Expect a new upload to create about 27 rows; compare quality/noise before tuning further.

## 2026-06-21 - Docling-Aware Extraction Breadth Implemented

### What Changed

- Replaced the tiny keyword-only `buildSpecificationProposals()` stub with a broader deterministic extractor that normalizes Docling markdown, chunks evidence, applies product/maintenance/document rules, deduplicates rows, and preserves source snippets.
- Added `scripts/smoke-spec-extract.mjs` plus `npm.cmd run spec-extract:smoke` to test proposal breadth against the local Docling markdown artifact without re-running Docling.
- Kept the existing review workflow contract and status behavior: known maintenance matches can auto-approve, while most new/uncertain product rows remain review/source-gap candidates.

### Verification

- `npm.cmd run spec-extract:smoke` passed against `.local-artifacts/docling/2074-legal-signed-outline-spec.md`.
- Smoke output: 27 proposals total: 21 product, 4 maintenance, 2 document.
- `npm.cmd run lint` passed.
- `npm.cmd run build` passed with the known local Docling Turbopack NFT warnings.

### Next Task

Restart/reload the dev server and process the PDF again through `/builder/specifications/new`. The new upload should insert about 27 review rows instead of the previous 5; then inspect `/builder/specifications/review` for row quality/noise and tune the rule list.

## 2026-06-21 - Docling Parse Complete, Extraction Breadth Bottleneck

### Evidence

- The real scanned spec upload completed and inserted a `specification_uploads` row.
- Latest upload `1a05e070-a4e2-46bf-9aea-142e4b6cae68` produced exactly 5 `extracted_handover_items`.
- Process inspection showed no active Docling child process; parsing was finished, not still running.
- Inserted items were limited to the existing canned keyword outputs: Linea Weatherboard, gutters/downpipes cleaning, exterior cladding washing, kitchen appliances, and heat pump system.

### Root Cause

The parser is no longer the main bottleneck. The current proposal builder in `src/lib/ai/spec-extract.ts` is still a small deterministic stub that only emits a handful of canned rows when keywords are present.

### Active Next Task

Build a broader Docling-aware deterministic extractor that chunks/labels Docling markdown and creates more source-grounded proposal rows while keeping admin-noise and source-gap guardrails strict. Local plan saved at `.hermes/plans/2026-06-21_204900-docling-extraction-breadth.md`.

## 2026-06-21 - Specification Process Storage Upload Fix

### What Changed

- Updated `/api/specifications/process-pdf` so the storage upload uses the server-only Supabase service-role client when `SUPABASE_SERVICE_ROLE_KEY` is available.
- Kept authenticated user checks and normal row inserts on the request/session Supabase client.
- Added server logging and a `detail` field for storage upload failures so future upload errors are diagnosable instead of only showing `Could not upload specification PDF.`
- Updated the upload panel to surface the returned storage detail in the inline error when an upload still fails.

### Why

The Docling parse completed far enough to reach the Supabase storage upload, but the browser received `Could not upload specification PDF.` The local app already has the private `handover-documents` bucket and service role configured; using the server-only service role for bucket writes avoids client/RLS storage policy friction during the local workflow while keeping secrets server-side.

### Checks Run

- `npm.cmd run document-context:readiness` - passed.
- `npm.cmd run supabase:smoke:readiness` - passed; private `handover-documents` bucket reachable.
- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed, with known local Docling Turbopack NFT tracing warnings.

### Next Task

Restart `npm.cmd run dev:docling`, hard-refresh the app, upload the PDF again, and wait for the Docling process. If it still fails, the inline error should now include the Supabase storage detail and the terminal should log the bucket/path/error.

## 2026-06-21 - HMR Origin And File Input Resync

### What Changed

- Added `allowedDevOrigins` for `127.0.0.1` and `localhost` in `next.config.ts` to stop the local HMR websocket from being blocked when the browser and dev server hostnames differ.
- Added a mount-time native file-input resync in `SpecExtractPanel` so a selected browser file is copied back into React state after Fast Refresh/HMR preserves the input control but resets component state.

### Why

The user saw `WebSocket connection to ws://127.0.0.1:3000/_next/webpack-hmr failed` and the screenshot showed the native file chooser had a PDF while the app status still said `No PDF selected`. That is consistent with dev HMR/origin trouble plus native file input state surviving while React state reset.

### Checks Run

- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed, with known local Docling Turbopack NFT tracing warnings.

### Next Task

Restart the dev server because `next.config.ts` changed, open one canonical URL (`http://localhost:3000` or `http://127.0.0.1:3000`, not both), hard-refresh, select the PDF again, and click `Process to review`.

## 2026-06-21 - Spec Upload Button UX Fix

### What Changed

- Made the `Process to review` and `Preview PDF only` buttons clickable whenever the panel is not already processing.
- Added a ref-backed file lookup so the handler can read the native file input even if React state and the browser file chooser display get out of sync.
- Added both `onChange` and `onInput` handling for the specification PDF input.
- Verified the Projects `Add new project` modal opens in-browser while signed in as the documented test account.

### Why

The user selected the real spec PDF and the native input showed the filename, but `Process to review` still appeared greyed out. This indicates the browser input UI and React `selectedPdf` state could get out of sync. The button now validates on click instead of being permanently blocked by stale state.

### Checks Run

- Browser check: `/builder/specifications/new` now shows `Process to review` enabled; clicking without a file shows `Choose a PDF first.`
- Browser check: `/builder/projects` `Add new project` opens the project modal.
- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed, with the known Turbopack NFT tracing warnings around local Docling child-process support.

### Next Task

Ask the user to refresh `/builder/specifications/new`, select the real spec PDF again, and click `Process to review`. If processing starts, wait several minutes for Docling. If it fails, capture the inline error and server log.

## 2026-06-21 - Windows PowerShell Docling Dev Command Fix

### What Changed

- Added `npm.cmd run dev:docling` so Windows PowerShell users do not need POSIX-style inline environment variable syntax.
- Updated worksheet/phased-work/handoff docs to prefer the Windows-friendly command.

### Why

PowerShell rejected `DOCUMENT_CONTEXT_PROVIDER=docling_local npm.cmd run dev` because that syntax is for POSIX shells, not PowerShell.

### Next Command

```powershell
npm.cmd run dev:docling
```

Alternative:

```powershell
$env:DOCUMENT_CONTEXT_PROVIDER="docling_local"; npm.cmd run dev
```

## 2026-06-21 - Docling Local Parser Implementation Push Completed

### What Changed

- Pushed the local Docling parser spike and `docling_local` provider wiring to GitHub.
- Branch: `codex/docling-local-context`.
- Commit pushed: `1a79f03`.
- Left `.local-artifacts/docling/` ignored and uncommitted. Left local `.codex/` and `.hermes/` untracked and uncommitted.

### Files Changed

- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `git push origin HEAD` - passed.
- `git status --short --branch` - branch is aligned with origin except untracked local agent folders.

### Unknowns/Risks

- Browser upload smoke has not yet been run with `DOCUMENT_CONTEXT_PROVIDER=docling_local`.
- Turbopack build currently passes with NFT tracing warnings around local Docling child-process support.

### Suggested Next Task

Run the app with `npm.cmd run dev:docling` from Windows PowerShell (or `$env:DOCUMENT_CONTEXT_PROVIDER="docling_local"; npm.cmd run dev`), upload the real scanned outline spec through the builder specification flow, and verify extraction diagnostics/review queue quality before tuning prompts or moving toward a VPS Docling service.

## 2026-06-21 - Docling Local Parser Smoke Implemented

### What Changed

- Added `.local-artifacts/` to `.gitignore` for local parser outputs.
- Added `scripts/docling-convert.py`, a local Docling conversion CLI that writes markdown, JSON, and diagnostics artifacts.
- Added `scripts/smoke-docling-local.mjs` and `npm.cmd run docling:smoke:local` for the real scanned spec smoke.
- Installed `docling==2.104.0` in the local Hermes Python environment only; no Python environment files were committed.
- Extended document-context provider types/readiness to support `docling_local` and `docling_http` provider names while keeping LlamaCloud intact.
- Wired `DOCUMENT_CONTEXT_PROVIDER=docling_local` into `extractDocumentContext()` with fallback to `local_pdf` if Docling fails.
- Updated Docling plan/phased-work/worksheet docs with the local parse result.

### Files Changed

- `.gitignore`
- `package.json`
- `scripts/docling-convert.py`
- `scripts/smoke-docling-local.mjs`
- `scripts/check-document-context-readiness.mjs`
- `src/lib/server/docling.ts`
- `src/lib/server/document-context.ts`
- `src/lib/server/document-context-readiness.ts`
- `src/lib/server/specification-response.ts`
- `docs/docling-local-context-plan.md`
- `docs/docling-phased-work.md`
- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

### Checks Run

- `python -m pip show docling` - passed; local Hermes Python has `docling 2.104.0`.
- `npm.cmd run docling:smoke:local` - passed; warm run parsed 34 pages into 89,871 markdown characters and 16 table-like structures in 167.537 seconds.
- `npm.cmd run document-context:readiness` - passed; default remains `local_pdf`.
- `DOCUMENT_CONTEXT_PROVIDER=docling_local npm.cmd run document-context:readiness` - passed; reports `selectedProvider: docling_local` and `willUseDocling: true`.
- `npm.cmd run supabase:smoke:readiness` - passed.
- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed. Turbopack emitted NFT tracing warnings for the local Docling child-process path; this is acceptable for the local spike but should be addressed before Cloudflare/OpenNext deployment.

### Unknowns/Risks

- The actual browser upload workflow has not yet been run with `DOCUMENT_CONTEXT_PROVIDER=docling_local`.
- Docling output is much richer than plain pdf-parse but still has OCR spacing/word-join artifacts, so extraction prompt/normalization may need tuning after the browser smoke.
- CPU parse time is a few minutes for the 34-page scanned PDF; future VPS sizing and caching need consideration.
- Turbopack tracing warnings around local Docling should be revisited before production hosting.

### Suggested Next Task

Set `DOCUMENT_CONTEXT_PROVIDER=docling_local`, start the app, upload the real scanned outline spec through `/builder/specifications/new`, and verify that extraction diagnostics show Docling without fallback and that the review queue contains useful homeowner-relevant rows while admin/source-gap guardrails still hold.

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
