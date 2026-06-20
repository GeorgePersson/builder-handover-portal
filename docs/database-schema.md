# Database Schema

The main schema is `docs/supabase-schema.sql`. Incremental migrations live in `docs/supabase-add-*.sql`. Runtime types are split between `src/lib/types.ts` and `src/lib/document-workflow.ts`.

Supabase is the intended system of record. Local scaffold mode mirrors enough state in `.local-data/` to support development without credentials.

## Current Known Tables And Models

- `organisations`, `organisation_members` - builder company and membership.
- `projects` - core project record; includes parent/replication links.
- `project_replication_batches`, `project_units` - multi-unit and variation scaffold.
- `project_clients`, `client_requests` - homeowner/client access and requests.
- `documents`, `document_download_events`, `handover_open_events` - uploaded or published documents plus client interaction history.
- `uploaded_documents` - project source files used by workflow extraction.
- `document_extraction_jobs` - extraction processing state and usage metrics.
- `specification_uploads` - legacy/compatibility spec upload model.
- `products`, `product_versions`, `product_sources` - global product identity, versions, and source metadata.
- `suppliers` - organisation-scoped supplier records, separate from manufacturer/product identity.
- `source_documents`, `source_document_versions`, `care_guidance_versions` - versioned source, warranty/manual, and care guidance records.
- `supplier_documents` - quote/invoice/supplier document links.
- `project_products`, `maintenance_tasks`, `maintenance_completions` - project-level handover/product/maintenance models.
- `extracted_handover_items` - legacy review item model.
- `extracted_items` - richer document workflow item model.
- `extracted_item_value_history` - original vs edited value audit history.
- `product_matches` - match attempts between extracted rows and products.
- `item_review_actions` - builder/admin review actions.
- `handover_items` - approved package items published to the handover.
- `handover_approvals` - final approval records.
- `audit_events`, `audit_logs` - project and workflow audit trails.

## Core Proposed/Confirmed Data Model

### Project

Represents a build or handover package owned by an organisation. Stores address, client link, status, publication state, and optional parent/replication batch relationships.

### Unit Or Variation

Represents a unit in a multi-unit project or a variation derived from a base project. Current schema scaffolds this with `project_units`, `project_replication_batches`, `projects.parent_project_id`, and replication metadata.

### Spec Document

Stored as `uploaded_documents` with workflow role `specification`, plus a `document_extraction_jobs` row. Older flows may also use `specification_uploads`.

### Quote Document

Stored as `uploaded_documents` with workflow role `quote`, `invoice`, or `supplier_schedule`. Quote references can link to a parent extracted item via `parent_extracted_item_id` or `source_quote_document_id`.

### Spec Item

Stored as `extracted_items` in the richer workflow. Important fields include item type, product name, manufacturer, model, supplier, supplier SKU, category, location, quantity, finish, warranty/care text, source evidence, missing fields inside raw data, confidence, match status, and review status.

Legacy/review compatibility also exists in `extracted_handover_items`.

### Manufacturer

Currently stored as text fields on product versions, extracted items, and handover items. Treat it as product identity authority, not the same as a supplier. A dedicated manufacturer table is not confirmed yet.

### Supplier

Stored as `suppliers` plus supplier fields on extracted and handover items. Supplier is where the builder can buy/source the product; it may differ from the manufacturer and can vary by project.

### Item Source/Reference

Stored through source fields on extracted items, `source_documents`, `source_document_versions`, `product_sources`, and source/version ids on handover items. Source references should preserve URL/domain/hash/version and review state where available.

### Care And Maintenance Record

Stored through `care_guidance_versions`, care guidance fields on extracted items, and final care fields on `handover_items`. Guidance source labels include manufacturer, supplier, builder-supplied, general AI, and unknown.

### Review Status/Audit Log

Review state appears on extracted items, item review actions, value history, handover approval records, audit events, and audit logs. Future edits should preserve before/after values and a reviewer reason where practical.

## Schema Rules For Future Agents

- Do not collapse manufacturer and supplier.
- Do not make builder-supplied project facts globally reusable without admin review.
- Keep migrations additive and runtime-tolerant where a deployed Supabase project may not have the newest columns yet.
- Update this file, `docs/architecture.md`, and `HANDOFF.md` when schema meaning changes.
