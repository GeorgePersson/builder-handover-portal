# Builder Handover Portal Handoff

## Current Status

Built a fresh Next.js 16 / TypeScript / Tailwind app for the Builder Handover
Portal. The product is now split into three route-level portals:

- Platform admin: `/admin`
- Builder company portal: `/builder`
- Client/homeowner portal: `/client/portal`

The main product direction is now:

Builder uploads a specification PDF -> AI/local extractor proposes products,
documents, and maintenance tasks -> known matches are auto-approved -> new or
uncertain items go to admin review and optional project-only builder approval ->
package-ready items form the handover preview -> builder publishes to homeowner
portal.

Current approval model:

- Existing database matches with strong confidence become `auto_approved` and
  can flow into the project package with minimal builder effort.
- New or uncertain items become `admin_review`.
- Builders can approve new/uncertain items for that project only; this sets
  `builder_approved` and does not promote the item into the global product
  database.
- Platform admin can approve an item globally from `/admin/review`; this sets
  `global_approved` and is the path for adding reusable records to the product
  database.

The app currently runs with seed data plus local scaffold persistence when
Supabase is not configured.

Clean-start planning update: `docs/greenfield-build-plan.md` is now the first
document to read before beginning the rebuild. It locks the concrete stack and
build sequence: Next.js 16/Vercel product app, Supabase product database/auth/
storage/RLS, LlamaCloud document context/schema processing, OpenAI structured reasoning,
Cloudflare Workers/Queues/Durable Objects/D1/R2 for pipeline work, Stripe,
Resend, and optional Azure DevOps planning/delivery. The core workflow is
database match first, builder clarification second, source search last.

LlamaCloud rebuild branch update: active rebuild branch is
`codex/llamacloud-greenfield`. The clean-start plan now uses LlamaCloud Parse
and LlamaExtract as the document context/schema layer, with local PDF/OCR as
fallback. The first backend slice added the outline-spec schema contract at
`src/lib/extraction/outline-spec-schema.ts`, a LlamaCloud REST parse client at
`src/lib/server/llamacloud.ts`, a provider selector at
`src/lib/server/document-context.ts`, and rewired PDF preview/process endpoints
to use LlamaCloud when configured while preserving the existing builder UI flow.
See `docs/llamacloud-greenfield-implementation.md`.

Workflow anchor: the LlamaCloud-backed flow is the preferred current path when
configured, while the document-context provider boundary still allows local or
future Azure processing. Builders upload specs/supporting documents, processing
can happen asynchronously, builders can return later to approve/edit/reject/add context, known database
matches are handled before search, unclear rows ask for builder context before
search, clarified rows are matched again, and only builder-confirmed
source-ready unknowns go to web/source search. Privacy, durable review state,
correct item storage, and versioned warranty/manual/source records are part of
the baseline requirements, not later polish.

Builder records update: client portal opens now create a lightweight
`handover_open_events` record for published packages. Builders can see the first
open date and total open count in the project workspace, separate from
file-specific document downloads. Existing Supabase projects should run
`docs/supabase-add-handover-open-events.sql`.

Feature backlog update: the anchored workflow now includes multi-unit project
replication, editable product variations, separate manufacturer/supplier
storage, supplier management, quote-based extraction, category override/grouped
homeowner views, and care/maintenance documentation. These are placed before
live source search where they affect item identity: collect all spec/quote/
supplier information first, database-match, builder clarify/edit, re-match,
then search only confirmed source-ready unknowns.

Backend data-model slice update: the LlamaCloud/backend workflow now has
schema/type scaffolding for multi-unit replication, supplier records distinct
from manufacturers, quote-linked uploaded documents and extracted items,
original extracted values vs builder-edited values, AI category vs builder
approved category, care guidance source labels, and versioned source/warranty/
manual/care references. The Supabase full schema and
`docs/supabase-add-document-workflow-phase1.sql` include the upgrade path; the
runtime insert path writes rich columns when present and falls back to the
legacy columns plus `raw_extracted_data` when older Supabase schemas are still
in use. Local scaffold mode carries the richer fields and records edit-history
snapshots in `.local-data/uploaded-documents.json`.

Async extraction workflow update: upload/extraction jobs now use durable states
for `uploaded`, `processing`, `needs_review`, `partially_reviewed`,
`package_ready`, and `failed` in both Supabase and local scaffold mode. OpenAI
schema extraction now uses the repo-owned outline-spec JSON schema and
normalizes `Items[]` into durable workflow rows with source page/section/snippet
evidence, original extracted values, quote-reference status, supplier fields,
and AI/builder category fields. PDF processing goes through the document context
adapter so LlamaCloud can provide context when configured and local PDF/OCR
remains the fallback. Quote/invoice/supplier-schedule uploads are linked to the
parent extracted item, recorded as supplier documents where the schema exists,
extracted into child rows, and database-matched again before any source search.
Builder edits now trigger a re-match while preserving the builder's review
decision, and local retry/reprocess replaces rows for the same extraction job so
duplicates are not created.

## Working Local URLs

- Dashboard: `http://127.0.0.1:3000`
- Platform admin portal: `http://127.0.0.1:3000/admin`
- Builder portal: `http://127.0.0.1:3000/builder`
- Specification upload/extraction: `http://127.0.0.1:3000/builder/specifications/new`
- Specification review queue: `http://127.0.0.1:3000/builder/specifications/review`
- Handover package preview: `http://127.0.0.1:3000/builder/handover-package`
- Client portal preview: `http://127.0.0.1:3000/client/portal`
- Client missing item request: `http://127.0.0.1:3000/client/request-product`

## Implemented

- Phase 0 scaffold and dependencies.
- Supabase browser/server client helpers and `.env.example`.
- MVP schema/RLS draft in `docs/supabase-schema.sql`.
- Supabase bootstrap script in `docs/supabase-bootstrap.sql` for creating the
  first builder organisation, membership, demo project, and client after the
  first magic-link sign-in.
- Role helper scaffold in `src/lib/auth/roles.ts`.
- Portal switchboard at `/`.
- Platform admin portal at `/admin` with operator metrics, builder activity,
  and AI approval queue entry point.
- Admin AI approval queue at `/admin/review` for low-confidence product records
  and extracted items.
- Extraction save/process paths now classify matched high-confidence items as
  `auto_approved` and new/uncertain items as `admin_review`.
- Builder approval now means project-scoped approval only (`builder_approved`).
  It no longer promotes new products into the global product database.
- Admin approval action promotes extracted items globally (`global_approved`)
  and creates reusable product records in Supabase mode.
- Local scaffold mode now mirrors global approval too: approving a product
  globally writes a reusable product record to
  `.local-data/global-products.json`.
- Global approval now runs through a source-enrichment scaffold in
  `src/lib/ai/source-enrichment.ts`. Known seed-style products can carry
  official source metadata; unknown admin-approved products stay marked
  `needs_review` with missing source/warranty/maintenance fields instead of
  being treated as fully source-backed.
- Admin global product library at `/admin/products`, linked from the admin
  sidebar and dashboard.
- `/admin/products` now shows review reasons, source counts, and missing fields
  so the admin portal acts like the source-enrichment dashboard. Products with
  captured sources show source links directly in the table.
- Local client-request status reconciliation now detects linked extracted items
  even for older converted requests that predate `sourceClientRequestId`.
- Builder dashboard at `/builder`.
- Dashboard now uses the same shared route-based sidebar as the builder/client
  pages, so the left nav links open real app routes instead of stale hash
  targets.
- Dashboard header and section actions now link to real create/upload/review
  pages instead of inert buttons.
- Shared builder sidebar layout and client portal layout.
- Shared admin sidebar layout.
- Builder pages at `/builder/projects`, `/builder/documents`,
  `/builder/products`, and `/builder/maintenance`.
- Builder product library no longer presents manual product creation as a main
  CTA. Builders are directed to upload specifications; admin/global approval is
  the path for reusable product records.
- Builder sidebar now labels the approval surface as `Project Approvals` and
  points to `/builder/specifications/review`.
- Builder form routes at `/builder/projects/new`, `/builder/documents/new`,
  `/builder/products/new`, and `/builder/maintenance/new`.
