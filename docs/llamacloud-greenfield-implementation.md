# LlamaCloud Greenfield Implementation

This is the implementation path for the `codex/llamacloud-greenfield` branch.
It preserves the existing clean builder UI and spec-upload-first flow, while
starting the backend over around LlamaCloud document context processing and a
search-last workflow.

## Anchored Workflow

This is the preferred workflow unless a real production constraint proves it
wrong:

```txt
Builder uploads project spec/supporting documents
-> LlamaCloud reads the documents into clean context
-> outline-spec schema extracts handover candidates with evidence
-> database/source-cache match runs before search
-> high-confidence known matches are fast-approved or queued for quick builder confirmation
-> new/unclear rows wait for builder review
-> builder can leave and return later to approve, reject, edit, or add context
-> quote/document references can be uploaded and extracted back into linked items
-> clarified rows are matched against the database again
-> only builder-confirmed source-ready unknowns enter web/source search
-> builder/admin reviews source results
-> approved records become package-ready handover items
-> homeowner sees only published, reviewed, privacy-safe information
-> first homeowner open is recorded for builder records
```

Minor implementation details can change, but the ordering should not: database
match and builder clarification happen before paid web/source search.

## Stack

- Product UI: Next.js 16, React, TypeScript, Tailwind, lucide-react.
- Product runtime for now: Next.js route handlers/server actions.
- Future edge runtime: Cloudflare Workers/Queues/Durable Objects/D1/R2.
- Document context: LlamaCloud Parse first, local PDF/OCR fallback.
- Structured extraction contract:
  `src/lib/extraction/outline-spec-schema.ts`.
- AI/source reasoning: OpenAI only after document context and database matching.

## Current Branch Slice

Implemented in this first slice:

- Created the branch `codex/llamacloud-greenfield`.
- Added the outline-spec schema as a repo-owned TypeScript/JSON-schema contract.
- Wrapped the schema with `Evidence` and `Review` metadata for source snippets,
  confidence, missing fields, builder questions, and search eligibility.
- Added a LlamaCloud REST client using the documented upload -> parse -> poll
  flow.
- Added a document context provider that uses LlamaCloud when configured and
  falls back to local PDF extraction when unavailable or failed.
- Rewired both PDF preview and process endpoints through the provider while
  keeping the existing frontend flow.

## Environment

Use local extraction by default:

```txt
DOCUMENT_CONTEXT_PROVIDER=local_pdf
```

Use LlamaCloud Parse:

```txt
DOCUMENT_CONTEXT_PROVIDER=llamacloud
LLAMA_CLOUD_API_KEY=llx-...
LLAMA_CLOUD_API_BASE_URL=https://api.cloud.llamaindex.ai
LLAMA_CLOUD_PARSE_TIER=agentic
LLAMA_CLOUD_POLL_ATTEMPTS=12
LLAMA_CLOUD_POLL_INTERVAL_MS=2500
```

`LLAMA_CLOUD_API_KEY` is the canonical secret name. Do not use alternate names
and do not commit the key. Keep it in `.env.local` for local development, in the
cloud host secret store for deployed environments, or in the Codex/CI secret
configuration when a real provider smoke is intentionally being run.

Provider selection is secret-safe and default-closed to local fallback:

- `DOCUMENT_CONTEXT_PROVIDER=local_pdf` forces the local PDF/OCR extractor even
  if `LLAMA_CLOUD_API_KEY` is present.
- `DOCUMENT_CONTEXT_PROVIDER=llamacloud` or `llamacloud_parse` uses LlamaCloud
  only when `LLAMA_CLOUD_API_KEY` is present.
- If `DOCUMENT_CONTEXT_PROVIDER` is omitted and `LLAMA_CLOUD_API_KEY` is
  present, the app will try LlamaCloud first.
- If LlamaCloud is selected but not configured, or if a parse request fails or
  returns no text, the app falls back to local PDF/OCR and records a warning in
  the extraction diagnostics.

Secret-safe readiness checks:

```bash
npm.cmd run document-context:readiness
```

The command loads Next.js `.env*` files when present, never prints the API key,
and reports `selectedProvider`, `llamaCloudConfigured`, `willUseLlamaCloud`, and
fallback reasons. A running app also exposes the same redacted report at:

