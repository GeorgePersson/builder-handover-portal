# Technical Architecture Source Of Truth

This document is the working architecture source of truth for the Builder
Handover Portal. Other agents should use it before making backend, AI workflow,
storage, privacy, billing, or source-enrichment decisions.

## Decision

Use the settled hybrid SaaS architecture in
`docs/final-tech-stack-decision.md`:

- Next.js 16 remains the product application and UI layer.
- Vercel is the preferred host for the Next.js app.
- Supabase remains the system of record for users, organisations, projects,
  clients, review state, billing credits, audit logs, and published handover
  data.
- OpenAI powers extraction, matching assistance, source summarisation, and
  critic/review scoring when `OPENAI_API_KEY` is configured.
- Azure AI Content Understanding or Azure AI Document Intelligence can be added
  behind an adapter for PDF/document context extraction, grounding, confidence,
  and schema validation before any live source search.
- Cloudflare is the preferred future execution layer for long-running AI/source
  enrichment: Workflows for orchestration, Queues for batches, Durable Objects
  for per-upload/job coordination, D1 for pipeline SQL metadata/cache indexes,
  and R2 for temporary raw files or cached source PDFs.
- Stripe owns paid project-credit checkout and webhooks.
- Resend owns transactional email.
- A privacy-minimal "no raw document retention" mode can be explored later, but
  it should not replace the main product database.

Do not replace Supabase with Cloudflare D1 as the main product database as an
incidental pipeline change. Cloudflare database/cache primitives can support
pipeline SQL state, source cache indexes, idempotency, and job status, but app
state, auth, RLS, billing state, review state, and homeowner publication stay
in Supabase unless a deliberate database migration project is approved.

The proposed Azure/Cloudflare rework is documented in
`docs/azure-cloudflare-context-processing-architecture.md`. Use it when adding
Azure document/context processing, Cloudflare D1 pipeline tables, builder
clarification gates, or search-last source enrichment.

## Options Considered

### Supabase Only

Supabase-only is fastest for the current app because the schema, RLS, storage,
auth, project credits, and review workflows already exist. The weakness is that
large AI/source-enrichment jobs should not live inside one app request or one
short serverless function.

### Cloudflare Database Only

Cloudflare-only could work for a source cache or a serverless-first product, but
it would require rebuilding auth, relational permissions, billing state,
project/client relationships, admin reporting, and RLS-style access rules. It is
not the best next move for the current product.

### No Database

No-database mode is useful as a privacy experiment: upload a spec, process it,
return a handover package, and avoid persistent project data. It is not enough
for the main product because builders need project history, client access,
review trails, billing credits, and published handover records.

### Hybrid

Hybrid is the recommended path. Keep durable app state in Supabase and move
long-running extraction/enrichment into a durable serverless pipeline when the
workflow grows beyond local/Next.js request limits.

## Settled Stack

- Product app: Next.js 16, React, TypeScript, Tailwind, lucide-react.
- Product hosting: Vercel.
- Database/auth/storage: Supabase Postgres, Auth, RLS, Storage, and RPCs.
- Background pipeline: Cloudflare Workers, Queues, Durable Objects, D1, and R2.
- Document context extraction option: Azure AI Content Understanding or Azure
  AI Document Intelligence behind an adapter.
- AI: OpenAI Responses API with strict structured output.
- Payments: Stripe Checkout/webhooks.
- Email: Resend.
- Local development fallback: `.local-data/` JSON and `.local-uploads/`.

This split is intentional: Supabase owns the product truth and permissions;
Cloudflare owns long-running/cached pipeline work and pipeline SQL state; Azure
can own first-pass document readability/grounding when enabled; OpenAI is used
selectively after context-first filtering; Next.js owns the builder/admin/
homeowner product experience.

## Core Product Flow

1. Builder creates or opens a project.
2. The project page acts as a handover checklist dashboard. Each item tracks
   identity, care instructions, manuals, warranty information, invoice data, Code
   of Compliance information where relevant, uploaded supporting documents,
   notes, completion state, and audit trail.
3. Builder adds items manually, selects database suggestions, or uploads one or
   more project specs, quotes, invoices, manuals, warranties, supplier schedules,
   photos, or supporting documents to populate checklist candidates.
4. The app creates upload/document records and extraction jobs for uploaded
   documents.
5. Text is extracted from PDF, CSV, image, Word, or Excel input.
6. The document is converted into readable, grounded context. The preferred
   adapter may be the current local extractor, Docling local/VPS, Azure AI
   Document Intelligence layout, or Azure AI Content Understanding depending on
   file quality and feature flags.
