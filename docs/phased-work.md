# Phased Work

Use this as the simple routing map for future Codex prompts. The fuller active roadmap remains in `docs/implementation-phases.md`; this file is the stable product-memory index.

## Phase 1 - Core Project And Handover Checklist

Goal: builders can create/open a project and manage a checklist of required handover items inside the project. Each item tracks identity, care instructions, manuals, warranty information, invoices, Code of Compliance information, uploaded supporting documents, notes, completion state, and audit trail.

Current state: project workspace, upload/document records, extraction jobs, review actions, and handover item scaffolding exist. The next product pivot is to make `/builder/projects` checklist-first rather than spec-upload-first, while still allowing specs and supporting documents to populate checklist candidates.

Prompt routing: project setup, checklist dashboard, add-item modal, item detail/review modal, item completion states, manual entry/upload paths, incomplete acceptance, document records, local scaffold persistence.

## Phase 2 - Item Extraction And Categorisation

Goal: extract candidate handover items and supporting evidence from uploaded specs, quotes, invoices, manuals, warranties, supplier schedules, photos, and other documents, then feed those candidates into the project checklist for review.

Current state: implemented with local PDF/text/OCR helpers, OpenAI schema contracts, LlamaCloud adapter work, and context-first classification. The next active spike is Docling local document context on branch `codex/docling-local-context`; see `docs/docling-local-context-plan.md` and `docs/docling-phased-work.md`. Keep LlamaCloud as an optional future comparison provider; do not remove that architecture. Extraction is a checklist-population accelerator, not the completion authority.

Prompt routing: extraction schemas, OCR/table parsing, Docling local/VPS provider work, category logic, missing fields, source snippets, confidence scoring, mapping extracted rows into checklist items.

## Phase 3 - Builder Review/Edit Workflow

Goal: builders review, edit, upload documents for, search for, mark complete, exclude, or accept incomplete each project handover item before publish.

Current state: implemented and still being hardened for extracted rows. The project workspace and review/edit forms expose review lanes, original vs edited values, source gaps, and care labels. The pivot requires the same review power for manually created checklist items and database-autofilled items, including explicit missing-manual/care/warranty/invoice/Code-of-Compliance states.

Prompt routing: review queues, item edit forms/modals, completion state machine, audit trail, incomplete acceptance, publish readiness, safe status labels.

## Phase 4 - Supplier Vs Manufacturer Handling

Goal: keep manufacturer/brand/product identity separate from supplier, supplier SKU, and project availability.

Current state: schema/type scaffolding exists. Builder edit flows capture manufacturer, supplier name, supplier SKU, quantity, finish, colour metadata, and approved category.

Prompt routing: supplier records, supplier SKU, product matching, identity fingerprints, manufacturer/source authority.

## Phase 5 - Quote Upload And Item Detail Linking

Goal: when a spec says "as per quote", builders can upload the quote and link it back to the missing item details.

Current state: quote/supplier document roles, parent extracted item links, and quote reference statuses are scaffolded. Quote-like rows should ask for a quote or builder context instead of going straight to source search.

Prompt routing: quote upload action, linked extraction jobs, resolving quote references, source-gap prompts.

## Phase 6 - Care, Manual, Warranty, Invoice, And Compliance Sections

Goal: provide or collect the required handover documentation sections for each item: care instructions, manuals, warranty information, invoice data, Code of Compliance information where relevant, uploaded supporting documents, and notes.

Current state: care text and care guidance source labels exist in workflow types and handover items. Source-backed enrichment is guarded and should remain reviewed. Manual/warranty/invoice/compliance sections need first-class checklist completion states and upload/manual-entry paths. General warranty guidance is allowed only when clearly labelled as general guidance, not as a builder-specific warranty document.

Prompt routing: care guidance labels, manufacturer/supplier/builder/general AI care text, manual/warranty/invoice/compliance fields, document upload links, warranty-safe wording, fallback guidance.

## Phase 7 - Client-Facing Handover View/Export

Goal: publish a clean homeowner-facing portal or export after builder approval.

Current state: `/client/portal` reads published package data and groups items by approved category. Client document visibility and portal open/download events are scaffolded.

Prompt routing: homeowner grouping, document display, export, client access, privacy-safe copy.

## Phase 8 - Multi-Unit Replication And Variations

Goal: replicate a base project for multiple units, then adjust per-unit variations without losing the base handover structure.

Current state: schema contains project replication batches and project units. Workflow/product logic must preserve variation edits rather than overwrite the base blindly.

Prompt routing: base project cloning, unit records, variation diffs, per-unit package readiness.

## Phase 9 - Confidence Scoring, Audit Trail, And AI Review Improvements

Goal: make AI uncertainty visible and auditable across extraction, matching, source enrichment, builder edits, and final approval.

Current state: confidence scores, review reasons, value history, review actions, handover approvals, audit logs, source quality, and usage metrics are partly implemented.

Prompt routing: confidence labels, review reasons, source quality, audit logs, admin review, source enrichment gates.

## Phase 10+ - Durable Source Pipeline And Production Hardening

Goal: move long-running source work into durable background processing while keeping Supabase as product truth.

Current state: see `docs/implementation-phases.md`, `docs/final-tech-stack-decision.md`, and `docs/azure-cloudflare-context-processing-architecture.md`. Cloudflare pipeline work is dry-run until explicit live enrichment phases.

Prompt routing: Cloudflare Worker/Queue/Durable Object/R2/D1 pipeline work, Azure document context spikes, cost guards, progress sync, production deploy.