- Specification PDF intake workflow at `/builder/specifications`,
  `/builder/specifications/new`, and `/builder/specifications/review`.
- Client preview at `/client/portal`.
- Client missing-item request scaffold at `/client/request-product`. This is a
  client-safe request form, not direct product creation.
- Client missing-item requests now persist locally in
  `.local-data/client-requests.json` and are Supabase-ready through the
  `client_requests` schema.
- `/admin/review` now includes a dedicated client request queue alongside
  product records and extracted specification items.
- Admin can send a client missing-item request into the AI/admin review pipeline.
  Local mode creates a synthetic specification upload plus an `admin_review`
  extracted item, and marks the request `ai_checking`.
- Converted client requests now keep a source link on the extracted item. When
  admin globally approves a linked item, the originating client request is set
  to `global_approved`.
- Admin review now supports reject/close paths for both extracted review items
  and raw client requests. Rejecting a linked extracted item also rejects the
  originating client request.
- AI product draft contract at `POST /api/ai/product-draft`.
- `POST /api/ai/product-draft` now runs through the same deterministic
  source-enrichment scaffold as admin global approval. Known products can return
  source-backed warranty/maintenance drafts; vague items remain blocked with
  missing-field guidance until more identity detail is supplied.
- AI specification extraction contract at `POST /api/ai/spec-extract`.
- Product form has a live AI draft button that calls the endpoint and shows the
  draft confidence result, source links, warranty/maintenance draft fields, and
  missing fields.
- Specification intake has seed data and schema for proposed products,
  documents, and maintenance tasks extracted from a PDF.
- Specification review Approve-for-project/Reject buttons are wired to server
  actions. In local scaffold mode they redirect with a status banner; with
  Supabase configured they update `extracted_handover_items.status`.
- Specification review now includes review/accepted/rejected metrics, an empty
  state, and direct links back to specification upload and handover preview.
- Specification upload action now validates PDF uploads, saves them locally in
  `.local-uploads/` during scaffold mode, and uploads to Supabase Storage bucket
  `handover-documents` when configured.
- `/builder/specifications/new` includes a local extraction preview. Paste spec
  text and it calls `POST /api/ai/spec-extract` to generate proposed package
  items.
- `/builder/specifications/new` now makes the PDF-to-review flow the primary
  path: choose project, select PDF, process to review. Pasted-text demos and
  manual upload registration are collapsed as secondary fallbacks.
- The combined PDF process UI has been polished so the main panel is a one-step
  project/PDF/process flow with selected-file state and pipeline steps. Preview
  and pasted-text tools now live under advanced fallback controls, and the
  separate send-to-review action only appears for preview results.
- The PDF intake panel now shows operation-specific progress states for
  processing, previewing, and saving, plus a source-quality verdict from the
  extraction diagnostics so sparse/scanned PDFs are flagged before review.
- `/builder/specifications/new` can also preview from a selected PDF using
  `POST /api/specifications/extract-pdf`. This route parses PDF text locally
  with `pdf-parse`, then runs the shared proposal logic.
- PDF extraction now preserves per-page text, detects grid-based tables where
  available, appends normalized table text into the extraction input, chunks
  long extracted content for future AI calls, and returns extraction diagnostics
  to the upload UI.
- PDF extraction now includes a bounded OCR fallback for sparse/image-only
  pages using `tesseract.js`. It renders up to three sparse pages as screenshots,
  appends OCR text into the extraction input, reports OCR page/character counts,
  and leaves warnings when OCR is skipped, capped, or unable to recover text.
- PDF preview/process endpoints now share
  `src/lib/server/specification-response.ts` so file metadata, extraction
  diagnostics, OCR counts, summary notes, and proposed items stay consistent.
- PDF table extraction now also infers simple table-like text sections when
  a schedule header and repeated rows are present without drawn grid lines.
- `POST /api/specifications/process-pdf` now combines the main flow: upload PDF,
  parse text, save the file, generate proposals, and send proposals to the review
  queue in one request.
- Extraction previews can now be sent to the review queue through
  `POST /api/specifications/save-extraction`. In local scaffold mode this writes
  to `.local-data/specification-extractions.json`; in Supabase mode it creates
  `specification_uploads` and `extracted_handover_items` records.
- The review queue reads local saved extraction rows before the seed examples.
- Local accept/reject now persists item status in the local JSON store.
- `/builder/handover-package` shows a generated package preview from
  package-ready extracted items, grouped into products, documents, and
  maintenance.
- Extracted items can be edited before acceptance at
  `/builder/specifications/review/[itemId]/edit`.
- Extracted item editing now has validation-oriented controls for item type,
  category, confidence bounds, source page, and source snippet. Source context
  is persisted in local scaffold mode and Supabase mode, and appears in builder
  and admin review queues.
- Extracted item editing now uses a type-aware client form: product, document,
  and maintenance edits show different category options, evidence-note labels,
  review checklists, and status-aware guidance before saving through the same
  server action.
- Extracted item edits now run through product/document/maintenance-specific
  server-side validation before saving. High-confidence edits require traceable
  source context; product edits require location and a specific identity;
  document edits require a specific category/source support; maintenance edits
  require a clear care action and detail. The edit page maps these failures to
  readable review guidance instead of raw error slugs.
- Extracted item edits now persist an internal reviewer note/reason in local
  scaffold mode and Supabase mode when the `review_reason` column exists.
  Builder/admin review queues display the note, low-confidence saves require
  one, and new extracted rows get default reasons explaining whether they
  matched an existing record or need admin review. Existing Supabase projects can
  run `docs/supabase-add-extracted-item-review-reason.sql`; the app still
  tolerates the old schema while that migration is pending.
- The handover package can be published from `/builder/handover-package`.
  Local mode stores published item ids in `.local-data/specification-extractions.json`.
- Supabase package publishing now uses the same package-ready statuses as local
  mode: `accepted`, `auto_approved`, `builder_approved`, and `global_approved`.
- `/client/portal` now shows published package counts and item details after
  publish.
- `/client/portal` now reads through a scoped client portal data accessor. It
  selects the first project visible to the signed-in client/builder through
  Supabase RLS, filters documents, maintenance, and published package items to
  that project, and shows a no-assigned-project state instead of falling back to
  global data.
- Client missing-item requests now use the RLS-visible project id from the
  portal/request route instead of a hard-coded demo project id. The server action
  no longer falls back to the scaffold project when Supabase is configured.
- Supabase schema now includes a client-readable policy for package-ready
  extracted handover items so assigned clients can see published package details.
  Existing Supabase projects can run
  `docs/supabase-add-client-extracted-items-policy.sql`.
- Builder projects now show client invite status and can generate a one-time
  client invite link. The link points to `/client/accept-invite?token=...`; it is
  shown to the builder for manual sending until transactional email is wired.
- Builder projects can regenerate or revoke outstanding invite links. Invite
  status shows the original invite date plus a 14-day expiry window.
- Builder projects can now send client invite emails through Resend from the
  project workspace. The manual invite-link path remains as a fallback when
  email delivery is not configured or fails.
- Client invite acceptance is implemented at `/client/accept-invite`. It expects
  the client to be signed in through Supabase magic link, then calls the
  `accept_project_client_invite` RPC to attach `project_clients.user_id`, set
  `accepted_at`, clear the token hash, and open `/client/portal`. The RPC
  rejects invite tokens older than 14 days.
- Supabase schema now includes the invite-acceptance RPC. Existing Supabase
  projects can run `docs/supabase-add-client-invite-acceptance.sql`.
- Invite acceptance now requires the signed-in account email to match the
  invited `project_clients.email`, so a builder opening a client invite link
  cannot accidentally consume it.
- Login now supports email/password sign-in and sign-up alongside the existing
  magic-link path. This avoids relying on editable Supabase email templates
  during early setup; OTP-code login can still be added later once custom SMTP
  allows the `{{ .Token }}` template.
- First-time builders without an `organisation_members` row now go to
  `/builder/onboarding` instead of hitting a dead-end `no-organisation` error.
  The onboarding form captures organisation name, trading name, and contact
  phone, then calls the `ensure_builder_workspace` RPC to create the
  organisation and owner membership for the signed-in account.
