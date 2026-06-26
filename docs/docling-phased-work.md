# Docling Phased Work

Date: 2026-06-21
Branch: `codex/docling-local-context`

This is the fast build path for adding Docling as a local-first document context provider while preserving the LlamaCloud adapter for later comparison.

## Phase D0 - Planning And Branch Anchor

Goal: make the Docling direction explicit before code work begins.

Status: completed and pushed on `codex/docling-local-context`; implementation continued into D1-D3.

Tasks:

- Keep LlamaCloud architecture intact; do not delete `src/lib/server/llamacloud.ts` or the existing readiness behavior.
- Add `docs/docling-local-context-plan.md` as the design anchor.
- Link this phased work from `docs/phased-work.md`, `docs/architecture.md`, `WORKSHEET.md`, and `docs/agent-handoff-log.md`.

Done when:

- Future agents can see Docling is the next parser spike without losing LlamaCloud as a future option.

## Phase D1 - Local Docling CLI Spike

Goal: prove whether Docling can parse the real scanned spec well enough before app integration.

Status: completed locally. `npm.cmd run docling:smoke:local` parsed the 34-page scanned PDF with Docling 2.104.0, produced 89,871 markdown characters and 16 table-like structures, and saved ignored artifacts under `.local-artifacts/docling/`. First run took 266.421s while downloading models; warm run took 167.537s on CPU.

Tasks:

1. Create an ignored local artifact directory:

   ```txt
   .local-artifacts/docling/
   ```

2. Install Docling in a local Python environment or user environment, not as a committed Node dependency.

   Candidate commands:

   ```bash
   python -m pip install --upgrade pip
   python -m pip install docling
   python -m pip show docling
   ```

3. Create `scripts/docling-convert.py` that accepts:

   ```txt
   input PDF path
   --out-dir
   --basename optional
   ```

4. Run it against:

   ```txt
   C:\Users\hunte\Downloads\2074 legal signed outline spec.pdf.pdf
   ```

5. Write local ignored outputs:

   ```txt
   .local-artifacts/docling/2074-legal-signed-outline-spec.md
   .local-artifacts/docling/2074-legal-signed-outline-spec.json
   .local-artifacts/docling/2074-legal-signed-outline-spec-diagnostics.json
   ```

Done when:

- The command completes locally.
- Diagnostics record page count, character count, elapsed time, warnings/errors, and Docling version if available.
- The markdown/JSON output is good enough to inspect manually.

## Phase D2 - Provider Contract Extension

Goal: add Docling to the provider contract without disrupting existing upload behavior.

Status: implemented for `docling_local`. The app can select `DOCUMENT_CONTEXT_PROVIDER=docling_local`; Docling failure falls back to `local_pdf` with warnings. `docling_http` remains planned for a future VPS/container service.

Tasks:

1. Extend `DocumentContextProvider` in `src/lib/server/document-context.ts`:

   ```ts
   export type DocumentContextProvider = "local_pdf" | "llamacloud_parse" | "docling_local" | "docling_http";
   ```

2. Add a new server helper:

   ```txt
   src/lib/server/docling.ts
   ```

3. Implement `parseDocumentWithDoclingLocal(input)` by writing the upload bytes to a temp file, invoking `scripts/docling-convert.py`, and reading markdown/JSON output.

4. Normalize Docling output into `DocumentContextResult`:

   ```txt
   provider: "docling_local"
   text: markdown or extracted text
   markdown: markdown
   diagnostics.pageCount
   diagnostics.characterCount
   diagnostics.tableCount if available
   diagnostics.warnings
   diagnostics.externalJobId undefined for local
   ```

5. Keep fallback behavior safe: if Docling fails, warn and fall back to `local_pdf` in the same pattern as LlamaCloud.

Done when:

- TypeScript compiles.
- Existing `local_pdf` and LlamaCloud paths still work.

## Phase D3 - Readiness And Smoke Commands

Goal: make provider status obvious before expensive or slow parsing runs.

Status: implemented for local mode. `DOCUMENT_CONTEXT_PROVIDER=docling_local npm.cmd run document-context:readiness` now reports `selectedProvider: docling_local` and `willUseDocling: true`.

Tasks:

1. Extend `src/lib/server/document-context-readiness.ts` to recognize:

   ```txt
   docling
   docling_local
   docling-local
   docling_http
   docling-http
   ```

