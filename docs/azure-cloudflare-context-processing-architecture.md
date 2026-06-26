# Azure And Cloudflare Context Processing Architecture

This is the proposed rework architecture for the Builder Handover Portal.
It keeps the product direction spec-upload-first, but changes the expensive
workflow so database matching and builder clarification happen before live web
search.

## Decision

Use a staged context-processing pipeline:

```txt
Builder uploads spec PDF
-> extract readable document context
-> map document context into strict handover schemas
-> match high-confidence items against the approved item database
-> builder accepts/rejects high-confidence known matches
-> builder adds context for low-confidence or incomplete rows
-> re-run database match on clarified rows
-> queue only source-ready unknown items for internet/source search
-> builder/admin checks source-enriched information
-> approved items become project handover records
```

The expensive internet/source-search step must be last. The system should never
search the web for a vague row, ask whether it is correct, then search again
after the builder supplies details. Instead, the builder clarification loop
happens before search.

## Platform Shape

- Product app and portals: Next.js 16.
- Planning and delivery: Azure DevOps boards, repos, pipelines, and
  environment approvals.
- Document context extraction: Azure AI Content Understanding or Azure AI
  Document Intelligence layout, selected behind an adapter.
- App database: keep the existing Supabase path until a deliberate database
  migration is planned.
- Cloudflare SQL database: use D1 for pipeline metadata, source cache indexes,
  product-identity lookup mirrors, idempotency, and job status.
- Cloudflare runtime: Workers, Queues, Durable Objects, and R2 for long-running
  source processing and temporary/cached files.
- Source enrichment: live web/source search only for source-ready unknowns
  after builder clarification and database matching.

Do not move all product auth, billing, homeowner publication, and tenant
permissions to Cloudflare D1 as an incidental part of this rework. If the goal
is a full Cloudflare-first app database later, treat it as a separate migration
project with its own auth/RLS replacement plan.

## Azure Context Processing Checks

Before Azure Content Understanding is selected as the primary extractor, prove
these checks with real builder PDFs:

- File support: PDF, scanned PDF, image-only PDF, Word, Excel, and combined
  specification packs.
- Conversion path: whether the file can be sent directly, or must first be
  converted into a supported readable format.
- Layout quality: tables, schedules, section headings, page numbers, and
  source snippets must survive extraction.
- Grounding: extracted fields should keep page/region/snippet evidence so the
  builder can verify the item in context.
- Confidence: each schema field needs confidence or enough source evidence to
  decide high-confidence, low-confidence, or builder-input-needed.
- Segmentation: large specs should be split by section, schedule, or document
  type before schema extraction where Azure can do this reliably.
- Cost and latency: compare Azure extraction cost/time against the current
  local PDF/OCR/OpenAI path.
- Privacy: redact or omit client/homeowner personal details before any
  generative model call where practical.

Microsoft's current Content Understanding docs describe analyzers, custom field
schemas, confidence scores, grounding, segmentation, and contextualization.
Document Intelligence layout supports extracting text, tables, selection marks,
and document structure from PDFs, images, and Office formats. Use these
capabilities as the first pass before deciding whether another AI call is
needed.

References:

- https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/overview
- https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/layout?view=doc-intel-4.0.0
- https://developers.cloudflare.com/d1/
- https://developers.cloudflare.com/d1/worker-api/d1-database/

## Handover Schemas

Create explicit schemas for the document understanding layer. The first schema
should be conservative and designed for review rather than automatic
publication.

### Extracted Item

- `item_id`
- `upload_id`
- `project_id`
- `item_type`: `product`, `document`, `maintenance`, `allowance`,
  `admin_contract`, `not_handover_relevant`
- `category`
- `brand`
- `manufacturer`
- `product_name`
- `model`
- `sku`
- `supplier`
- `location`
- `quantity`
- `variant_or_finish`
- `warranty_text`
- `maintenance_text`
- `source_page`
- `source_snippet`
- `source_section`
- `field_confidence`
- `overall_confidence`
- `missing_fields`
- `builder_questions`
- `context_classification`
- `classification_reason`
- `normalized_identity_fingerprint`

### Review State

- `database_match_status`: `matched`, `possible_match`, `no_match`,
  `needs_more_context`
- `builder_review_status`: `pending`, `accepted`, `edited`, `rejected`,
  `context_requested`, `context_supplied`
- `source_search_status`: `not_eligible`, `queued`, `searched`, `matched`,
  `needs_review`, `unresolved`
- `global_reuse_status`: `project_only`, `admin_review`, `global_approved`
- `homeowner_visibility`: `hidden`, `package_ready`, `published`

### Source Candidate

- `identity_fingerprint`
- `search_query`
- `trusted_domains`
- `candidate_url`
- `source_type`
- `source_title`
- `source_domain`
- `source_confidence`
- `source_summary`
- `source_file_hash`
- `source_text_hash`
- `review_reason`

## Main Workflow

### 1. Upload And Normalize

The builder uploads a spec PDF or supporting document. The app creates an
upload record, stores the private raw file, and dispatches a context job.

The context job decides:

- Send directly to Azure Content Understanding.
- Send to Azure Document Intelligence layout first.
- Convert or OCR locally before Azure if the PDF is scanned, locked,
  malformed, or table-heavy.
- Reject and ask for a readable file if conversion cannot preserve enough
  evidence.

### 2. Extract Schema With Evidence