- Builder Projects and New Project pages now check for a builder workspace
  before rendering. First-time builders are redirected to onboarding first, so
  project form details are not lost on submit.
- Builder Projects now uses a consolidated project workspace. Builders can open
  an 80%-style modal from the projects list to create or edit project/client
  details, optionally attach a spec PDF, search existing products, see
  package-ready/admin-review/manual item sections, manage client invite links,
  and run the send-package confirmation from one place.
- Builder navigation has been simplified to Dashboard, Projects, Product
  Library, Maintenance, Settings, and Portal Switchboard. Specifications,
  documents, approvals, and package routes still exist as supporting routes, but
  are no longer the primary sidebar flow.
- Builder dashboard now focuses on active projects, admin review notifications,
  package-ready items, handed-over projects, client requests, and upcoming
  maintenance instead of sending users into separate workflow tabs first.
- Builder Product Library now has URL filters for all, approved, and awaiting
  global approval, and surfaces project-extracted items waiting for admin review.
- Builder Maintenance now shows per-project cards, including projects with no
  maintenance tasks sorted to the bottom.
- Client portal maintenance cards now let clients mark tasks complete. The app
  reads `maintenance_completions` to show completed tasks distinctly.
- Builder Settings added at `/builder/settings` with editable organisation name,
  trading name, public email, and phone. Users, messaging, billing, and review
  sections remain as operational scaffolds.
- Builder project workspace now includes client document upload/registration
  inside each project edit modal. Uploaded documents can be marked
  client-visible and are stored in the existing `handover-documents` Supabase
  bucket when Supabase is configured.
- Project creation now includes a project-credit confirmation panel. The
  current implementation is a scaffold for Stripe-backed credits: creating a
  project requires confirming one credit, while `test@gmail.com` receives
  unlimited test credits.
- Client portal now opens as a handover index. Clients see each assigned project
  as a separate handover folder, then open a project to view client-visible
  documents, published package items, and maintenance tasks.
- Send package is now project-scoped. The project modal passes the project id to
  the publish action, Supabase mode marks that project `published` with
  `published_at`, and local scaffold mode stores published item ids per project
  instead of one global package.
- The in-modal product request tool now persists a project-tied missing-item
  request into the same admin-review request pipeline used by client requests.
- Billing scaffolding now includes Stripe environment placeholders, a
  `docs/supabase-add-project-credits-stripe.sql` migration for credit accounts
  and credit events, and settings-page placeholders for credit balance/customer
  status. `getBuilderCreditStatus()` reads the credit account table when it
  exists and still treats `test@gmail.com` as unlimited.
- Project creation now performs best-effort credit enforcement when
  `project_credit_accounts` exists: non-unlimited organisations need at least
  one credit, successful project creation decrements the balance, and a
  `project_credit_events` ledger row is written. This still needs a transactional
  RPC before production billing because concurrent submissions can race.
- Client-visible documents now have a signed download route at
  `/api/documents/[documentId]/download`. The route reads the RLS-visible
  document row, creates a five-minute Supabase Storage signed URL, and redirects
  the browser. Local scaffold mode returns a setup response.
- Document downloads now write `document_download_events` rows when the Supabase
  migration is present. Builders see per-document download counts and last
  download dates inside the project workspace, and clients see their own
  document download status inside the client handover page.
- Billing now has a Stripe Checkout starter route at `/api/billing/checkout`.
  It posts to Stripe's Checkout Session API using `STRIPE_SECRET_KEY` and
  `NEXT_PUBLIC_STRIPE_PROJECT_CREDIT_PRICE_ID`, sets organisation metadata and
  credit quantity, and redirects to the hosted Checkout URL. Settings exposes a
  basic credit quantity form. Webhook credit top-ups are still outstanding.
- Billing now has a Stripe webhook starter route at `/api/billing/webhook`.
  It verifies the raw request body against `STRIPE_WEBHOOK_SECRET`, handles
  `checkout.session.completed`, ignores duplicate Stripe event ids, and applies
  credit top-ups to `project_credit_accounts` with a ledger row in
  `project_credit_events`. It uses `SUPABASE_SERVICE_ROLE_KEY` because Stripe
  calls the webhook without a logged-in user.
- The project-credit migration now includes database RPCs for atomic credit
  consumption and Stripe purchase application:
  `consume_project_credit(...)` and `apply_project_credit_purchase(...)`. Runtime
  code prefers these RPCs when they exist and falls back to the older best-effort
  path for databases that have not applied the migration yet.
- Admin billing page added at `/admin/billing`. It uses the Supabase service-role
  client to show credit accounts, balances, Stripe customer links, and recent
  credit ledger events. The admin sidebar links to it, and the page is forced
  dynamic so balances are read at request time.
- `/admin/billing` now includes a manual credit adjustment form for metered
  accounts. Adjustments require a logged-in Supabase session, use the
  service-role client server-side, and write a `manual_adjustment` ledger event
  with the operator note.
- Stripe billing setup and recovery notes live in
  `docs/stripe-billing-runbook.md`, including Stripe CLI webhook forwarding,
  test-card flow, and manual adjustment guidance.
- Project-approving an extracted item in Supabase mode keeps it project-scoped.
  Platform admin global approval is the path that promotes reusable product
  records.
- Supabase-ready server actions in `src/lib/server/actions.ts`. With env vars
  absent they redirect through local scaffold mode; with env vars present they
  attempt inserts into Supabase tables and audit logs.
- Auth proxy in `src/proxy.ts`. Builder routes remain open in local
  scaffold mode, then require Supabase sessions when env vars are configured.
- Auth proxy matcher now includes `/admin/:path*`, `/builder/:path*`, and
  `/client/:path*`.
- Auth proxy enforcement now matches the proxy route coverage: when Supabase
  env vars are configured, unauthenticated admin, builder, and client portal
  routes redirect to `/login`.
- Auth redirects now preserve query strings inside the `next` parameter so
  client invite tokens survive the magic-link login round trip.
- Magic-link auth redirects through `/auth/callback`, which exchanges the
  Supabase PKCE code for a cookie-backed session before sending users to their
  original route.
- Supabase schema includes `client_requests`, `client_request_type`, and
  `client_request_status` for homeowner request intake and admin triage.
- Phase 1 of the document upload/extraction/review/publish-blocking workflow is
  modelled in schema and TypeScript constants only. It adds parallel workflow
  primitives for `uploaded_documents`, `document_extraction_jobs`,
  `extracted_items`, `product_matches`, `item_review_actions`,
  `handover_items`, and `audit_logs`; current runtime behaviour is unchanged.
- Phase 2 document uploads now write to the workflow upload model. Builder
  project document uploads validate supported file types, check project
  ownership before storage writes, create `uploaded_documents` rows with
  `uploaded` processing status, record `document_uploaded` audit logs, and show
  upload processing status inside the project modal. AI extraction is still not
  started in this phase.
- Phase 3 extraction job scaffold now creates `document_extraction_jobs` after
  document upload, moves jobs/documents through processing/completed/failed
  statuses, writes placeholder `extracted_items`, records
  `ai_extraction_started`, `ai_extraction_completed`, and
  `ai_extraction_failed` audit logs in Supabase mode, and exposes failed-job
  retry controls in the project modal. Extraction output is mocked only and
  remains separate from homeowner-facing handover data.
- Phase 4 AI extraction now uses real OpenAI Responses API structured output
  when `OPENAI_API_KEY` is configured, with `OPENAI_EXTRACTION_MODEL` defaulting
  to `gpt-5.1-mini`. Uploaded PDFs reuse the existing PDF/OCR text extractor,
  CSVs use plain text extraction, and unsupported binaries are handled as
  metadata-only inputs. If no API key is configured, the Phase 3 mock remains
  the local fallback. Malformed/failed AI responses mark the job failed and
  retryable; raw AI output remains in `extracted_items.raw_extracted_data` only.
- Phase 5 product matching now checks extracted workflow items against approved
  local verified product records before any web search. Exact and fuzzy matches
  update `extracted_items.match_status`, `review_status`, and
  `matched_product_id`, create `product_matches` rows with confidence and match
  reasons, and show those match reasons in the builder project modal. Unmatched,
  low-confidence, and probable matches remain builder-review states. No web
  search/source discovery is implemented in this phase.
