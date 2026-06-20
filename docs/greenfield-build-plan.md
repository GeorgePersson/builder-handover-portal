# Greenfield Build Plan

This is the clean-start plan for building the next version of the Builder
Handover Portal with a concrete stack and a cost-controlled workflow.

## Product Goal

Build a builder-facing handover system where the builder uploads project specs,
the system extracts homeowner-relevant products/documents/maintenance items,
checks known database matches first, asks the builder for missing context before
expensive source search, and publishes only reviewed, homeowner-safe handover
records.

The core product promise is not "AI finds everything online." The promise is:

```txt
Upload the project spec
-> extract grounded handover candidates
-> accept known matches quickly
-> clarify uncertain rows before spending on search
-> source-check only confirmed unknowns
-> publish a clean homeowner handover package
```

## Locked Stack

### Product App

- Framework: Next.js 16 App Router.
- Language: TypeScript.
- UI: React, Tailwind CSS, lucide-react.
- Hosting: Vercel.
- Frontend style: clean operational workspace, not a marketing-style app.

Why: the existing app is already built this way, and it is the fastest route to
a polished builder/admin/homeowner product.

### Primary Product Database

- Supabase Postgres.
- Supabase Auth.
- Supabase Storage for tenant-scoped uploaded specs and homeowner-visible
  documents.
- Supabase RLS for organisation/project/client access.

Why: this product needs relational permissions, auth, audit trails, project
history, client access, billing state, and published handover records. Supabase
continues to own product truth.

### Document Context Processing

- LlamaCloud Parse for first-pass document readability: scans, tables, charts,
  layout-aware OCR, markdown, text, and JSON-style parse output.
- LlamaExtract for custom schema-backed extraction once the outline-spec schema
  stabilises against real builder PDFs.
- Local fallback: current PDF/OCR extraction path for development, unsupported
  inputs, and failover.

Why: LlamaCloud is shaped around LLM document pipelines and is a strong match
for messy builder specifications. Keep it behind an adapter so Azure Document
Intelligence or another parser can be tested later without rewriting the
product workflow.

### AI Reasoning And Structured Output

- OpenAI Responses API for schema normalization, classification, matching
  assistance, source summarisation, and review/critic scoring.
- Use strict JSON schemas for every AI output.
- Do not use AI output directly as homeowner-visible truth.

Why: OpenAI is strongest after the document is already readable and scoped. It
should classify, normalize, and summarize, not blindly crawl every row.

### Background Pipeline

- Cloudflare Workers as pipeline API/runtime.
- Cloudflare Queues for batches of source-ready candidates.
- Cloudflare Durable Objects for per-upload/per-job coordination.
- Cloudflare D1 for pipeline SQL metadata, idempotency, source candidate
  indexes, source results, cache indexes, and cost events.
- Cloudflare R2 for temporary processing files and cached source PDFs.

Why: source enrichment is long-running, bursty, and retry-prone. It should not
live inside a single Next.js request.

### Project Management And Delivery

- Azure DevOps Boards for epics/stories/tasks.
- Azure Repos or GitHub can host code, but choose one before implementation.
- Azure Pipelines for CI/CD orchestration if Azure Repos is used.
- Azure DevOps Environments and approvals for staging/production gates.

Recommendation: keep GitHub if the repo already lives there and use Azure
DevOps Boards only for planning. Move repos/pipelines to Azure DevOps only if
the team wants Microsoft-native delivery end to end.

### Payments And Email

- Stripe for project credits and invoices.
- Resend for transactional email: client invites, package sent, admin alerts.

## Hard Product Rules

- Spec upload is the primary builder workflow.
- Manual product creation is not the main path.
- Database matching happens before internet/source search.
- Builder clarification happens before internet/source search.
- Internet/source search runs only for builder-confirmed, source-ready,
  unknown items.
- Known high-confidence database matches never burn search budget.
- Low-confidence rows must not trigger search until the builder adds enough
  identity/context.
- Search results never auto-publish.
- Builder-supplied project-only facts never become global product records
  without admin approval.
- Homeowners never see raw AI output, unresolved rows, missing-field prompts, or
  admin review metadata.
- Raw project PDFs are private and tenant-scoped.
- Cloudflare D1 stores pipeline state, not primary product truth.

## Core Data Model

### Supabase Product Tables