7. AI/schema extraction extracts candidate products, documents, maintenance
   tasks, and source evidence into checklist items or checklist review
   candidates. The schema records document evidence, missing fields, builder info
   needed, and a classification for source readiness.
8. Known products are matched against the approved product identity cache before
   any internet search.
9. High-confidence known matches can autofill checklist fields but remain
   editable and reviewable. Ambiguous matches require builder selection; the app
   must not guess.
10. Low-confidence or vague items ask the builder for more context before any
    internet search. Clarified rows are matched against the database again.
11. Items without enough identity detail are marked `Not enough information to
    search` and prompt for brand/manufacturer/supplier/model/SKU/invoice/photo/
    document upload or manual entry.
12. Builder-supplied or unfindable items are stored as project-specific reviewed
    records and can become reusable/global knowledge only after admin review.
13. Optional official-source/web/PDF enrichment runs only for source-ready
    unknown identities after cache lookup, builder confirmation, and cost guards.
14. Builder/admin reviews source-enriched results before checklist completion,
    package inclusion, or global reuse.
15. Builder reviews unresolved items, uploads or enters missing care/manual/
    warranty/invoice/Code-of-Compliance information, or explicitly accepts
    incomplete with a paper trail.
16. Builder approves the final handover package.
17. Client sees only published homeowner-safe handover data.

## Data Ownership

Supabase stores:

- Users, organisations, memberships, projects, and clients.
- Uploaded document records and extraction job records.
- Extracted items, match results, review actions, handover items, and audit
  logs.
- Billing/project credit accounts and events.
- Canonical product identity records and source metadata.
- Published handover data.

Cloudflare stores or coordinates:

- Temporary raw files in R2 while AI processing runs.
- Cached official source PDFs in R2.
- Job coordination state in Durable Objects.
- Batch queue messages in Queues.
- Pipeline SQL metadata in D1: job status, idempotency keys, source candidates,
  source search results, source cache indexes, cost events, and optional product
  identity lookup mirrors.

Current implementation boundary:

- `cloudflare/handover-pipeline/` is a dry-run Worker/Queue/Durable Object/R2
  scaffold.
- Next.js dispatches source-ready identities to the Worker only when
  `CLOUDFLARE_PIPELINE_URL` is configured.
- The Worker is hard-coded dry-run and does not call OpenAI, web search,
  crawling, live source PDF downloads, or paid enrichment services.
- Cloudflare dispatch status is stored in extraction job usage metrics so local
  and Supabase app flows can show whether the background pipeline handoff
  happened.

OpenAI receives:

- Redacted extracted text or structured rows needed for extraction.
- Product identity candidates for matching/enrichment.
- Source text snippets/PDF text when summarising warranties or maintenance
  requirements.

OpenAI should not receive unnecessary client names, private contact details,
full addresses, or unrelated project notes.

The current extraction path applies a default redaction pass before text is sent
to OpenAI. It replaces obvious emails, phone numbers, likely street addresses,
and labelled client/homeowner references, then records replacement counts in
the extraction usage metrics. This is a guardrail, not a substitute for raw file
privacy, tenant isolation, or short retention.

## Privacy Model

The product should be privacy-minimal by default:

- Treat raw uploaded specs as sensitive project documents.
- Keep raw uploads private and tenant-scoped.
- Prefer short retention for temporary AI-processing copies.
- Redact or omit personal fields before AI/source-enrichment calls where
  practical.
- Track redaction counts so reviewers can see when sensitive-looking fields were
  removed before AI processing.
- Store reusable product facts separately from project/client data.
- Do not silently expose raw AI output to homeowners.
- Preserve source confidence, missing fields, and review reasons.
- Never claim guaranteed legal warranty compliance.

## Product Identity And SKU Model

Product storage should be identity-first:

- Store one global product identity once.
- Store project items as references to that identity.
- Use manufacturer, brand, model, supplier SKU, GTIN/barcode, source URL, and a
  normalized product fingerprint as identity evidence.
- Do not rely on SKU alone. Supplier SKUs, manufacturer models, aliases, finish
  variants, and discontinued products can conflict.

Recommended identity evidence order:

1. Manufacturer model number.
2. GTIN, EAN, UPC, or barcode if available.
3. Supplier SKU.
4. Official product URL.
5. Normalized fingerprint such as
   `manufacturer|product-family|model|category|variant`.

## Source And Warranty Model

Warranty, maintenance, manual, installation, and appraisal records should be
versioned source documents.

For each source, store:

- Original source URL.
- Source type.
- Source title.
- Source domain.
- Stored PDF/object path when retained.
- File/content hash.
- Extracted text hash.
- Product identity evidence.
- Effective date if detected.
- Last checked date.
- Confidence and review status.