- Cost instrumentation groundwork is now in place for stack decisions: extracted
  workflow items receive normalized identity evidence and deterministic
  fingerprints in `rawExtractedData.identity`; extraction runs produce usage
  metrics for row count, unique identity count, duplicate count, cache
  hit/miss counts, OpenAI request/token usage, and optional rate-configured cost
  estimates; CSV-style/line-heavy specs chunk into multiple OpenAI extraction
  calls; the builder project workspace shows those metrics on each extraction
  job where available. Obvious emails, phone numbers, likely street addresses,
  and labelled client/homeowner references are redacted before OpenAI calls and
  counted in the same usage metrics.
- Future AI/source-enrichment architecture should keep Supabase as the app
  system of record for organisations, projects, users, review state, credits,
  audit logs, and published handover data, while moving long AI/search work into
  a durable serverless pipeline. The preferred direction is Cloudflare
  Workflows for multi-step extraction/enrichment, Queues for batches of about 15
  items, Durable Objects for per-upload/job coordination and progress, and R2
  for temporary raw file storage. The workflow should dedupe items before
  search, look up cached/common products first, and only do deeper web
  enrichment for unknown, low-confidence, package-critical, or globally promoted
  items. See `docs/technical-architecture-source-of-truth.md` and
  `docs/implementation-phases.md` before changing this architecture.
- Pricing/billing direction: sell a project-level processing credit rather than
  per-upload or visible AI token units. A $150 project credit should allow
  multiple specification uploads for the same project, with metering based on
  extracted rows, unique enriched items, web searches, and deep enrichment
  attempts. Re-uploads and repeated items across specs should not consume the
  same enrichment allowance twice after dedupe. The UI should eventually expose
  a simple usage meter such as specs uploaded, rows extracted, unique items,
  enriched items, review-needed items, and included searches used.
- Cost guardrail direction: assume normal projects stay profitable when dedupe
  and cache hits work, but a 650-item unknown spec can cost materially more if
  every item needs multiple searches. Start with one search per unique unknown
  item, stop early on high-confidence matches, mark medium confidence as
  review-needed, and reserve two-to-three-search enrichment for selected
  critical/global items. This keeps the builder experience fair while protecting
  the project credit margin.
- Phase 10 hardening now prevents old or accidental publish paths from
  bypassing the final project Send package modal. The legacy
  `/builder/handover-package` route links back to `/builder/projects` for final
  send checks, and builder review actions no longer regenerate homeowner-safe
  workflow `handover_items` after a project is already published. Published
  homeowner data only changes after the final publish/approval flow runs again.
- Hunter's desktop QA checklist now lives at
  `docs/hunter-testing-checklist.md`, with matching reminders in
  `TESTING_LOG.txt`.
- A predictable one-go local demo upload file lives at
  `docs/demo-assets/bayview-demo-spec.csv`. Use it when testing the project
  document upload/extraction/review flow with a potential user.
- A controlled 100-item cost-test upload file lives at
  `docs/demo-assets/100-item-cost-test-spec.csv`, generated by
  `npm.cmd run demo:generate-100-item-spec`. Use
  `docs/openai-100-item-cost-test-runbook.md` when measuring real OpenAI
  extraction cost with `OPENAI_API_KEY`. A guarded local debug route at
  `POST /api/debug/extraction-cost-test` can run the fixture directly when
  `ENABLE_DEBUG_COST_TESTS=true`; it returns metrics, sample items, review/failed
  counts, and a `testingLogTemplate` block for copying into `TESTING_LOG.txt`.
- Source PDF inspection is scaffolded in `src/lib/server/source-pdf.ts`.
  `POST /api/debug/source-pdf` can fetch and inspect a direct warranty/manual
  PDF URL locally when `ENABLE_DEBUG_COST_TESTS=true`. It rejects private/local
  URLs before and after redirects, can check optional product identity hints
  against extracted PDF text, and returns source hashes/metadata for review; see
  `docs/source-pdf-inspection-runbook.md`.
- Source enrichment cost testing is scaffolded at
  `POST /api/debug/source-enrichment-cost-test`. It reruns the controlled
  100-item extraction, dedupes to unique identities, performs one OpenAI
  `web_search` enrichment call per selected unique item, asks for official
  source URLs plus warranty/maintenance findings, optionally inspects one direct
  source PDF per item, and returns enrichment/search/PDF metrics plus a
  `testingLogTemplate`. Use `maxUniqueItems` to sample before running the full
  unique set; the route caps the request at 40 unique items.
- Initial source-enrichment cost measurements on 2026-06-20:
  - Full web-search-only run (`maxUniqueItems=40`, `inspectPdfSources=false`)
    completed with 81 extracted rows, 34 unique identities, 34 enriched
    identities, 122 web-search calls, 596,807 enrichment input tokens, 21,136
    output tokens, 617,943 total tokens, and ~302 seconds runtime.
  - At current checked `gpt-5.4-mini` Standard token rates ($0.75/M input,
    $4.50/M output), the model portion is about $0.543 before web-search call
    charges. If web search is $10/1K calls, the 122 calls add about $1.22, for
    roughly $1.76 total for the 100-item fixture's unique source search.
  - A 10-unique-item run with `inspectPdfSources=true` inspected 9 source PDFs,
    failed 5 PDF inspections, used 154,457 input tokens and 5,826 output tokens,
    and took ~111 seconds. Direct PDF inspection is useful but too slow/flaky
    for a request-time production flow; queue it in the durable pipeline.
  - PDF summarisation is now supported behind the same debug route with
    `summarizePdfSources=true`. A 3-item sample produced 2 PDF summaries and
    used 5,608 PDF-summary input tokens plus 443 output tokens.
  - A chunked PDF-summarisation run over 32 selected/enriched identities
    produced 97 web-search calls, 26 PDF inspections, 13 PDF failures, 13 PDF
    summaries, 42,271 PDF-summary input tokens, 2,560 PDF-summary output tokens,
    552,397 total enrichment input tokens, 20,797 total output tokens, and
    573,194 total tokens over ~433 seconds summed route time. Using Hunter's
    observed token rates (7,700 input tokens = $0.002, 11,391 output tokens =
    $0.023), model-token cost is about $0.19; at an assumed $10/1K web-search
    calls, web search adds about $0.97, for about $1.16 over 32 enriched
    identities. Scaling to the normal 34-36 unique identities in the fixture
    gives a practical estimate of about $1.25-$1.35 before Cloudflare/background
    infrastructure costs.
- Real-world scanned spec benchmark on 2026-06-20:
  - `C:\Users\hunte\Downloads\2074 legal signed outline spec.pdf.pdf` is a
    strong large-spec fixture: 34 pages, 11.4 MB, and only 14 selectable text
    characters via pdfplumber, so it requires OCR.
  - Added guarded `POST /api/debug/local-document-cost-test` for local files in
    Downloads/workspace. It accepts `filePath`, `ocrMaxPages`,
    `runSourceEnrichment`, `maxUniqueItems`, `startAtUniqueItem`,
    `inspectPdfSources`, and `summarizePdfSources`.
  - With `ocrMaxPages=20`, extraction recovered 23,743 OCR characters,
    extracted 153 rows / 146 unique identities, used 16,868 input tokens and
    8,009 output tokens, and took ~233 seconds.
  - A top-10 source-search sample without PDF summaries used 38 web-search
    calls, 157,379 source input tokens, 6,079 source output tokens, and ~81
    seconds source runtime.
  - A top-10 source-search + PDF-summary sample used 32 web-search calls,
    inspected 6 PDFs, failed 1 PDF inspection, produced 5 PDF summaries, used
    157,285 source input tokens and 5,668 source output tokens, and took ~85
    seconds source runtime.
  - Important product finding: the current scanned-spec extraction over-extracts
    legal/spec/admin/site-service lines as source-enrichment identities. Add a
    product-vs-admin/service classifier or stricter extraction schema before
    running full enrichment over all 150-ish identities from this real spec.
- Magic-link login scaffold at `/login`.

## Tested Demo Flow