- `organisations`
- `memberships`
- `projects`
- `project_units`
- `project_replication_batches`
- `clients`
- `uploaded_documents`
- `extraction_jobs`
- `extracted_items`
- `extracted_item_value_history`
- `item_matches`
- `item_review_actions`
- `handover_items`
- `product_identities`
- `product_versions`
- `suppliers`
- `supplier_documents`
- `source_documents`
- `source_assertions`
- `care_guidance_versions`
- `billing_credit_accounts`
- `billing_credit_events`
- `audit_logs`

### Cloudflare D1 Pipeline Tables

- `pipeline_jobs`
- `pipeline_job_events`
- `context_segments`
- `source_search_candidates`
- `source_search_results`
- `source_cache_index`
- `identity_lookup_cache`
- `idempotency_keys`
- `cost_meter_events`

### R2 Buckets

- `handover-temp-processing`
- `handover-source-cache`

### Supabase Storage Buckets

- `handover-documents`

## Workflow

### 1. Upload

The builder selects a project and uploads a spec PDF or supporting document.
The app creates:

- Supabase `uploaded_documents` row.
- Supabase `extraction_jobs` row.
- Private file in Supabase Storage.
- Optional temporary copy/reference for pipeline processing.

### 2. Context Extraction

The app or pipeline runs a document adapter:

```txt
try LlamaCloud Parse
-> if schema extraction is ready, run LlamaExtract with the outline-spec schema
-> if LlamaCloud fails or file is unsupported, use local PDF/OCR fallback
-> normalize everything into one internal context schema
```

The normalized context must preserve:

- Page number.
- Section heading.
- Table row/cell context.
- Source snippet.
- Confidence where available.
- Extraction warnings.
- Whether OCR/conversion was needed.

### 3. Handover Schema Extraction

Extract candidate rows into this strict shape:

- `itemType`
- `category`
- `brand`
- `manufacturer`
- `productName`
- `model`
- `sku`
- `supplier`
- `location`
- `quantity`
- `variantOrFinish`
- `warrantyText`
- `maintenanceText`
- `sourcePage`
- `sourceSection`
- `sourceSnippet`
- `fieldConfidence`
- `overallConfidence`
- `missingFields`
- `builderQuestions`
- `contextClassification`
- `classificationReason`
- `identityFingerprint`

Classifications:

- `known_match_candidate`
- `source_ready_unknown`
- `builder_input_needed`
- `project_document`
- `generic_allowance`
- `admin_or_contract`
- `not_handover_relevant`

### 4. Database Match First

For every row:

1. Normalize identity fingerprint.
2. Search `product_identities`, `product_versions`, and `source_documents`.
3. Check Cloudflare `identity_lookup_cache` if enabled.
4. Return `matched`, `possible_match`, `no_match`, or `needs_more_context`.

High-confidence known matches:

- Show matched item and document evidence.
- Builder can accept, edit, or reject.
- No web search.

Possible matches:

- Builder confirms the match or edits identity fields.
- No web search until resolved.

No match but source-ready:

- Hold for builder confirmation before source search.

Needs more context:

- Ask builder for specific missing details.

Supplier-specific handling:

- Keep manufacturer and supplier separate during matching.
- Match manufacturer/product identity first.
- Attach local supplier details separately when available.
- A supplier quote or supplier SKU can improve the match, but it should not
  replace manufacturer model/code evidence.

### 5. Builder Clarification

The builder review screen is split into lanes:

- `Ready to accept`: high-confidence database matches.
- `Needs detail`: low-confidence rows needing brand/model/supplier/context.
- `Project documents`: quotes, invoices, certificates, photos, manuals.
- `Not handover`: admin/contract/general spec rows suggested for exclusion.
- `Search results ready`: confirmed unknowns that have returned source results.

Builder actions:

- Accept for project.
- Edit identity/details.
- Edit product variation fields such as finish, colour, model, supplier,
  quantity, and location.
- Add quote/manual/photo/invoice.
- Mark project-only builder supplied.
- Reject/exclude.
- Override AI category.

After builder edits a low-confidence row, the system re-runs database matching.
Only if it remains unknown and becomes source-ready can it enter search.

Original extracted values and builder-edited values must both be stored so the
builder can see what changed.

### 5A. Quote-Based Extraction

If a spec references another document, such as "as per Kitchen Solutions quote",
the system should:

