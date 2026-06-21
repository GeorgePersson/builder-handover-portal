# Architecture

This is the compact architecture entrypoint for future agents. Use `docs/technical-architecture-source-of-truth.md` for deeper design rationale and `HANDOFF.md` for latest implementation status.

## Confirmed Stack

- Product app: Next.js 16 App Router, React, TypeScript, Tailwind CSS, lucide-react.
- App host target: Cloudflare Workers/Pages with OpenNext adapter; Vercel is fallback only if a documented Cloudflare blocker appears.
- System of record: Supabase Postgres, Auth, RLS, Storage, and RPCs.
- Local fallback: `.local-data/` JSON stores and `.local-uploads/` files.
- AI: OpenAI structured extraction and selective source summarisation when configured.
- Document context option: LlamaCloud and/or Azure document/context adapters behind server-side provider boundaries.
- Background pipeline: Cloudflare Workers, Queues, Durable Objects, R2, and future D1 pipeline state.
- Billing/email: Stripe and Resend.

## Route Structure

- `/` - portal switchboard.
- `/login`, `/auth/callback`, `/auth/confirm` - auth flow.
- `/admin` - platform admin dashboard.
- `/admin/review` - admin review queues.
- `/admin/products` - global product/source review surface.
- `/admin/billing` - billing/operator controls.
- `/builder` - builder dashboard.
- `/builder/projects` - main project workspace.
- `/builder/specifications` and `/builder/specifications/new` - spec upload and extraction entrypoints.
- `/builder/specifications/review` - extracted item review queue.
- `/builder/specifications/review/[itemId]/edit` - extracted item editing.
- `/builder/handover-package` - package preview and publish flow.
- `/client/portal` - homeowner portal.
- `/client/request-product` - client-safe missing item request.
- `/client/accept-invite` - invite acceptance.

## Important Server Areas

- `src/lib/server/actions.ts` - main mutations and Supabase/local branching.
- `src/lib/server/queries.ts` - read paths and scaffold fallbacks.
- `src/lib/document-workflow.ts` - workflow status/type contracts.
- `src/lib/extraction/outline-spec-schema.ts` - context-first extraction schema.
- `src/lib/server/document-context.ts` - provider selection for document context.
- `src/lib/server/document-extraction.ts` and `src/lib/server/pdf-extract.ts` - text/table/OCR extraction primitives.
- `src/lib/server/product-matching.ts` - product identity and match logic.
- `src/lib/server/extraction-usage.ts` - extraction/source usage metrics.
- `src/lib/server/cloudflare-pipeline.ts` - app-to-pipeline dispatch.
- `cloudflare/handover-pipeline/` - dry-run Worker pipeline scaffold.

## Product Data Flow

1. Project and client records live in Supabase or local scaffold data.
2. Builder uploads a spec, quote, invoice, manual, warranty, supplier schedule, photo, or other project document.
3. The upload creates an uploaded document and extraction job.
4. The document context layer extracts readable text, tables, snippets, and source evidence.
5. Structured extraction creates workflow items with original extracted values, missing fields, context classification, confidence, and source evidence.
6. Matching runs against known product/source records before web/source search.
7. Builder reviews, edits, uploads supporting quotes, approves, excludes, or marks items as builder-supplied.
8. Source-ready unknowns can be sent to the Cloudflare pipeline only when the pipeline URL is configured and the item is appropriate for search.
9. Builder performs final approval and publishes handover items.
10. Client portal reads only published homeowner-safe data.

## Review And Approval Model

- AI output starts as proposed/reviewable, never client-facing by default.
- Known high-confidence matches can become package-ready with minimal builder work.
- New or uncertain global product facts require admin review before reusable approval.
- Builder approval can make an item safe for the project without promoting it globally.
- Final handover approval records the items included/excluded and review counts.

## Privacy Boundary

- Raw uploads are sensitive project documents.
- Client-facing routes should only expose published, homeowner-safe fields.
- Redaction runs before AI calls where practical.
- Source quality, missing fields, and review reasons are builder/admin data.
- Do not claim legal warranty compliance; use builder-reviewed and source-backed language.

## Unknowns And Watchpoints

- Azure document context processing is not settled; it is a spike behind an adapter.
- LlamaCloud integration is active in the current handoff but should be checked against env configuration before relying on it.
- Cloudflare live source enrichment is not enabled; the current Worker is a dry-run scaffold.
- Supabase migrations may be ahead of a deployed database, so runtime code often preserves compatibility with older schemas.
