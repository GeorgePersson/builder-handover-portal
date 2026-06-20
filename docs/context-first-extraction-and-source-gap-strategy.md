# Context-First Extraction And Source Gap Strategy

This is the preferred product direction before live web search or source PDF
fetching.

## Decision

Use the uploaded project document as the first source of truth. Extract into a
strict handover schema, classify what the document actually provides, ask the
builder for missing information, and only use internet/source enrichment for the
small set of identities that are truly source-ready and still unknown.

This should be faster, cheaper, and easier for builders than trying to source
every extracted row from the internet.

## Why This Is Better

- Most builder specs already contain useful context: schedules, locations,
  section headings, supplier quote references, selections, certificates, and
  maintenance notes.
- Web search is the highest variable cost. It should be a fallback, not the
  default path.
- Many real items are not findable online because they are trade-only,
  discontinued, custom, supplier-quote-based, or described generically.
- Builder-supplied information is acceptable for a project handover when it is
  clearly labelled, reviewed, and approved before publishing.
- Unfindable items are still valuable data. They should become a reviewable
  source-gap registry, not failed extraction noise.

## Proposed Flow

```txt
Upload spec/supporting document
-> extract text, tables, OCR, and section context
-> strict context schema extraction
-> classify rows:
   source_ready
   builder_input_needed
   project_document
   generic_allowance
   admin_or_contract
   not_handover_relevant
-> match against approved/local product database
-> ask builder for missing identity/warranty/care/source details
-> store builder-supplied project information with review metadata
-> admin decides whether it becomes reusable/global product knowledge
-> optional internet/source enrichment only for source-ready unknowns
-> publish only reviewed homeowner-safe handover items
```

## Context Schema Fields

Each extracted workflow item should preserve:

- `itemType`: product, document, or maintenance.
- `productName`, `brand`, `model`, `category`, `supplier`, `location`.
- `warrantyText` and `maintenanceText` only when the document supports them.
- `sourceEvidenceText`: the actual snippet or row that justified the item.
- `missingFields`: fields the app still needs.
- `builderInfoNeeded`: plain-language prompts for the builder.
- `contextClassification`: whether this is source-ready, builder-input-needed,
  a project document, generic allowance, admin/contract text, or not relevant.
- `classificationReason`: why it landed in that path.

## Product Vs Admin/Service Guardrails

Large scanned outline specs can contain many legal, site-management, service,
and contract rows that are useful project context but are not homeowner
handover items. Extraction should keep those rows away from source enrichment
unless a builder explicitly turns them into package content.

Guardrails:

- Treat legal clauses, preliminaries, payment/variation language, site setup,
  temporary works, inspections, council obligations, and generic workmanship
  requirements as `admin_or_contract` or `not_handover_relevant`.
- Do not run internet/source search for those rows just because OCR extracted
  them as named lines.
- Preserve them as low-confidence/internal review context when useful, so a
  builder can exclude them or convert them into a real document/maintenance row.
- Allow explicit handover evidence to override the guardrail, for example a
  warranty, manual, certificate, maintenance requirement, named manufacturer,
  supplier, model, SKU, finish, colour, or installed fixture/material.
- Keep the final client portal limited to builder-reviewed package content.

## Builder-Supplied And Unfindable Items

If internet/source lookup cannot find a reliable official source, or the item is
not source-ready:

- Ask the builder for exact product/material identity, warranty period,
  maintenance/care requirements, supplier quote, invoice, manual, or photo.
- Store the resolution as project-specific builder-supplied information.
- Keep it eligible for the homeowner handover only after builder final approval.
- Do not promote it to the global product database automatically.
- Record metadata such as `source_lookup_status=builder_supplied_unverified` and
  `global_reuse_status=requires_admin_review`.
- Let admin review repeated builder-supplied/source-gap items later and promote
  them only when enough source or operational confidence exists.

The existing stack can support this without a new table at first:

- `extracted_items.raw_extracted_data.contextSchema` stores classification,
  missing fields, evidence, and builder prompts.
- `item_review_actions.metadata` stores source-gap and builder-supplied review
  events.
- `product_versions.missing_fields`, `confidence_label`, and `status` represent
  global records that are not source-backed yet.
- Admin/global approval remains the only reusable-database promotion path.

Add a dedicated source-gap table later only if reporting needs outgrow these
existing records.

## Cost Impact

This should reduce cost materially:

- Extraction remains the primary model cost and is already bounded by chunking.
- Classification and missing-field prompts are included in the extraction call,
  so they do not require separate web calls.
- Search/PDF summarisation becomes opt-in for source-ready unknowns only.
- Generic allowances, external supplier quotes, and custom items become builder
  prompts instead of paid search loops.
- Repeated unfindable items can be cached as source gaps, reducing future wasted
  searches.

The product should meter and show:

- Rows extracted.
- Unique identities.
- Source-ready identities.
- Builder-input-needed items.
- Project-document rows.
- Rejected/non-handover rows.
- Builder-supplied items.
- Optional search/source calls when live enrichment eventually starts.

## Usability Rules

- Use builder-facing language: "Needs builder input", "Upload supplier quote",
  "Add warranty/care details", and "Admin review required for global reuse".
- Avoid telling builders an item "failed" just because it is not online.
- Keep the review queue focused on the next decision: approve, edit, attach
  evidence, mark builder-supplied, or exclude.
- Homeowners should never see unresolved rows, raw extraction JSON, missing-field
  prompts, source lookup failures, or admin review metadata.
