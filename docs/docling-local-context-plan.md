# Docling Local Document Context Plan

Date: 2026-06-21
Branch: `codex/docling-local-context`

## Decision

Add Docling as a first-class document context provider without removing the existing LlamaCloud architecture. The immediate goal is local testing against the real scanned outline spec before choosing a hosted parser path.

Docling should start as a local development provider and then become a small HTTP provider that can run on a cheap VPS or, later, a Cloudflare Container. LlamaCloud remains available as a future comparison provider if its quality justifies the monthly plan.

## Why Docling now

- The real test PDF is scanned/image-heavy; current local `pdf-parse` extracted very little useful text.
- LlamaCloud is not pure pay-as-you-go after the free tier, so it should not be the only realistic parser path.
- Azure Content Understanding is promising true pay-as-you-go, but it introduces Azure/Foundry setup and model billing.
- Docling lets us test parser quality locally first, with no committed secrets and no parser SaaS spend.
- If local quality is good, a cheap VPS can host the same service later behind the existing document-context provider boundary.

## Provider strategy

Keep provider selection explicit and additive:

```txt
DOCUMENT_CONTEXT_PROVIDER=local_pdf
DOCUMENT_CONTEXT_PROVIDER=docling_local
DOCUMENT_CONTEXT_PROVIDER=docling_http
DOCUMENT_CONTEXT_PROVIDER=llamacloud
DOCUMENT_CONTEXT_PROVIDER=azure_content_understanding  # future spike, not implemented in this pass
```

Provider roles:

- `local_pdf`: existing built-in fallback using local PDF/text/OCR helpers.
- `docling_local`: local-only provider that shells out to a local Docling runner script. Best for quick testing on this PC.
- `docling_http`: production-shaped provider that calls a Docling API service. Can point at `http://127.0.0.1` during development, a VPS later, or a Cloudflare Container if viable.
- `llamacloud_parse`: keep existing implementation for future quality comparison.
- `azure_content_understanding`: keep as a documented future adapter option, not required for this branch.

## Target architecture

```txt
Builder uploads PDF
-> app stores private uploaded document
-> document-context provider selected by DOCUMENT_CONTEXT_PROVIDER
   -> local_pdf fallback OR
   -> docling_local runner OR
   -> docling_http service OR
   -> LlamaCloud when intentionally configured
-> normalized DocumentContextResult with text/markdown/tables/diagnostics
-> outline-spec schema extraction
-> admin-noise guardrails
-> source-gap review workflow
-> Supabase/local workflow item persistence
-> builder review/publish
```

## Implementation principles

1. Do not remove LlamaCloud code or docs.
2. Do not add Docling as a mandatory app dependency for normal `npm install`.
3. Keep Python/Docling isolated under scripts or a service folder.
4. Never commit parsed PDFs or raw customer documents.
5. Cache/save local parse outputs only under ignored local artifact paths.
6. The app should fail safely back to `local_pdf` unless Docling is explicitly selected.
7. Readiness checks must be secret-safe and must not require paid provider keys.
8. The first success criterion is evidence: run Docling against the real scanned spec and compare output quality.

## Local test PDF

Use the existing real scanned outline spec:

```txt
C:\Users\hunte\Downloads\2074 legal signed outline spec.pdf.pdf
```

Do not commit this file or raw parse artifacts.

## Expected new local artifacts

Ignored local outputs should go under:

```txt
.local-artifacts/docling/
```

Expected files during testing:

```txt
.local-artifacts/docling/2074-legal-signed-outline-spec.md
.local-artifacts/docling/2074-legal-signed-outline-spec.json
.local-artifacts/docling/2074-legal-signed-outline-spec-diagnostics.json
```

These are for local inspection only.

## Files likely to change

### App provider code

- `src/lib/server/document-context.ts`
- `src/lib/server/document-context-readiness.ts`
- New: `src/lib/server/docling.ts`

### Scripts

