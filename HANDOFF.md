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
- Magic-link auth redirects through `/auth/callback`, which exchanges the
  Supabase PKCE code for a cookie-backed session before sending users to their
  original route.
- Supabase schema includes `client_requests`, `client_request_type`, and
  `client_request_status` for homeowner request intake and admin triage.
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
- Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to
  `.env.local`.
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

## Next Best Work

1. Apply `docs/supabase-schema.sql` to a Supabase project and add env vars to
   `.env.local`.
2. Continue improving PDF extraction for long, table-heavy specification files:
   tune table extraction and OCR limits against real builder specifications.
3. Replace the deterministic source-enrichment scaffold with a real AI/search
   workflow: official source search, extraction, critic scoring, source storage,
   and admin review for low-confidence records.
4. Tune the PDF intake progress and warning copy against real builder files,
   especially long scanned/image-only specifications and table-heavy schedules.
5. Apply `docs/supabase-add-extracted-item-review-reason.sql` to existing
   Supabase projects so reviewer notes persist remotely, then remove the legacy
   no-column fallback once all environments have the field.
6. Replace `POST /api/ai/product-draft` deterministic enrichment with the real
   source-backed AI/search workflow.
7. Add invite acceptance and client-specific route protection.

## Good Resume Prompt

Continue from `HANDOFF.md`. The current priority is to persist client missing
item requests, route them through AI lookup into admin/global approval or
project-only builder approval, then replace the deterministic source-enrichment
scaffold with real Supabase/OpenAI services.

## Notes

The product should keep using safe wording: AI-assisted, source-backed, and
builder-reviewed. Do not present it as guaranteed legal warranty compliance.
