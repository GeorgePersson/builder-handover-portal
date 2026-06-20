# Product Brief

## Product

Builder Handover Portal is an AI-assisted builder/spec-sheet/warranty-care platform for New Zealand residential builders. It helps builders turn project specifications, quotes, manuals, supplier schedules, warranties, photos, and related documents into a reviewed homeowner handover package.

The app should not behave like a generic product database first. The primary builder workflow is document upload, extraction, review, correction, approval, and publish.

## Users

- Builders and builder admins who manage residential projects.
- Platform admins who review uncertain AI output and approve reusable/global product records.
- Homeowners or clients who receive clean, published handover information.

## Main Builder Workflow

1. Builder creates or opens a project.
2. Builder uploads a specification PDF or supporting project document.
3. The system extracts candidate products, documents, maintenance tasks, source references, and missing fields.
4. Known products are matched against approved records before any source search.
5. Unclear items are shown to the builder for review, edits, quote upload, or more context.
6. Builder confirms what is project-safe and package-ready.
7. Admin/global approval is used only when an item should become reusable across projects.
8. Builder performs final approval and publishes a homeowner-safe handover package.

## Client-Facing Outcome

Clients should see a simple handover portal or export grouped by clear homeowner-facing categories. It should include product identity, location, supplier/manufacturer where useful, documents, warranty/care notes, and maintenance guidance.

Client-facing views must not show raw AI output, unresolved internal review prompts, private project documents, or uncertain source-enrichment notes.

## Review Principle

Builder review is mandatory before publishing. AI can propose, classify, summarise, and flag gaps, but it should not silently decide what becomes client-facing. Confidence, missing fields, source quality, and review reasons should stay visible inside builder/admin workflows.

## Related Docs

- `HANDOFF.md` - latest restart state and next work.
- `docs/phased-work.md` - phase routing for future prompts.
- `docs/architecture.md` - current app structure and data flow.
- `docs/context-first-extraction-and-source-gap-strategy.md` - search-last extraction strategy.