```txt
GET /api/specifications/document-context-readiness
```

Before testing a real scanned PDF locally or in cloud, verify the report shows
`selectedProvider: "llamacloud_parse"` and `willUseLlamaCloud: true`. If Codex
Cloud or CI lacks `LLAMA_CLOUD_API_KEY`, the expected report is local fallback;
that is not a secret/config failure unless the environment was meant to exercise
real LlamaCloud parsing.

## Workflow To Build

```txt
Builder uploads spec PDF
-> file stored privately
-> LlamaCloud Parse produces markdown/text/items
-> schema extraction produces outline-spec Items[]
-> rows are normalized into internal extracted items
-> database match runs before source search
-> builder accepts high-confidence known matches
-> builder supplies context for low-confidence rows
-> database match runs again after context changes
-> only builder-confirmed source-ready unknowns enter Cloudflare search queue
-> builder/admin reviews source results
-> package-ready records publish to homeowner portal
```

## Product Requirements To Add Around The Workflow

### Privacy And Policy Compliance

- Treat uploaded specs, quotes, invoices, photos, and manuals as private project
  documents.
- Redact or avoid sending unnecessary personal details to AI providers where
  practical.
- Store raw files in private tenant-scoped storage.
- Keep homeowner-facing data separate from raw extraction data.
- Do not expose raw AI output, failed searches, missing-field prompts, or admin
  notes to homeowners.
- Record only light handover access metadata for builder records, such as the
  first time a client opens the published pack. Avoid page-by-page or item-level
  homeowner tracking.
- Record which provider processed the document and which fields were redacted
  or omitted.
- Add retention controls for raw uploads and temporary provider/cache files.
- Keep a privacy review checklist before enabling live production uploads.

### Async Builder Review

- Upload and processing must be asynchronous. Builders should be able to upload
  documents, leave the page, and come back later.
- Extraction jobs need durable statuses: uploaded, queued, processing,
  needs_review, partially_reviewed, package_ready, failed.
- Builder review progress should be saved per item.
- The review queue should support filters such as ready to accept, needs detail,
  search results ready, rejected, and package-ready.
- Builders should be able to resume from the project dashboard and see what is
  waiting for their decision.
- Failed jobs need retry/reprocess actions that do not create duplicate items.

### Multi-Unit Project Replication

- Builders need a way to duplicate one project into multiple units, townhouses,
  apartments, or lots.
- Replication should copy project products, specifications, client-visible
  documents, categories, supplier details, source links, warranty details, and
  care/maintenance information into each unit.
- Each duplicated unit must become independently editable after creation.
- Later edits in Unit 1 should not silently change Unit 2 unless the builder
  deliberately applies a bulk update.
- Replication can consume one project token/credit for the whole multi-unit
  setup, but usage metadata should still record how many units/lots were
  generated.
- Keep a parent/child relationship so the builder can see which units came from
  the same base template.

### Correct Item Storage

- Store extracted rows separately from approved handover records.
- Store global product identities separately from project-specific items.
- Store builder-supplied project-only facts as project records, not global
  reusable facts.
- Store manufacturer and supplier as separate fields. A product may be made by
  an overseas manufacturer but supplied locally by a merchant, distributor,
  importer, or trade supplier.
- Supplier records should support contact details, website links, quote files,
  supplier-specific warranty notes, supplier-specific maintenance notes, and
  source documents.
- Use stable identity fingerprints based on manufacturer, brand, model, product
  code, supplier SKU, source URL, and normalized description.
- Deduplicate repeated items across multiple uploads for the same project.
- Preserve source evidence: document id, page, section, snippet, extraction
  confidence, and review history.
- Every item should have an audit trail of who approved, edited, rejected, or
  marked it as builder-supplied.
- Builders must be able to edit any item after creation, especially when a
  variation changes product, finish, colour, model, supplier, quantity, or
  location.
- Store original extracted values and current edited values separately so the
  builder can see what changed from the source document.
- Store handover open records separately from document download records. The
  builder should see the first open date for the published pack, while document
  download history remains file-specific.

### Categorisation

- Every item should have a category for both builder review and homeowner
  display.
