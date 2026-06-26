# Project Handover Item Documentation Flow

Date: 2026-06-22

## Product Pivot

The Builder Handover Portal is now anchored around a project-scoped handover checklist. The system helps builders collect, organise, review, and publish the required documentation for each project item. It is a support tool, not a magic product-identification engine.

The app should help collect or manage:

- Care instructions.
- Product manuals.
- Warranty information.
- Uploaded supporting documents.
- Invoice data.
- Code of Compliance information where relevant.
- Extra handover notes and documents.

The system must not pretend to know product details that the user did not provide. It can search the product database, source cache, or web/source pipeline only when the item has enough identifying detail to make the search reasonable.

## Non-Negotiable Principle

If the user does not provide enough information, the system must say that clearly and give them practical choices:

- Add missing item identity details.
- Upload the manual, warranty, invoice, Code of Compliance, photo, supplier document, or other handover document manually.
- Enter care/warranty/manual notes manually.
- Use a clearly labelled generalised database entry where appropriate.
- Accept the current incomplete status.
- Edit or override any autofilled information.

The system must never mark an item complete just because some data was found. Completion is builder/user-reviewed.

## Main Project Page

All primary work should happen inside `/builder/projects` and eventually project-specific URLs under `/project/...` or an equivalent project route. The main project page should act as a checklist dashboard for handover items.

The dashboard must show every handover item and its current state, including states such as:

- `Complete`
- `Needs review`
- `Missing manual`
- `Missing care instructions`
- `Missing warranty information`
- `Missing invoice information`
- `Missing Code of Compliance information`
- `Not enough information to search`
- `User accepted incomplete`
- `Documents uploaded manually`

The builder should be able to open each item and review, edit, upload, search, retry, accept incomplete, or mark complete.

## Per-Item Required Fields

Each project handover item should support these editable fields:

- Item name.
- Category.
- Brand / manufacturer.
- Model / SKU / product code.
- Supplier.
- Care instructions.
- Manual document or link.
- Warranty information and/or warranty document.
- Invoice information and/or invoice upload.
- Code of Compliance information and/or upload where relevant.
- Uploaded handover documents.
- Extra notes / supporting information.
- Incomplete acceptance reason and timestamp, if the user accepts missing information.

Database or AI/source-filled values are suggestions only. They must remain editable and reviewable.

## Database Autocomplete And Matching

When the user starts typing an item name, the app should search approved product/database records first.

Expected behaviour:

1. Show autocomplete suggestions when possible.
2. Display brand, model, category, confidence, and available documents for likely matches.
3. Never choose between similar items automatically when confidence is ambiguous.
4. If the user selects a database item, autofill available identity, care, manual, source, and warranty guidance fields.
5. If no concrete warranty document exists, general warranty guidance is allowed only when clearly labelled as general guidance, not the builder-specific warranty document.
6. Builder-specific warranty documents remain uploadable and should be preferred for project completion.

## Search Eligibility Rule

The app should only run source/web search when there is enough identity detail to reasonably identify the item.

Usually enough detail means one or more of:

- Brand/manufacturer plus model/product name.
- Brand/manufacturer plus SKU/product code.
- Supplier plus supplier SKU/product code.
- Product category plus specific product name and enough distinguishing details.
- A document/photo/invoice with extractable identity detail.

Not enough detail examples:

- `tapware`
- `oven`
- `tiles`
- `Fisher oven` where multiple Fisher & Paykel ovens are plausible and no model/code is supplied.

For not-enough-detail items, status should be explicit and actionable, not a silent failure.

## Required User Flows

### Flow 1: New Item With Enough Information To Search

1. User creates a new item in the project checklist.
2. App checks the approved product database/source cache first.
3. If no confident match exists, app checks whether the item has enough searchable identity detail.
4. If searchable, app starts a source search for care instructions, manuals, and warranty information.
5. Results return in a review modal with source/confidence information where available.
6. User can accept, edit, replace, reject, upload manually, or retry.
7. Missing sections remain marked missing.
8. Item stays `Needs review` until user confirms the final state.

### Flow 2: New Item Without Enough Information And Not In Database

1. User creates a vague item.
2. App checks database/autocomplete and finds no confident match.
3. App determines the item lacks enough detail for reliable search.
4. Item is marked `Not enough information to search`.
5. App prompts for brand, manufacturer, supplier, model, SKU/product code, invoice details, photo, or document upload.
6. User can add information and retry, manually enter data, upload documents, create a manual item, or accept incomplete.