2. Add checks for:

   ```txt
   DOCLING_PYTHON
   DOCLING_SCRIPT
   DOCLING_SERVICE_URL
   ```

3. Extend `scripts/check-document-context-readiness.mjs` output to show:

   ```json
   {
     "doclingLocalConfigured": true,
     "doclingHttpConfigured": false,
     "willUseDocling": true
   }
   ```

4. Add a local smoke script:

   ```txt
   scripts/smoke-docling-local.mjs
   ```

5. Add package script:

   ```json
   "docling:smoke:local": "node scripts/smoke-docling-local.mjs"
   ```

Done when:

- `DOCUMENT_CONTEXT_PROVIDER=docling_local npm.cmd run document-context:readiness` reports Docling will be used.
- `npm.cmd run docling:smoke:local` processes the real PDF or exits with a clear message if the file/Docling install is missing.

## Phase D4 - App Upload Integration Test

Goal: prove the actual app upload path can use Docling context.

Status: next active task. Build passes, but the browser upload path has not yet been run with `DOCUMENT_CONTEXT_PROVIDER=docling_local`. On Windows PowerShell, use `npm.cmd run dev:docling` or `$env:DOCUMENT_CONTEXT_PROVIDER="docling_local"; npm.cmd run dev`; do not use POSIX inline env syntax.

Tasks:

1. Set locally:

   ```txt
   DOCUMENT_CONTEXT_PROVIDER=docling_local
   ```

2. Run:

   ```bash
   npm.cmd run document-context:readiness
   npm.cmd run supabase:smoke:readiness
   npm.cmd run dev
   ```

3. Use the browser to upload the scanned outline spec.

4. Confirm extraction diagnostics show:

   ```txt
   provider: docling_local
   fallbackUsed: false
   characterCount meaningfully higher than current pdf-parse result
   ```

Done when:

- A real uploaded document creates a review queue using Docling context.
- Admin-noise guardrails still apply.
- Source-gap rows remain review-blocked as designed.

## Phase D5 - `docling_http` Service Shape

Goal: prepare for cheap VPS hosting without committing to the VPS yet.

Tasks:

1. Add HTTP client support in `src/lib/server/docling.ts`:

   ```txt
   DOCLING_SERVICE_URL
   DOCLING_SERVICE_TOKEN
   ```

2. Define request/response JSON contract in `docs/docling-local-context-plan.md` or a new service spec.

3. Add clear timeout and file-size behavior.

4. Do not deploy yet; just make the provider shape testable against a future local FastAPI service.

Done when:

- `DOCUMENT_CONTEXT_PROVIDER=docling_http` readiness can distinguish configured vs missing service URL.
- The app has a stable contract for future VPS implementation.

## Phase D6 - Full Supabase Workflow Smoke

Goal: prove the product workflow with Docling, not just parsing.

Tasks:

1. Login as builder.
2. Create/open a project.
3. Upload the real scanned spec.
4. Verify extraction queue quality.
5. Try source-gap approval and confirm unsafe approval is blocked.
6. Add builder-supplied notes for project-only facts.
7. Attach supporting evidence/quote where relevant.
8. Confirm publish readiness blocks unresolved items.
9. Publish only reviewed safe items.
10. Open client portal and confirm only homeowner-safe data appears.

Done when:

- The scanned spec can move through the workflow without leaking raw AI output or unresolved gaps to the client portal.

## Phase D7 - Decide Parser Path

Goal: choose the best next parser path based on evidence.

Decision inputs:

- Docling parse quality.
- Processing time and CPU/RAM on local PC.
- Expected cheap VPS sizing.
- Azure Content Understanding PAYG estimate and setup complexity.
- LlamaCloud quality if tested later.

Possible decisions:

- Continue Docling local/VPS path.
- Add Azure Content Understanding as a second provider.
- Keep LlamaCloud only as optional fallback/comparison.
- Revisit Cloudflare Containers after Docling service is stable.

## Verification Gates

Before pushing implementation changes:

```bash
npm.cmd run document-context:readiness
npm.cmd run supabase:smoke:readiness
npm.cmd run docling:smoke:local
npm.cmd run lint
npm.cmd run build
```

If `docling:smoke:local` cannot run because Docling is not installed or the local PDF is absent, document that explicitly in `WORKSHEET.md` and `docs/agent-handoff-log.md`.