- Initial AI categories can include Kitchen, Joinery, Flooring, Roofing,
  Cladding, Electrical, Plumbing, Appliances, Fixtures, Landscaping, and
  General.
- Builders must be able to override the AI category.
- Store both the AI-suggested category and the builder-approved category so
  category changes are transparent.
- Homeowner views should group products/documents/maintenance by the approved
  category, not by raw extraction order.

### Quote-Based Item Extraction

- When a spec says something like "as per Kitchen Solutions quote", "as per
  joinery quote", or "TBC by supplier", the row should become a
  builder-input-needed item, not a web-search candidate.
- The builder should be able to upload the referenced quote, invoice, supplier
  schedule, or selection document against that item.
- LlamaCloud should parse the uploaded quote/document and extract the missing
  products, finishes, colours, supplier codes, quantities, warranty notes, and
  care details.
- Extracted quote items must be linked back to the original spec row and the
  original quote file for traceability.
- After quote extraction, run database matching again before any web/source
  search.
- The quote file should remain attached to the project and be optionally marked
  client-visible if appropriate.

### Warranty And Source Updates

- Warranty, manual, maintenance, and source documents must be versioned.
- Do not overwrite what was published to a homeowner without an explicit update
  action.
- Store source URL, domain, file hash, text hash, checked date, detected
  effective date, and review status.
- When a warranty/source changes, create a new source version and flag affected
  products/packages for admin or builder review.
- Published handover packages should remember the source version used at publish
  time.
- Add a later maintenance job that can periodically re-check important official
  source URLs and report changes.

### Care And Maintenance Documentation

- Every product/item should have care or maintenance information before it is
  published where practical.
- Prefer official manufacturer documentation first.
- If manufacturer documentation is unavailable, use supplier documentation.
- If no official or supplier documentation is found, the system may provide
  general AI-generated care guidance.
- General AI guidance must be clearly labelled as general guidance, not
  manufacturer-provided or warranty-backed instructions.
- Store the care guidance source type: manufacturer, supplier, builder-supplied,
  or general AI guidance.
- Builders should review and approve any general AI guidance before it appears
  to the homeowner.

### Cost Guardrails

- Never search the web for rows that still need builder context.
- Search once per unique source-ready identity unless an admin deliberately
  escalates.
- Cache source results and source gaps so repeated uploads do not spend again.
- Record search attempts, source PDF fetches, AI summarisation calls, retries,
  and estimated cost per job/project.
- Show builders simple progress and review counts, not raw token/search
  accounting.

## Next Implementation Steps

1. Replace deterministic `buildSpecificationProposals` with schema-backed
   extraction that consumes LlamaCloud markdown/text and returns
   `OutlineSpecExtraction`.
2. Normalize `OutlineSpecExtraction.Items[]` into durable extracted-item rows
   using `src/lib/ai/outline-spec-normalize.ts`.
3. Add durable async job state so builders can upload documents and return
   later to review results.
4. Add multi-unit replication data model fields and a project-duplicate action.
5. Add manufacturer/supplier-separated item storage and supplier records.
6. Add database identity matching before any source-search dispatch.
7. Update the review UI lanes:
   - ready to accept
   - needs detail
   - project documents
   - not handover
8. Add item edit history so original extracted values and builder-edited values
   are visible.
9. Add quote upload/extraction against builder-input-needed items, then re-run
   database matching on the extracted quote items.
10. Add category override and homeowner category grouping.
11. Add versioned product/source storage for warranty/manual/maintenance
   changes.
12. Add care/maintenance guidance source labelling and builder approval.
13. Add Cloudflare D1 schema for pipeline jobs, source candidates, idempotency,
   source cache index, and cost events.
14. Keep live source search disabled until builder clarification and re-match are
   working end to end.

## LlamaCloud References

- Parse getting started:
  https://developers.llamaindex.ai/llamaparse/parse/getting_started/
- Parse result expansion:
  https://developers.llamaindex.ai/llamaparse/parse/guides/retrieving-results/
- Extract overview:
  https://developers.llamaindex.ai/llamaparse/extract/
- Extract schema design:
  https://developers.llamaindex.ai/llamaparse/extract/guides/schema_design/