- New: `scripts/docling-convert.py`
- New: `scripts/check-docling-readiness.mjs` or extend `scripts/check-document-context-readiness.mjs`
- Optional: `scripts/smoke-docling-local.mjs`

### Config/docs

- `package.json`
- `.gitignore`
- `docs/phased-work.md`
- `docs/docling-local-context-plan.md`
- `docs/docling-phased-work.md`
- `docs/architecture.md`
- `WORKSHEET.md`
- `docs/agent-handoff-log.md`

## Environment variables

Local shell-out mode:

```txt
DOCUMENT_CONTEXT_PROVIDER=docling_local
DOCLING_PYTHON=python
DOCLING_SCRIPT=scripts/docling-convert.py
DOCLING_OUTPUT_DIR=.local-artifacts/docling
```

HTTP service mode:

```txt
DOCUMENT_CONTEXT_PROVIDER=docling_http
DOCLING_SERVICE_URL=http://127.0.0.1:8765
DOCLING_SERVICE_TOKEN=optional-local-token
```

Fallback behavior:

- If `docling_local` is selected and the Python script or Docling install is missing, return a clear readiness failure and fall back only where the upload flow already supports warnings.
- If `docling_http` is selected and the service is unavailable, return a warning and fall back to `local_pdf` for local testing.
- If `DOCUMENT_CONTEXT_PROVIDER` is unset, preserve the current behavior: use LlamaCloud only if deliberately configured by key, otherwise `local_pdf`.

## Phased implementation summary

See `docs/docling-phased-work.md` for the detailed build sequence.

Short version:

1. Local Docling CLI spike against the real scanned PDF.
2. Add `docling_local` provider and readiness checks.
3. Add a parser smoke command that writes ignored local artifacts.
4. Wire upload/extraction through `docling_local` and verify diagnostics show Docling.
5. Add `docling_http` provider shape for future VPS hosting.
6. Run Supabase-mode browser workflow with the real scanned spec.
7. Compare Docling with Azure/LlamaCloud later only if local quality is insufficient.

## Validation commands

Baseline checks before implementation:

```bash
npm.cmd run document-context:readiness
npm.cmd run supabase:smoke:readiness
npm.cmd run lint
npm.cmd run build
```

Docling spike checks after implementation:

```bash
python -m pip show docling
python scripts/docling-convert.py "C:\Users\hunte\Downloads\2074 legal signed outline spec.pdf.pdf" --out-dir .local-artifacts/docling
npm.cmd run document-context:readiness
DOCUMENT_CONTEXT_PROVIDER=docling_local npm.cmd run document-context:readiness
npm.cmd run docling:smoke:local
npm.cmd run lint
npm.cmd run build
```

## Quality checklist for the first real parse

Inspect the generated markdown/JSON and answer:

- Does Docling recover meaningful text from the scanned pages?
- Does it preserve headings/sections well enough for source snippets?
- Are tables or schedule-like rows represented usefully?
- Is output long enough and structured enough to beat current `pdf-parse`?
- Does it hallucinate or over-merge unrelated sections?
- Is processing time acceptable on this PC?
- Is memory/CPU usage acceptable for a future cheap VPS?

## Risks and mitigations

- **Docling install size/dependencies:** isolate it in Python tooling; do not make it a Node app dependency.
- **OCR quality unknown:** first task is a real parse quality spike before app integration.
- **Slow processing:** keep extraction async and cache parse output by uploaded document checksum later.
- **Windows path quirks:** use explicit quoted paths and script arguments; test on this PC first.
- **VPS security:** future `docling_http` must require a token and should only fetch signed/private URLs or accept authenticated uploads.
- **Cloudflare Worker mismatch:** do not run Docling in normal Workers; use Worker/Queue only to orchestrate a service.
- **Provider sprawl:** keep all providers behind `DocumentContextResult` and readiness reporting.

## Recommendation

Build Docling as a branch-local spike now. If the local parse quality is good, finish `docling_local` and keep `docling_http` ready for a VPS. Only return to LlamaCloud or Azure if Docling quality, speed, or operations are not good enough.