1. Open `/builder/specifications/new`.
2. Use the local extraction preview:
   - paste spec text and click `Preview from text`, or
   - choose a PDF and click `Extract PDF preview`.
3. Click `Send to review queue`.
4. Open `/builder/specifications/review`.
5. Project-approve, reject, or send uncertain items through admin/global review.
6. Open `/builder/handover-package`.
7. Package-ready items appear grouped as products, documents, and maintenance.

## Verified

- `npm.cmd run lint`
- `npm.cmd run build`
- Browser checks for dashboard, builder/client routes, form routes, status
  banners, login page, product AI draft panel, and specification intake routes.
- Browser check for local spec text extraction preview on
  `/builder/specifications/new`.
- API check for local PDF extraction with a generated sample PDF.
- Browser check for preview -> send to review queue -> review page visibility.
- Browser check for review approval -> handover package preview visibility.
- Browser check for edit extracted item -> review queue updated.
- Browser check for publish handover package -> client portal published section.
- Browser check for dashboard sidebar navigation to `/builder/specifications`
  and `/client/portal`.
- Browser check for dashboard action links to project create, document upload,
  specification upload, and specification review.
- Browser check for the polished specification upload page, including collapsed
  fallback sections and pasted-text extraction smoke test.
- Browser check for specification review metrics and upload/preview navigation
  links.
- Browser check for the three portal front doors: `/`, `/admin`, `/builder`,
  and `/client/portal`.
- Browser check for the hands-off approval model: builder project approval,
  admin global approval, and package-ready handover preview copy.
- Browser smoke test for client request submission from `/client/request-product`
  and visibility in `/admin/review`.
- Browser smoke test for converting a client request into an admin-review
  extracted item.
- Browser visibility check for converted client request showing as both
  `ai_checking` and an extracted admin-review item. Full fresh submit smoke hit
  an in-app browser locator/clipboard issue, but lint/build passed and the
  existing converted request path was verified.
- Browser visibility check for admin approve/reject controls.
- Browser check for `/admin/products` global product library page.
- Browser check for converted client request showing `Global Approved` after
  admin approval and the resulting product appearing in `/admin/products`.
- Browser check for builder product library hands-off copy, no manual product
  CTA, spec upload CTA, and `Project Approvals` sidebar link.
- Browser smoke check for `/admin/products` after source-enrichment changes:
  page loads, review queue link appears, source/missing-field copy appears, and
  needs-enrichment records are visible. Follow-up check also verified visible
  source-backed copy and James Hardie source links.
- Browser smoke check for `/` after source-enrichment changes: portal
  switchboard loads with links to `/admin`, `/builder`, and `/client/portal`.
- HTTP smoke check for unauthenticated `/builder` after the Next.js 16 proxy
  migration: route returns `307` to `/login?next=%2Fbuilder` when Supabase
  env vars are configured.
- Login action now sends Supabase an absolute `/auth/callback` magic-link
  redirect URL, and `/auth/callback` returns a setup-specific login error when
  the Supabase code exchange fails.
- Browser smoke check for `/builder/specifications/new` after extraction
  diagnostics changes: page loads with PDF process/preview actions.
- API smoke check for `POST /api/specifications/extract-pdf` with a generated
  PDF: returned file metadata, chunk/table diagnostics, warnings, and proposed
  items.
- Browser smoke check for extracted item edit flow: edit page renders item type,
  category, source page, and source snippet controls; saving a local item returns
  to the review queue with source context visible.
- Lint/build check for type-aware extracted-item editing while Supabase auth was
  rate-limited; direct browser smoke was blocked by the expected auth proxy.
- Lint/build check for type-specific extracted item save validation and readable
  edit error banners. Direct edit-page browser smoke is still gated by Supabase
  sign-in while magic-link email is rate-limited.
- Lint/build check for extracted item reviewer-note persistence, schema
  compatibility fallbacks, and builder/admin review-note display.
- HTTP smoke check after reviewer-note changes: `/` returns `200`, and
  `/builder/specifications/review` returns the expected `307` redirect to
  `/login?next=%2Fbuilder%2Fspecifications%2Freview` with Supabase auth active.
- Lint/build check for scoped client portal data, client request project
  selection, auth proxy coverage, and the client package item RLS migration.
- HTTP smoke check after client route protection: unauthenticated
  `/client/portal`, `/admin`, and `/builder` each return `307` to their
  respective `/login?next=...` URL with Supabase auth active.
- Lint/build check for builder client invite generation, invite status display,
  the client invite acceptance page, and the invite acceptance Supabase RPC.
- Lint/build check for invite regeneration/revocation controls and 14-day RPC
  expiry enforcement.
- Lint/build check for email/password login/sign-up and invite email matching.
- Lint/build check for first-builder onboarding and the
  `ensure_builder_workspace` Supabase RPC.
- Lint/build check for pre-render builder workspace guards on Projects and New
  Project routes.
- Lint/build check for the streamlined builder dashboard, project workspace
  modal, product-library filters, per-project maintenance cards, simplified
  sidebar, and settings scaffold.
- Lint/build check for in-project document upload, client handover index,
  project-credit confirmation, and the `test@gmail.com` unlimited-credit
  scaffold.
- Lint/build check for project-scoped publishing, persistent builder missing-item
  requests, and the Stripe/project-credit database scaffold.
- Lint/build check for best-effort credit deduction/ledger writes and signed
  document download route.
- Lint/build check for the Stripe Checkout starter route and Settings checkout
  form.
- Lint/build check for Stripe webhook signature verification and credit top-up
  handling.
- Lint/build check for billing RPC preference with fallback compatibility.
- Lint/build check for the admin billing page and dynamic route behaviour.
- Lint/build check for billing operator recovery, document download history,
  Resend client invite delivery scaffold, client maintenance completion, editable
  builder organisation settings, and client-visible document download history.
- Lint/build check for Phase 2 document workflow uploads: supported file
  validation, project ownership check before upload, `uploaded_documents`
  persistence, `document_uploaded` audit log writes, local scaffold persistence,
  and project-modal processing status display. Runtime Supabase upload tests are
  queued in `TESTING_LOG.txt`.
- Lint/build check for Phase 3 mocked extraction job scaffold: job creation,
  processing/completed/failed transitions, placeholder extracted item
  persistence, retry action wiring, and project-modal job/item display. Runtime
  Supabase upload/retry tests are queued in `TESTING_LOG.txt`.
- Lint/build check for Phase 4 real AI extraction wiring: PDF/CSV text
  preparation, OpenAI Responses API structured-output call, malformed response
  handling, no-key mock fallback, retry-compatible failure path, and no
  homeowner-facing raw AI exposure. Runtime OpenAI/Supabase tests are queued in
  `TESTING_LOG.txt`.
- Lint/build check for Phase 5 product matching: approved-product candidate
  loading, exact/fuzzy matching, low-confidence/unmatched classification,
  `product_matches` persistence, extracted item status updates, local scaffold
  parity, and project-modal match reason display. Runtime matching tests are
  queued in `TESTING_LOG.txt`.
- Lint/build check for Phase 6 builder review queue: unresolved workflow item
  filtering, approve/edit/exclude/builder-supplied/supporting-document actions,
  `item_review_actions` persistence, workflow `audit_logs` writes, Supabase
  project ownership checks, local scaffold parity, and queue removal for
  resolved statuses. Runtime review-action tests are queued in
  `TESTING_LOG.txt`.
- Lint/build check for Phase 7 homeowner-safe handover item generation:
  approved workflow items sync into `handover_items`, unresolved/excluded/raw AI
  data is filtered out, client package queries prefer published workflow
  `handover_items` over raw extraction rows, Supabase publish remains
  organisation-scoped, and local scaffold mode stores generated workflow
  handover items separately. Runtime homeowner visibility tests are queued in
  `TESTING_LOG.txt`.
- Lint/build check for Phase 8 publish readiness: shared readiness rules block
  publishing when workflow documents/jobs are incomplete, extraction has failed,
  or workflow review items remain unresolved. The builder send panel shows the
  same blockers that `publishHandoverPackageAction` enforces on the backend.
  Runtime publish-blocking tests are queued in `TESTING_LOG.txt`.