### Flow 3: Possible Database Item But Input Is Too Vague

1. User types a vague but suggestive item, such as `Fisher oven`.
2. App shows possible database matches.
3. App does not choose automatically.
4. User selects the correct item, refines search, uploads documents manually, creates a manual item, or accepts incomplete.
5. Once selected, available database information autofills.
6. Item remains `Needs review` until user confirms.

### Flow 4: Database Item With Enough Information

1. User selects a confident database item or the app finds a safe confident match.
2. App autofills available care instructions, manual links/documents, general warranty guidance, and product details.
3. User reviews an item detail modal/screen.
4. User can edit all autofilled fields and upload builder-specific warranty/invoice/Code of Compliance documents.
5. Item becomes complete only once required sections are supplied/reviewed or explicitly accepted incomplete.

## Suggested Modal Flow

### Modal 1: Add Item

Fields:

- Item name.
- Category.
- Brand / manufacturer.
- Model number.
- SKU / product code.
- Supplier.
- Notes.
- Upload supporting document or invoice.

Actions:

- Search database.
- Search for documents.
- Create manual item.
- Cancel.

### Modal 2: Database Match Review

Used when matching database items are found.

Show:

- Suggested database items.
- Brand.
- Model.
- Category.
- Confidence.
- Available care/manual/warranty/source documents.

Actions:

- Select item.
- Keep typing / refine search.
- Create as new manual item.
- Cancel.

### Modal 3: Search Results Review

Used when source search returns possible information.

Show:

- Found care instructions.
- Found manual.
- Found warranty information.
- Missing sections.
- Confidence and source information where available.

Actions:

- Accept.
- Edit.
- Replace.
- Upload manually.
- Retry search.
- Mark incomplete.

### Modal 4: Missing Information Prompt

Used when the system cannot search or cannot complete an item.

Show:

- Missing information.
- Why the system cannot continue reliably.
- What the user can add to improve matching/search.

Actions:

- Add missing information.
- Upload documents manually.
- Create manual item.
- Accept current incomplete state.

## Completion Rules

A project handover item is complete only when one of these is true:

1. Care instructions, manual, and warranty information are provided and reviewed, plus invoice/Code of Compliance requirements are satisfied where relevant.
2. The user manually uploaded or entered the required information.
3. The user accepted the item as incomplete.

Accepted-incomplete items are not the same as fully complete items. They are allowed to proceed only with a clear audit trail, for example:

> User accepted item without manual on 22 June 2026.

## Paper Trail Requirements

For each item, track:

- Whether information was autofilled from the database.
- Whether information came from source/web search.
- Whether information was manually added.
- Whether documents were uploaded.
- Whether the user accepted missing information.
- Date of completion.
- Last edited date.
- Who edited the item.
- Notes/comments.
- Source confidence and source URLs where applicable.

The paper trail is part of the product value: it shows what was provided, what was missing, and what the user knowingly accepted.

## Relationship To Existing Implementation

The current repo already has useful pieces that should be reused:

- `/builder/projects` is the main project workspace and should become the checklist-first surface.
- `uploaded_documents`, `document_extraction_jobs`, `extracted_items`, `product_matches`, `item_review_actions`, `handover_items`, and `audit_logs` already model much of the required workflow.
- Docling/local PDF extraction and OpenAI classification remain useful for extracting item candidates from uploaded specs, invoices, quotes, supplier schedules, manuals, or photos.
- Cloudflare source pipeline work should remain search-last and guarded. It should only run after database matching and only when the item has enough identity detail.
- The client/homeowner portal should only receive reviewed, homeowner-safe handover items.

The pivot is mostly a UX/data-contract shift: projects need explicit checklist item status, per-section completeness, manual upload/manual entry paths, and incomplete-acceptance audit records. Extraction remains a way to populate checklist candidates, not the whole product flow.

## Implementation Direction

Build in this order:

1. Define the project handover item checklist contract and status model.
2. Add local/Supabase persistence for checklist items, required sections, document links, and audit events.
3. Update `/builder/projects` so each project shows a checklist dashboard.
4. Add the Add Item modal and database autocomplete/match review.
5. Add the item detail/review modal with editable sections and manual upload/entry support.
6. Add missing-information prompts and explicit incomplete acceptance.
7. Wire existing extraction output into checklist item creation/review instead of bypassing the checklist.
8. Only then wire source search/search-result review into checklist items, behind the search eligibility rule.
9. Update publish readiness and client portal output to use reviewed checklist completion state.
