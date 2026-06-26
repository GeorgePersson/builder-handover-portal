# Product Brief

## Product

Builder Handover Portal is an AI-assisted project handover documentation platform for New Zealand residential builders. It helps builders create a complete project handover package by collecting, organising, reviewing, and publishing the required care instructions, manuals, warranty information, uploaded supporting documents, invoice data, Code of Compliance information, and extra handover notes for each project item.

The app should not behave like a generic product database first, and it must not pretend to know product details the user has not supplied. The primary builder workflow is now project checklist first: create/open a project, manage handover items inside that project, match/search only when enough item identity exists, let the builder manually add/upload missing information, and keep a paper trail for anything accepted incomplete. Document upload/extraction remains a fast way to populate checklist candidates, not a replacement for builder review.

## Users

- Builders and builder admins who manage residential projects.
- Platform admins who review uncertain AI output and approve reusable/global product records.
- Homeowners or clients who receive clean, published handover information.

## Main Builder Workflow

1. Builder creates or opens a project.
2. The project page shows a checklist dashboard of handover items and missing sections.
3. Builder adds items manually, selects database suggestions, or uploads specs/quotes/invoices/manuals/warranties/photos/supporting documents for extraction.
4. Each item tracks editable identity fields: item name, category, brand/manufacturer, model/SKU/product code, supplier, notes, and source evidence.
5. The system checks the approved database/source cache before any web/source search.
6. If a confident match exists, available care/manual/warranty guidance is autofilled but remains editable and `Needs review`.
7. If multiple matches are possible, the builder must choose or provide more detail; the system must not guess.
8. If no match exists and the item has enough identity detail, the system can search for care instructions, manuals, and warranty information, then return results for builder review.
9. If the item is too vague to search, the app marks it `Not enough information to search` and prompts for brand, manufacturer, supplier, model, SKU, invoice/photo/document upload, or manual entry.
10. Builder uploads or enters missing care/manual/warranty/invoice/Code of Compliance information, or explicitly accepts the item incomplete.
11. Builder confirms item completion/incomplete acceptance and then performs final package approval/publish.
12. Admin/global approval is used only when an item should become reusable across projects.

## Client-Facing Outcome

Clients should see a simple handover portal or export grouped by clear homeowner-facing categories. It should include product identity, location, supplier/manufacturer where useful, documents, warranty/care notes, and maintenance guidance.

Client-facing views must not show raw AI output, unresolved internal review prompts, private project documents, or uncertain source-enrichment notes.

## Review Principle

Builder review is mandatory before publishing. AI/database/search can propose, autofill, classify, summarise, and flag gaps, but it should not silently decide what becomes client-facing or mark a handover item complete. Confidence, missing fields, source quality, incomplete-acceptance records, and review reasons should stay visible inside builder/admin workflows.

Completion is explicit: an item is complete only when required care/manual/warranty information and relevant invoice/Code of Compliance/supporting documents are provided and reviewed, manually supplied, or accepted incomplete with an audit trail.

## Related Docs

- `HANDOFF.md` - latest restart state and next work.
- `docs/phased-work.md` - phase routing for future prompts.
- `docs/architecture.md` - current app structure and data flow.
- `docs/context-first-extraction-and-source-gap-strategy.md` - search-last extraction strategy.
- `docs/project-handover-item-documentation-flow.md` - current checklist-first item documentation flow and completion rules.