- Lint/build check for Phase 9 final approval: the send panel shows a final
  approval summary, requires the builder confirmation checkbox, conditionally
  requires the AI confirmation checkbox, and `publishHandoverPackageAction`
  stores `handover_approvals` metadata before publishing. Runtime approval
  tests are queued in `TESTING_LOG.txt`.
- Lint/build check for Phase 10 hardening: legacy publish UI is routed through
  the final project send modal, post-publish workflow review changes no longer
  silently regenerate homeowner-facing handover items, and Hunter's manual
  desktop checklist is documented in `docs/hunter-testing-checklist.md`.
- Lint/build check after adding the local demo CSV asset and linking it from
  `docs/full-test-flow-requirements.md` and
  `docs/hunter-testing-checklist.md`.
- HTTP smoke check for unauthenticated `/builder/onboarding`: route returns
  `307` to `/login?next=%2Fbuilder%2Fonboarding` with Supabase auth active.
- HTTP smoke check for unauthenticated
  `/client/accept-invite?token=test-token`: route returns `307` to
  `/login?next=%2Fclient%2Faccept-invite%3Ftoken%3Dtest-token`, preserving the
  invite token through the login redirect.
- Lint/build check for OCR-assisted PDF extraction.
- API smoke check for `POST /api/specifications/extract-pdf` with an existing
  selectable-text PDF: OCR remains at 0 pages and normal proposals still return.
- API smoke check for `POST /api/specifications/extract-pdf` with a generated
  image-only/scanned-style PDF: OCR recovered text from 1 page and proposals
  included cladding, maintenance, and producer statement items.
- API smoke check after consolidating extraction response shaping: existing
  selectable-text PDF still returns file metadata, OCR counts, summary notes,
  and proposed items.
- API smoke check for an aligned text schedule PDF: table count increases to 1,
  extraction text includes an `Extracted tables` section, and the warning
  explains that a table-like text section was inferred.
- Browser smoke check for polished specification upload UI: main process action
  is present and disabled before PDF selection, selected-file state appears,
  advanced fallback tools are collapsed, and duplicate save-to-review action is
  hidden until preview mode.
- Lint/build check for the PDF intake progress and source-quality UI while
  Supabase magic-link email was rate-limited.
- API smoke check for `POST /api/ai/product-draft`: known Linea Weatherboard
  request returns high-confidence source-backed scaffold fields; vague bathroom
  fitting request remains blocked with missing-field guidance.
- Browser smoke check for product draft form shell: product page, draft button,
  product identity fields, and notes field render. Full form-fill smoke was
  blocked by the in-app browser clipboard/type limitation, but the endpoint
  response consumed by the panel was verified directly.
- Fresh-chat automated local smoke on 2026-06-20: `npm.cmd run lint` and
  `npm.cmd run build` passed; the dev server returned `200` for `/`;
  unauthenticated admin/builder/client routes returned expected `307` login
  redirects with `next` preserved; `POST /api/ai/product-draft` returned the
  James Hardie/Linea source-backed scaffold for valid JSON; debug cost/source
  PDF routes returned `404` while `ENABLE_DEBUG_COST_TESTS` was disabled.
- Debug scaffold smoke on 2026-06-20: with a temporary debug-enabled dev server
  and no `OPENAI_API_KEY`, `POST /api/debug/extraction-cost-test` returned
  mock-mode metrics plus `testingLogTemplate`; `POST /api/debug/source-pdf`
  rejected a localhost URL, inspected a small public PDF, and returned hashes,
  extracted text/page counts, warnings, and identity-check output. `npm.cmd run
  lint` and `npm.cmd run build` passed after the scaffold hardening.

Both passed after the latest changes.

## Local Scaffold Data

- Local uploaded PDFs are saved under `.local-uploads/`.
- Local extracted review items are saved in
  `.local-data/specification-extractions.json`.
- Local globally approved product records are saved in
  `.local-data/global-products.json`.
- Both folders are ignored by git.
- Seed data still lives in `src/lib/data.ts`.
- Server query fallback/live-read boundary lives in `src/lib/server/queries.ts`.
- Main server actions live in `src/lib/server/actions.ts`.

## Production Backend Notes

- Apply `docs/supabase-schema.sql` to a Supabase project.
- If the schema was applied before reviewer notes were added, also run
  `docs/supabase-add-extracted-item-review-reason.sql`.
- If the schema was applied before the client package item policy was added,
  also run `docs/supabase-add-client-extracted-items-policy.sql`.
- If the schema was applied before invite acceptance or invite email matching
  was added, also run
  `docs/supabase-add-client-invite-acceptance.sql`.
- If the schema was applied before builder onboarding was added, also run
  `docs/supabase-add-builder-workspace-bootstrap.sql`.
- If the schema was applied before document download history was added, also run
  `docs/supabase-add-document-download-events.sql`.
- If the schema was applied before handover first-open tracking was added, also
  run `docs/supabase-add-handover-open-events.sql`.
- If the schema was applied before client maintenance completion was wired, also
  run `docs/supabase-add-maintenance-completion-policies.sql`.
- If the schema was applied before editable organisation settings were added,
  also run `docs/supabase-add-organisation-update-policy.sql`.
- If the schema was applied before the phased document workflow model was added,
  also run `docs/supabase-add-document-workflow-phase1.sql`.
- If the schema was applied before final approval records were added, also run
  `docs/supabase-add-handover-approvals.sql`.
- If the schema was applied before extraction usage/cost telemetry was added,
  also run `docs/supabase-add-extraction-usage-metrics.sql`.
- Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
  `SUPABASE_SERVICE_ROLE_KEY` to
  `.env.local`.
- Add `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `NEXT_PUBLIC_APP_URL` to
  `.env.local` before testing client invite emails. `NEXT_PUBLIC_APP_URL`
  should match the local or deployed app origin used in invite links.
- Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and
  `NEXT_PUBLIC_STRIPE_PROJECT_CREDIT_PRICE_ID` to `.env.local` before testing
  hosted Checkout.
- Set `ADMIN_EMAILS` in `.env.local` for manual billing-adjustment access. It
  defaults to `test@gmail.com` in local/test scaffolding.
- See `docs/stripe-billing-runbook.md` for the Stripe CLI webhook setup,
  Checkout test flow, and operator recovery process.
- Create a private Supabase Storage bucket named `handover-documents`.
- In Supabase Auth URL settings, add local redirect URLs:
  `http://127.0.0.1:3000/auth/callback` and
  `http://localhost:3000/auth/callback`.
- Sign in once through `/login`, then run `docs/supabase-bootstrap.sql` with
  your email filled in so the first authenticated builder user has an
  organisation and demo project.
- Once env vars are present, builder routes require Supabase auth via
  `src/proxy.ts`.
- Current AI routes are contracts/scaffolds. Real model calls still need
  `OPENAI_API_KEY`.

## Real Spec Extraction Workflow

- `docs/real-spec-extraction-workflow.md` documents the intended scanned-spec
  pipeline: source-quality inspection, full extraction, classification gate,
  dedupe/cache lookup, batched source enrichment, review, and publish.
- The guarded local benchmark route
  `POST /api/debug/local-document-cost-test` now reports both all extracted
  unique identities and source-enrichable unique identities, plus classification
  counts and candidate/rejected samples.
- Real PDF benchmark file:
  `C:\Users\hunte\Downloads\2074 legal signed outline spec.pdf.pdf`.
- All-page OCR extraction/classification pass produced 321 rows, 291 extracted
  unique identities, 181 source-enrichable unique identities, 45,877 extraction
  tokens, and ~211 seconds extraction runtime.
- Previous 20-page OCR extraction/classification pass produced 156 rows, 149
  extracted unique identities, 118 source-enrichable unique identities, 24,831
  extraction tokens, and ~112 seconds extraction runtime.
- Latest 5-source-item sample with PDF inspection and summarisation produced 18
  web-search calls, 4 PDFs inspected, 1 PDF failure, 3 PDF summaries, 94,624
  source-enrichment tokens, and ~42 seconds source runtime.
- Latest 10-source-item all-page batch with PDF inspection and summarisation
  produced 37 web-search calls, 7 PDFs inspected, 2 PDF failures, 5 PDF summary
  calls, 176,365 source-enrichment tokens, and ~88 seconds source runtime after
  the ~210 second all-page OCR/extraction pass.