1. Keep the original row as `builder_input_needed`.
2. Ask the builder to upload the quote or supplier document.
3. Run LlamaCloud Parse and schema extraction on the uploaded quote.
4. Link extracted quote items back to the original spec row.
5. Run database matching again on the quote-extracted items.
6. Queue only builder-confirmed source-ready unknowns for later search.

The original quote remains attached for traceability and may be marked
client-visible if the builder wants it in the handover pack.

### 6. Search Last

A row can enter source search only if:

- Builder confirmed it belongs in the handover.
- It has enough identity to search.
- Database/cache lookup did not find a usable match.
- It is not a generic allowance or supplier-quote placeholder.
- The project has remaining search budget.
- The row has not already been searched with the same identity fingerprint.

Search job output:

- Candidate official URLs.
- Source type.
- Source confidence.
- Warranty/care/manual findings.
- Missing fields.
- Review reason.
- Hashes for downloaded/cached source PDFs.

### 7. Source Review

Builder/admin review source-enriched rows:

- Approve for project.
- Request builder evidence.
- Mark source unresolved.
- Reject source.
- Promote to global product database, admin only.

Care guidance:

- Use official manufacturer care/maintenance documentation when found.
- Use supplier documentation when manufacturer documentation is unavailable.
- If no official or supplier source is found, create general AI care guidance
  only after builder review.
- Label guidance source as manufacturer, supplier, builder-supplied, or general
  AI guidance.

### 8. Publish

Only package-ready records can publish:

- Accepted known database matches.
- Builder-approved project-only records.
- Admin-approved/global records.
- Source-reviewed project records.
- Project documents marked homeowner-visible.
- Care/maintenance guidance approved by the builder.

Homeowner portal reads only published `handover_items`, never raw extracted
items.

Homeowner product views should be grouped by approved category, such as Kitchen,
Joinery, Flooring, Roofing, Cladding, Electrical, Plumbing, Appliances,
Fixtures, Landscaping, and General.

## Multi-Unit Project Replication

Builders should be able to duplicate a base project into multiple units or
lots. The duplicated units should copy:

- Products and approved item records.
- Specifications and extracted context.
- Client-visible documents.
- Categories.
- Supplier details and supplier documents.
- Warranty, manual, source, care, and maintenance information.

Each unit must be independently editable after replication. Bulk updates can be
added later, but independent editing is the default. The system should keep a
parent project/template reference and a replication batch record so builders can
see which units came from the same base project.

Multi-unit replication can consume one project token/credit for the replication
batch, while still recording how many units/lots were created.

## UI Surfaces

### Builder

- Dashboard.
- Projects.
- Upload spec.
- Extraction/job progress.
- Review lanes.
- Handover package preview.
- Send package.
- Client invite/manage.

### Admin

- Global product database.
- Source review.
- Builder-supplied/source-gap review.
- Cost and job monitoring.
- Failed job recovery.
- Billing support.

### Homeowner

- Published handover overview.
- Products.
- Documents.
- Maintenance tasks.
- Download history.
- Request missing item.

## Phase Plan

### Phase 0: Clean Architecture Baseline

Deliverables:

- Lock this stack.
- Freeze old alternative architecture debates.
- Define schema contracts.
- Create Azure DevOps backlog epics.
- Decide GitHub vs Azure Repos for source hosting.

Exit:

- One source-of-truth plan.
- One stack.
- One build order.

### Phase 1: Data Model And Local Skeleton

Deliverables:

- Supabase schema migration for core product tables.
- Project unit and replication batch tables.
- Supplier and supplier document tables.
- Extracted item value history for original vs edited values.
- Category model and category override fields.
- Versioned source/care guidance tables.
- Local scaffold mode retained only for demos.
- Seed project, builder, and product database records.
- Typed data access layer.

Exit:

- App can create project/upload/job rows locally and in Supabase.

### Phase 2: Upload And Document Context Adapter

Deliverables:

- Upload UI.
- Document adapter interface.
- LlamaCloud Parse spike.
- Local PDF/OCR fallback.
- Normalized context JSON.
- Context diagnostics visible to builder.

Exit:

- A real spec PDF produces markdown/text context suitable for schema-backed
  extraction.

### Phase 3: Strict Extraction Schema

Deliverables:

- Handover extraction schema.
- Classification schema.
- Category suggestion.
- Supplier extraction separate from manufacturer extraction.
- Quote-reference detection.
- Missing-field and builder-question generation.
- Grounded evidence storage.
- Redaction before model calls.