The extraction step produces structured rows plus page/section/snippet evidence.
It does not search the web. It classifies rows into:

- `source_ready`: enough identity to search if the database has no match.
- `builder_input_needed`: useful row, but missing brand/model/supplier/context.
- `project_document`: quote, invoice, certificate, plan, or supplied evidence.
- `generic_allowance`: allowance or provisional selection.
- `admin_contract`: not homeowner handover content by default.
- `not_handover_relevant`: exclude unless builder overrides.

### 3. Database Match First

Before asking the builder or searching the web, match every extracted row
against approved item records and source cache indexes.

High-confidence known matches:

- Mark as `matched`.
- Show source evidence and matched database item.
- Ask the builder to accept, edit, or reject.
- Do not send to internet search.

Possible matches:

- Show the candidate match and source snippet.
- Ask the builder to confirm or edit.
- Do not search until the builder resolves ambiguity.

No match but source-ready:

- Hold as a source-search candidate.
- Do not queue live search until builder confirms the row is a real required
  project item.

Low confidence or missing identity:

- Ask the builder for context first.
- Re-run database matching after context is supplied.
- Queue for search only if it remains unknown and becomes source-ready.

### 4. Builder Clarification Gate

Builder review should be fast and decision-oriented:

- Accept high-confidence database matches.
- Reject items that are not required.
- Add missing identity: brand, model, finish, supplier, quote, manual, photo,
  invoice, location, or warranty/care text.
- Mark project-only if the item is custom, trade-only, or not findable online.

This gate is the main cost control. It turns many vague source candidates into
known database matches, project-only builder-supplied items, or excluded rows
before the system spends money searching.

### 5. Source Search Last

Only queue source search when all of these are true:

- Builder has confirmed the item belongs in the handover.
- The database and source cache have no approved match.
- The item has enough identity to search once.
- The project has remaining search budget.
- The row is not a generic allowance, supplier quote placeholder, or
  admin/contract-only line.

Search output returns to review. It does not auto-publish to homeowners.

### 6. Builder/Admin Source Check

After internet/source enrichment:

- High-confidence official source: builder can approve for the project.
- Medium-confidence source: builder/admin review required.
- Low-confidence or no official source: builder can supply project-specific
  evidence or mark as unresolved/excluded.
- Admin decides whether the sourced item becomes globally reusable.

## Cloudflare D1 Role

Cloudflare D1 should store SQL data that belongs to the pipeline, not
homeowner-facing product truth at first:

- `pipeline_jobs`
- `pipeline_job_events`
- `context_segments`
- `identity_lookup_cache`
- `source_search_candidates`
- `source_search_results`
- `source_cache_index`
- `idempotency_keys`
- `cost_meter_events`

D1 is a good fit for Worker-side SQL because Cloudflare documents it as a
serverless SQLite-compatible database accessed through Worker bindings. Use D1
prepared statements and bindings for all Worker reads/writes.

Keep private raw uploads and cached source PDFs in R2, not D1.

## Azure DevOps Delivery Model

Use Azure DevOps to control the rebuild as separate epics:

1. Architecture and schema contracts.
2. Azure document/context adapter spike.
3. Cloudflare D1 pipeline schema and Worker bindings.
4. Context extraction job orchestration.
5. Database-first matching and builder clarification UI.
6. Search-last source enrichment pilot.
7. Source review and admin global approval.
8. Cost, privacy, and audit hardening.

Each pull request should include:

- Schema contract changes.
- Test fixture or sample spec.
- Cost/latency notes.
- Privacy notes.
- Rollback path.

## Implementation Phases

### Phase A: Prove Azure Extraction

- Add an `azure-context` adapter behind a feature flag.
- Test direct PDF, scanned PDF, image-only PDF, and table-heavy spec files.
- Compare Azure layout/grounding against the current extractor.
- Store the raw Azure response only in private/debug storage.
- Normalize output into the existing context schema.

Exit: the app can show grounded schema rows from an Azure-processed spec.

### Phase B: Define Cloudflare D1 Pipeline SQL

- Add D1 schema for jobs, candidates, source cache, cost events, and
  idempotency.
- Keep Supabase/local app persistence unchanged.
- Mirror only pipeline-safe data into D1.

Exit: a Worker can create/read/update pipeline jobs in D1 with prepared
statements.

### Phase C: Database Match And Builder Accept Gate

- Match extracted rows against approved products before search.
- Show high-confidence known items to the builder for acceptance.
- Show possible matches separately from low-confidence items.

Exit: high-confidence known database items can become package-ready without
source search.

### Phase D: Low-Confidence Clarification Loop

- Ask builder for missing identity/context.
- Persist builder-supplied context and evidence.
- Re-run database matching after context changes.

Exit: clarified rows either match the database, become project-only, or become
source-ready unknowns.

### Phase E: Search-Last Pilot

- Queue only source-ready unknowns.
- Enforce one-search-per-identity caps.
- Store source results and cost events.
- Send source-enriched results back to builder/admin review.

Exit: the system can enrich a small capped batch without repeat searching or
auto-publishing.

## Non-Negotiables

- Do not search the web before database matching and builder clarification.
- Do not publish unresolved or raw AI rows to homeowners.
- Do not globally approve builder-supplied project-only facts automatically.
- Do not store raw project PDFs in D1.
- Do not spend on repeat source searches for the same unresolved identity.
- Do not hide missing fields, confidence, source evidence, or review reasons.