- Linear projection from that 10-item batch to the 185 source-ready identities
  is about 685 web searches, 130 PDF inspections, 93 PDF summaries, 3.15M source
  input tokens, and 108.7K source output tokens. Using the earlier rough
  `gpt-5.4-mini` Standard token rates plus an assumed $10/1K web-search price,
  that is roughly $9.70 before retries, persistence, and background
  infrastructure.
- Source-enrichment classification now treats external supplier quote references
  such as "as per kitchen quote" or "as per Superior Kitchens quote" as
  `project_document`, not automatic source-enrichment candidates. These rows
  should ask the builder to upload the quote or provide exact homeowner-safe
  product/material identities, warranty details, and care requirements.
- Cloudflare pipeline scaffold has started in
  `cloudflare/handover-pipeline/`. It defines a dry-run Worker, Queue producer
  and consumer, SQLite-backed Durable Object job status store, and R2 binding
  for future source PDF caching. Use `docs/cloudflare-pipeline-runbook.md` for
  login, queue/bucket creation, local dev, and deployment commands. The current
  Worker intentionally does not call OpenAI or web search.
- Phase planning has been reset in `docs/implementation-phases.md`: completed
  work is compressed into a baseline, and active Cloudflare work now starts at
  Phase 11. The app dispatches source-ready identities to the dry-run Worker
  after extraction/matching when `CLOUDFLARE_PIPELINE_URL` is configured, stores
  the Cloudflare status in extraction job usage metrics, and shows it in the
  builder project workspace. If the URL is absent, the job records
  `skipped/not_configured`.
- Phase 11 local dry-run smoke: Wrangler local `/health` worked, `POST /jobs`
  accepted a dry-run job, the queue consumer completed after the local
  `max_batch_timeout`, and the builder project modal displayed a local scaffold
  smoke job with 2 rows, 2 source-ready identities, 0 AI calls, and
  `Cloudflare dry-run: 2 candidates queued in 1 batches`. Codex browser
  automation could not attach a file to the upload input, so a real desktop
  upload from `/builder/projects` remains the manual confirmation before
  calling Phase 11 fully closed.
- Local R2 cache smoke update: `POST /cache/smoke` now writes and reads a tiny
  synthetic JSON metadata record through the Worker `SOURCE_PDF_BUCKET` binding.
  The verified local run used Wrangler's simulated R2 storage only, writing
  `dry-run/smoke/local-r2-smoke-codex-001.json` with a 236 byte payload. Do not
  call the deployed `/cache/smoke` endpoint without confirming first, because
  that would write a small object to the real Cloudflare R2 bucket.
- Cloudflare D1 pipeline SQL update: Phase 11D now has a remote D1 database
  created in Hunter's Cloudflare account. `builder-handover-pipeline` is bound
  as `PIPELINE_DB` in `cloudflare/handover-pipeline/wrangler.jsonc`, and
  `cloudflare/handover-pipeline/schema.sql` was applied remotely. Readback
  confirmed the expected pipeline-only tables for jobs, job events, context
  segments, identity cache, source candidates/results, source cache indexes,
  idempotency keys, and dry-run cost events. D1 must remain pipeline
  metadata/cache state; Supabase remains the auth, tenant, review, billing, and
  homeowner publication source of truth.
- Cloudflare progress sync update: Phase 13 has started. Builder project
  extraction job cards can now refresh a dispatched dry-run Worker job; the
  server action fetches `/jobs/<jobId>` from the configured Worker and persists
  status, batch counts, result counts, zero-cost budget usage, sync time, and
  any sync error into the extraction job usage metrics in Supabase or local
  scaffold mode. The builder project modal now renders the synced pipeline
  usage as searches used plus estimated cost, so dry-run jobs visibly remain at
  0 searches and $0.00. A real local Worker UI smoke is still needed to confirm
  the refresh button end to end.
- Cloudflare public dry-run update: Phase 12 public Worker dry-run is deployed
  at `https://builder-handover-pipeline.gpersson2002.workers.dev`. Wrangler
  created the queue `builder-handover-source-enrichment`, R2 bucket
  `builder-handover-source-cache`, and Worker secret `PIPELINE_SHARED_SECRET`.
  Public `/health` returned `d1Configured: true`; authenticated `POST /jobs`
  accepted `public-dry-run-d1-smoke-001`; queue processing completed one batch
  with two `dry_run_not_enriched` results; D1 readback confirmed 1 job,
  2 candidates, 3 events, and 1 zero-cost meter event. `.env.local` now points
  at the public dry-run Worker. No R2 objects, OpenAI calls, web searches, or
  live source enrichment ran.
- Cloudflare retry primitive update: the Worker now supports
  `POST /jobs/<jobId>/retry-failed`, authenticated with the same shared secret.
  Failed dry-run batches retain their original candidate payloads in Durable
  Object job status, and the retry endpoint requeues only failed batches with an
  incremented retry attempt. A module-level mock verified the endpoint requeues
  a failed batch without D1 configured. The public Worker was redeployed with
  this route and `POST /jobs/public-dry-run-d1-smoke-001/retry-failed` returned
  `no_failed_batches` for the completed smoke job.
- Cloudflare app-side retry update: builder project extraction job cards now
  show a `Retry failed batches` action when stored Cloudflare dry-run metrics
  indicate a failed Worker job or failed batch count. The server action posts to
  `POST /jobs/<jobId>/retry-failed`, merges retry status, requeued batch count,
  retry time, and cleared retry errors into extraction job usage metrics in
  Supabase or local scaffold mode, and keeps live enrichment disabled.
- Cloudflare retry smoke update: `npm.cmd run cloudflare:smoke:retry` imports
  the Worker module, mocks the Durable Object and Queue, runs
  `PIPELINE_MODE=dry_run_failure_test`, confirms batch 0 fails once, confirms
  `POST /jobs/<jobId>/retry-failed` requeues exactly that batch with
  `retryAttempt=1`, and confirms the retry completes with two dry-run results.
  This smoke is local-only and does not touch public Cloudflare, R2, OpenAI, or
  web search.
- Cloudflare live-pilot guard update: the Worker now rejects
  `PIPELINE_MODE=live_pilot` jobs unless `LIVE_PILOT_ENABLED=true`; when enabled
  it also caps admission with `LIVE_PILOT_MAX_CANDIDATES` defaulting to 1. The
  Worker also requires explicit `LIVE_PILOT_MAX_SEARCHES` and
  `LIVE_PILOT_MAX_ESTIMATED_COST_USD` before admission. The current
  implementation still reports `liveEnrichmentEnabled: false` and
  `dryRunEnrichment: true`, so this is an admission/cost guard only, not live
  source enrichment. `npm.cmd run cloudflare:smoke:live-guard` verifies disabled
  jobs return 403, over-cap jobs return 413, missing-budget jobs return 403, and
  a budgeted one-candidate admission still queues dry-run work only. The same
  safety snapshot, including live-pilot budget, is now persisted in Durable
  Object job status and copied onto queue messages so future live work can
  consume the approved budget deliberately. The queue consumer now rejects
  `PIPELINE_MODE=live_pilot` messages that are missing the admitted safety
  budget, so live-pilot execution cannot be triggered by an unsafely crafted
  queue payload. Dry-run batch completion now records `budgetUsage` with
  `searchesUsed: 0` and `estimatedCostUsd: 0` on the batch and aggregate job
  status, giving future live steps a concrete ledger surface to enforce.
- Product direction update: prefer context-first extraction and builder
  source-gap capture before internet/source enrichment. The uploaded PDF/spec is
  parsed into a strict handover schema with document evidence, missing fields,
  builder info needed, and context classification. Unfindable/custom/trade-only
  or supplier-quote-based items should ask the builder for exact identity,
  warranty, care, quote/manual/invoice, or evidence; they can be project-safe
  `builder_supplied` items after review/final approval, but global reuse remains
  admin-reviewed. See `docs/context-first-extraction-and-source-gap-strategy.md`.