Exit:

- Upload produces reviewable candidate rows with evidence and classifications.

### Phase 4: Database Matching

Deliverables:

- Identity fingerprinting.
- Product/source lookup.
- Match confidence.
- Match reasons.
- Cache lookup path.

Exit:

- Known products are matched before search and shown to builder.

### Phase 5: Builder Review And Clarification

Deliverables:

- Four-lane builder review UI.
- Accept/edit/reject/context actions.
- Project-only builder-supplied state.
- Editable product variation fields.
- Original extracted values vs builder-edited values.
- Category override.
- Supplier override and supplier detail attachment.
- Re-match after edit.

Exit:

- Low-confidence rows cannot reach search until builder context is supplied.

### Phase 5A: Quote Upload And Linked Extraction

Deliverables:

- Upload quote/invoice/supplier schedule against an extracted item.
- LlamaCloud parse/extract for the quote document.
- Link quote-extracted products back to the original spec row.
- Store quote document traceability.
- Re-run database matching after quote extraction.

Exit:

- "As per quote" items can be resolved from uploaded supplier quotes before
  source search.

### Phase 5B: Multi-Unit Replication

Deliverables:

- Duplicate a base project into multiple units/lots.
- Copy products, documents, categories, suppliers, warranty/source/care data,
  and maintenance items.
- Record replication batch and parent/template relationship.
- Allow each duplicated unit to be edited independently.

Exit:

- Builder can create a multi-unit project batch and edit each unit separately.

### Phase 6: Cloudflare Pipeline Dry Run

Deliverables:

- Worker API.
- Queue batches.
- Durable Object job coordinator.
- D1 pipeline tables.
- R2 temporary/cache buckets.
- Supabase job progress sync.

Exit:

- Source-ready unknowns can be queued and tracked without live search.

### Phase 7: Search-Last Live Pilot

Deliverables:

- Feature-gated live source search.
- One-search-per-identity cap.
- Official-source preference.
- PDF fetch/cache.
- Cost events.
- Source review queue.
- Manufacturer/supplier source preference.
- Care guidance generation with source labels.

Exit:

- A small capped batch can be searched, reviewed, and approved without
  repeat-search loops.
- Products have reviewed care/maintenance guidance or a clear missing-care
  status before publish.

### Phase 8: Handover Publish

Deliverables:

- Package-ready rules.
- Final builder approval.
- Homeowner portal.
- Client invites.
- Document signed URLs.
- Category-grouped homeowner product view.
- First-open tracking for builder records.

Exit:

- Builder can send a reviewed package and homeowner sees only approved data.

### Phase 9: Billing And Production Hardening

Deliverables:

- Stripe project credits.
- Usage meter.
- Cost caps.
- Retry/dead-letter recovery.
- Audit logs.
- Retention controls.
- Admin monitoring.

Exit:

- System is measurable, recoverable, cost-guarded, and ready for paid pilots.

## First Build Sprint

Do these first:

1. Create Azure DevOps epics from the phase plan.
2. Decide GitHub vs Azure Repos.
3. Keep Supabase as product DB.
4. Add the document adapter interface.
5. Implement LlamaCloud Parse behind the document adapter.
6. Normalize LlamaCloud/local extraction into one context shape.
7. Build the strict extraction schema around real builder PDFs.
8. Build database matching before any source search.
9. Build builder clarification before any source search.
10. Add quote upload/extraction before live source search.
11. Add supplier/category/edit-history foundations before homeowner polish.

Do not start with:

- Full Cloudflare migration.
- Live web search.
- Full LlamaExtract automation before the schema is proven on real specs.
- Homeowner polish before builder review works.
- Stripe before usage is measurable.

## External References Checked

- LlamaCloud Parse:
  https://developers.llamaindex.ai/llamaparse/parse/getting_started/
- LlamaExtract schema design:
  https://developers.llamaindex.ai/llamaparse/extract/guides/schema_design/
- Cloudflare storage/database options:
  https://developers.cloudflare.com/workers/platform/storage-options/
- Cloudflare Durable Objects:
  https://developers.cloudflare.com/durable-objects/
- Azure DevOps environments:
  https://learn.microsoft.com/en-us/azure/devops/pipelines/process/environments?view=azure-devops
- Azure DevOps approvals/checks:
  https://learn.microsoft.com/en-us/azure/devops/pipelines/process/approvals?view=azure-devops