Do not overwrite historical homeowner packages silently when a warranty source
changes. Published packages should keep the source version used at publish time
unless a builder/admin deliberately updates them.

## Source PDF Downloading

Use platform-native HTTP fetch for downloads:

- In Cloudflare Workflows/Workers, use `fetch(sourceUrl)` and write bytes to R2.
- In Next.js server routes/actions, use `fetch(sourceUrl)` and write bytes to
  Supabase Storage or R2.
- In local tooling, Node `fetch` is enough for direct PDF URLs.

The downloader should:

1. Start from trusted manufacturer or supplier domains.
2. Detect likely PDF links for warranty, manual, care guide, installation,
   datasheet, or appraisal documents.
3. Validate content type, size, domain, and product identity evidence.
4. Hash the PDF bytes and extracted text.
5. Avoid reprocessing unchanged files.
6. Return structured source records for admin review.

Current scaffold: `src/lib/server/source-pdf.ts` implements direct PDF fetch,
basic URL safety checks, size limits, PDF text extraction, byte/text hashing,
and structured source metadata. A guarded local debug route at
`POST /api/debug/source-pdf` can inspect a candidate source PDF when
`ENABLE_DEBUG_COST_TESTS=true`; see `docs/source-pdf-inspection-runbook.md`.

## AI And Search Workflow

The preferred durable pipeline is context-first and search-last:

```txt
Upload
-> extract readable document context with local/Azure adapter
-> strict handover schema extraction with grounding/confidence
-> classify rows by source readiness and builder input needed
-> dedupe by identity/fingerprint
-> approved database/source-cache lookup
-> builder accepts high-confidence known matches
-> builder adds context for low-confidence rows
-> database/source-cache lookup again for clarified rows
-> send only builder-confirmed source-ready unknowns to optional search/source batches
-> critic scoring
-> persist results
-> builder/admin review
```

Search depth should be capped:

- First pass: no search for rows that are not source-ready.
- Source-ready unknowns: one official-source search per unique identity.
- High confidence: stop and store source metadata.
- Medium confidence: mark `needs_review`.
- Low confidence: mark unresolved and avoid burning more credit automatically.
- Deep enrichment: only for package-critical items or admin/global approval.

`docs/context-first-extraction-and-source-gap-strategy.md` is the operating
guide for this approach. It treats "unfindable" items as builder/admin source
gaps, not extraction failures.

Active phase plan lives in `docs/implementation-phases.md`. Completed work is
compressed there, and active Cloudflare work starts at Phase 11.

## Billing And Cost Guardrails

Sell project-level processing credits, not visible AI token units.

Recommended product language:

- "Project Processing Credit"
- "Handover Build Credit"

A $150 project credit should allow multiple spec uploads for one project, with
usage metered internally by:

- Number of spec/document uploads.
- Extracted row count.
- Unique item count after dedupe.
- Enriched item count.
- Web/search call count.
- Deep enrichment attempts.
- Retry count.

Repeated items across specs should not consume full enrichment allowance twice.

The largest cost risk is not database storage. It is web search plus AI source
summarisation for unknown items. Large specs should dedupe first and enrich
only unique unknown identities.

Context-first extraction should reduce search spend because generic allowances,
supplier quote references, custom items, and incomplete identities become
builder-input-needed review rows instead of paid source-enrichment attempts.

## 100-Item Cost Test

Yes, a real 100-item cost test can be run if an OpenAI API key is available.
The key should be put in `.env.local` as `OPENAI_API_KEY`; do not paste secrets
into chat.

The test should measure:

- Upload parsing cost.
- Extraction model input/output tokens.
- Unique item count after dedupe.
- Cache hits.
- Unknown items.
- Search calls.
- Enrichment model input/output tokens.
- Retry count.
- Total elapsed time.
- Estimated cost per uploaded file, per extracted row, and per unique item.

For the first test, use a controlled 100-item spec sheet where expected items
are known. Run one pass with cache disabled and one pass with cache enabled so
the difference is visible.

The controlled fixture lives at
`docs/demo-assets/100-item-cost-test-spec.csv`; the repeatable runbook lives at
`docs/openai-100-item-cost-test-runbook.md`.

The current app has started this instrumentation: extracted workflow items carry
identity/fingerprint metadata, project extraction jobs show usage metrics in the
builder workspace, OpenAI token usage can be converted into estimated cost when
`OPENAI_EXTRACTION_INPUT_COST_PER_1M` and
`OPENAI_EXTRACTION_OUTPUT_COST_PER_1M` are set, and CSV-style/line-heavy specs
chunk into multiple extraction calls for controlled 100-item tests. Very long
prose/table-heavy PDFs may still need smarter section chunking after real-file
testing.