- Rework architecture added in
  `docs/azure-cloudflare-context-processing-architecture.md`: use Azure AI
  Content Understanding or Azure AI Document Intelligence behind a document
  context adapter, match extracted rows against the approved database before
  search, ask the builder for missing context on low-confidence rows, re-run
  database matching after clarification, and queue only builder-confirmed
  source-ready unknown items for internet/source search. Cloudflare D1 is now
  positioned for pipeline SQL metadata/cache indexes/idempotency/cost events,
  while raw files stay in R2 and product auth/review/homeowner truth stays in
  Supabase unless a separate full database migration is approved.
- Final stack decision is now documented in
  `docs/final-tech-stack-decision.md`: Next.js 16 on Vercel for the product app,
  Supabase as the system of record, Cloudflare Workers/Queues/Durable Objects/R2
  for the background source pipeline and cache, OpenAI Responses API for
  context-first schema extraction plus selective enrichment, Stripe for project
  credits, and Resend for transactional email. Do not reopen Cloudflare D1 as
  the primary app database unless a hard production constraint appears.
- Next real-PDF test should run a 5-10 item source batch against the all-page
  source-ready list with `startAtUniqueItem=10`, then compare quality and cost
  before spending on larger source enrichment batches.
- Builder/client UI slice update: `/builder/projects` now shows workflow review
  lanes for Ready to accept, Needs detail, Project documents, Search results
  ready, and Not handover. The item edit form now exposes manufacturer,
  approved homeowner category, supplier, quantity, finish, colour, location,
  warranty text, care text, and care guidance source labels. Quote-like rows
  show an explicit quote upload action. Colour and quote document kind are
  review metadata only until first-class fields are added; manufacturer,
  approved category, supplier, quantity, finish, and care source map to the
  current workflow item fields. `/client/portal` groups published items by
  approved category and labels care text as manufacturer, supplier,
  builder-supplied, general AI, or unknown guidance. Builder project client
  access still shows only privacy-light package-level first-open details.
- Builder/client comparison UI update: the workflow item edit drawer now shows
  original extracted values beside the current edited values for item,
  manufacturer, model, supplier, quantity, finish, colour, location, approved
  category, and care guidance label. Older rows gracefully show `Not captured`
  when original extraction history is missing. The project document lane is now
  labelled `Project documents/quotes` and the care label control uses the
  simpler builder-facing labels Manufacturer, Supplier, Builder supplied, and
  General AI care guidance. `npm.cmd run lint` and `npm.cmd run build` passed.
- LlamaCloud greenfield integration pass update: backend/UX field contracts were
  checked for manufacturer, supplierName, supplierSku, builderApprovedCategory,
  careGuidanceSourceLabel, quoteReferenceStatus, parentExtractedItemId, original
  extracted values, builder edited values, source readiness, and quote uploads.
  The builder edit form now submits supplier SKU. Supabase handover item
  generation/readback now preserves manufacturer, supplier, approved category,
  quantity/finish, care guidance labels, and source-version references while
  falling back to legacy handover columns when older schemas are still in use.
  Source candidate dispatch is now gated to builder-confirmed unmatched items
  only; referenced or uploaded-but-unextracted quote rows remain project
  document/builder-detail work and do not queue source candidates. Local scaffold
  route smoke passed for `/builder/projects`, `/client/portal`, and
  `/builder/handover-package`; Playwright browser rendering could not be run
  because the local Playwright browser binary is not installed. `npm.cmd run
  lint` and `npm.cmd run build` passed after the integration fixes.

## Next Best Work

1. Run a real browser desktop smoke for `/builder/projects`: open a project,
   confirm the hydrated lanes render, expand a quote-like item, verify `Not
   captured` original values on older rows, submit category/supplier/SKU/care
   edits, upload a quote, and confirm the quote extraction/re-match path runs
   before any source search.
2. Run a context-first upload smoke with a vague/custom/supplier-quote item and
   confirm the project review lanes show missing fields, builder info prompts,
   project document/quote upload, category override, and care-source labels
   instead of sending the row straight to source enrichment.
3. Plan the Azure context-processing spike from
   `docs/azure-cloudflare-context-processing-architecture.md`: test direct PDF,
   scanned PDF, image-only PDF, and table-heavy schedules; confirm whether
   Azure can consume the files directly or needs local conversion/OCR first.
4. Run a local D1 dry-run smoke to confirm `/jobs` mirrors rows into the bound
   Cloudflare D1 database without moving product auth/review/homeowner truth out
   of Supabase.
5. Manually run the remaining Phase 11/13 `/builder/projects` upload smoke
   against the public dry-run Worker configured in `.env.local`; confirm the
   app-created extraction job shows source-ready counts and `Cloudflare dry-run`
   status, then click refresh after queue completion and confirm the synced
   batch/result status survives page refresh. Codex confirmed the route renders
   in scaffold mode, but the in-app browser did not activate project modal
   buttons, so this remains a real desktop check.
6. Smoke the same failing dry-run scenario through `/builder/projects`: confirm
   the app-side retry button appears for failed Cloudflare batches, requeues
   only failed batches, and then persists the refreshed status after page
   reload. The module-level retry smoke now passes via
   `npm.cmd run cloudflare:smoke:retry`.
7. Before any one-candidate live source pilot, keep
   `npm.cmd run cloudflare:smoke:live-guard` green and decide the exact live
   source implementation that will sit behind the existing `LIVE_PILOT_ENABLED`,
   `LIVE_PILOT_MAX_CANDIDATES`, `LIVE_PILOT_MAX_SEARCHES`, and
   `LIVE_PILOT_MAX_ESTIMATED_COST_USD` gates. The approved safety/budget
   snapshot is already available on Worker job status and queue messages.
8. Continue Hunter's desktop QA checklist in
   `docs/hunter-testing-checklist.md`, focusing on credentialed Supabase/OpenAI
   upload, review, publish, and homeowner visibility checks that cannot be
   completed from unauthenticated local smoke tests. Move passing/failing notes
   from `TESTING_LOG.txt` as real testing is completed.
9. Apply `docs/supabase-schema.sql` to a Supabase project and add env vars to
   `.env.local`.
10. Continue improving PDF extraction for long, table-heavy specification files:
   tune table extraction and OCR limits against real builder specifications.
11. Replace the deterministic source-enrichment scaffold with a real AI/search
   workflow only after context-first filtering and builder source-gap capture:
   official source search, extraction, critic scoring, source storage, admin
   review for low-confidence records, and project-credit usage metering around
   unique source-ready identities/search depth rather than raw upload count.
12. Tune the PDF intake progress and warning copy against real builder files,
   especially long scanned/image-only specifications and table-heavy schedules.
13. Apply `docs/supabase-add-extracted-item-review-reason.sql` to existing
   Supabase projects so reviewer notes persist remotely, then remove the legacy
   no-column fallback once all environments have the field.
13. Replace `POST /api/ai/product-draft` deterministic enrichment with the real
   source-backed AI/search workflow.
14. Test Resend client invite delivery against a verified sender domain and
    decide final invite email copy.
15. Test the Stripe Checkout/webhook flow against a real Stripe test account and
    confirm the `/admin/billing` manual adjustment path works for support
    recovery.
16. Add richer client-facing document previews once signed URL behaviour is
    stable with real uploads.

## Good Resume Prompt

Continue from `HANDOFF.md`. The controlled document workflow has completed
Phase 10 hardening and Phase 11 Cloudflare local dry-run contracts have a
partial smoke. Current product direction is context-first extraction and
builder source-gap capture before paid source enrichment. New architecture lives
in `docs/azure-cloudflare-context-processing-architecture.md`: evaluate Azure
context processing, use Cloudflare D1 only for pipeline SQL state, database-
match before search, ask builders for low-confidence context, re-match, then
search only builder-confirmed source-ready unknowns. First smoke the
missing-field/builder-info review prompts, then plan the Azure/D1 spikes and
finish the manual `/builder/projects` Cloudflare upload smoke.

## Notes

The product should keep using safe wording: AI-assisted, source-backed, and
builder-reviewed. Do not present it as guaranteed legal warranty compliance.

Keep `TESTING_LOG.txt` updated with short manual test requests for Hunter,
especially when work is done while he is on phone and desktop verification will
happen later.
