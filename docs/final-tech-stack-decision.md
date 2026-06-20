# Final Tech Stack Decision

This is the settled technical stack for the Builder Handover Portal unless a
future production constraint proves it wrong.

## Decision Summary

Use a hybrid SaaS architecture:

- **Next.js 16 + React + TypeScript** for the product app and portals.
- **Vercel** as the preferred host for the Next.js app.
- **Supabase** as the system of record: Postgres, Auth, RLS, Storage, RPCs, and
  operational database functions.
- **Cloudflare Workers, Queues, Durable Objects, and R2** for durable background
  AI/source-processing work and temporary/cache storage.
- **OpenAI Responses API** for context-first extraction, structured schema
  output, matching assistance, and tightly gated source summarisation.
- **Stripe** for project processing credits and billing.
- **Resend** for transactional email such as client invites.
- **Local scaffold JSON/files** only for development demos and offline fallback.

Do not replace Supabase with Cloudflare D1 as the product database. Cloudflare
can use R2, Queues, Durable Objects, KV, or D1 for pipeline coordination/cache,
but Supabase remains the app database and permission boundary.

## Product Workflow Stack

```txt
Next.js app
-> Supabase project/document/job records
-> local PDF/CSV/OCR text preparation
-> OpenAI context-first schema extraction when enabled
-> Supabase extracted_items + review actions
-> local/global product match cache
-> builder source-gap review
-> optional Cloudflare source-ready dry-run/live batches
-> Supabase reviewed handover_items
-> homeowner portal
```

## Frontend

- Framework: Next.js 16 App Router.
- Language: TypeScript.
- UI: React Server Components by default, Client Components for interactive
  project modals and forms.
- Styling: Tailwind CSS.
- Icons: lucide-react.
- UX direction: spec-upload-first, clean dashboard/workspace UI, review queues
  that make missing fields and source quality visible.

## Product App Backend

- Next.js Server Actions for authenticated mutations.
- Next.js Route Handlers for API contracts, webhooks, debug-only local routes,
  document downloads, and AI endpoints.
- Supabase SSR helpers for auth/session-aware server access.
- Supabase service-role access only where server-side operator or webhook work
  requires it.

## Database And Auth

Supabase owns:

- Organisations, memberships, users, projects, and clients.
- Uploaded documents and extraction jobs.
- Extracted workflow items, matches, review actions, handover items, approvals,
  and audit logs.
- Product identities, product versions, source metadata, missing fields, and
  admin/global approval state.
- Client requests and client portal access.
- Billing credit accounts/events and operator adjustments.

Supabase Auth remains the app auth system. RLS remains the product permission
model.

## File Storage

- Supabase Storage stores tenant-scoped project uploads and client-visible
  handover documents.
- Raw uploaded specs should be private.
- Client document access should go through app routes and signed URLs.
- Cloudflare R2 is reserved for temporary AI pipeline files and source PDF/cache
  objects, not primary user-facing document storage at first.

## AI And Extraction

Use a context-first strategy:

- Extract text/tables/OCR from uploads.
- Send redacted text/rows to OpenAI only when AI extraction is enabled.
- Ask OpenAI for strict structured schema output.
- Store document evidence, missing fields, builder info needed, and context
  classification.
- Classify rows before source enrichment:
  - `source_ready`
  - `builder_input_needed`
  - `project_document`
  - `generic_allowance`
  - `admin_or_contract`
  - `not_handover_relevant`
- Match against local/global product records before any internet/source work.
- Treat unfindable items as builder/admin source gaps.

OpenAI web/source enrichment is not the default path. It should run only for
source-ready unknown identities after dedupe, cache lookup, and cost guards.

## Background Pipeline

Cloudflare owns long-running and bursty source-processing work:

- Workers: public/internal pipeline API.
- Queues: batch source-ready candidates.
- Durable Objects: per-job status and coordination.
- R2: temporary/cache source documents or synthetic cache records.
- KV/D1: optional future lookup/cache indexes only.

The Cloudflare pipeline must stay dry-run until:

- Context-first extraction has been smoke-tested.
- Builder source-gap capture works.
- Progress sync back to Supabase/local records exists.
- Per-job cost/search caps exist.
- Admin/builder review persistence is working.

## Billing

- Sell project-level processing credits, not visible token/search units.
- Stripe Checkout and webhooks handle credit purchases.
- Supabase records credit accounts, ledger events, and manual adjustments.
- Internal metering should track uploads, rows extracted, unique identities,
  source-ready identities, builder-input-needed items, enrichment attempts,
  searches, retries, and published items.

## Email

- Resend handles invite emails and future transactional messages.
- Manual invite links remain available as fallback.
- Do not block the core workflow on email delivery.

## Deployment

Recommended deployment shape:

- Next.js app: Vercel.
- Database/Auth/Storage: Supabase.
- Background source pipeline: Cloudflare Workers/Queues/Durable Objects/R2.
- Domain/DNS/CDN: Cloudflare if desired.
- Payments: Stripe hosted Checkout plus webhook route in Next.js.
- Email: Resend.

This keeps the product app conventional and fast to ship while moving expensive
or long-running source work out of request time.

## What Not To Do

- Do not make Cloudflare D1 the main app database.
- Do not put long source-enrichment batches inside one Next.js request.
- Do not run internet search for every extracted row.
- Do not make manual product creation the primary builder workflow.
- Do not treat builder-supplied/unfindable items as globally approved.
- Do not expose raw AI output, unresolved rows, or missing-field prompts to
  homeowners.
- Do not enable paid live enrichment without explicit caps and review gates.

## Why This Stack Fits

- It preserves the current app and schema work.
- Supabase gives the relational model, RLS, auth, storage, and auditability the
  portal needs.
- Cloudflare gives durable background execution and cheap cache/file primitives
  for source work.
- OpenAI is used where it is strongest: structured understanding and selective
  summarisation, not blind crawling.
- Builders get a usable workflow even when products are not findable online.
- Cost risk is controlled by dedupe, context-first classification, cache lookup,
  builder source-gap capture, and capped enrichment.
