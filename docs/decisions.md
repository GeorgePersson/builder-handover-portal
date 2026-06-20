# Decisions

This file records product and architecture decisions that future agents should preserve unless the user explicitly changes direction.

## Product Decisions

- The builder workflow is spec-upload-first, not manual product-entry-first.
- Manufacturer and supplier are separate concepts.
- AI-extracted information must be reviewable before it becomes client-facing.
- Builder approval can make an item project-safe without making it globally reusable.
- Platform/admin approval is required before new uncertain product facts become reusable global records.
- Quotes can fill missing spec item information and should link back to the relevant item.
- Care and maintenance should prefer product-specific source-backed guidance.
- If product-specific care information is unavailable, provide general safe maintenance advice only with clear fallback/source labelling.
- Multi-unit support should allow base project replication with per-unit changes.
- Client-facing outputs must be clean, simple, and privacy-safe.

## Architecture Decisions

- Supabase remains the system of record for app data, auth, RLS, storage, review state, billing state, and homeowner publication.
- Cloudflare D1 is not the main app database; it may be used later for pipeline SQL state, cache indexes, idempotency, and cost events.
- Cloudflare Worker/Queue/Durable Object/R2 work remains dry-run until source enrichment has explicit caps, review gates, and progress sync.
- OpenAI/source enrichment should run only after context-first extraction, database matching, builder clarification, dedupe, and cost guards.
- Raw uploads are sensitive project documents and should stay tenant-scoped.
- Runtime code should tolerate older Supabase schemas when migrations may not have been applied yet.

## Wording Decisions

- Use "AI-assisted", "source-backed", and "builder-reviewed".
- Do not claim guaranteed legal warranty compliance.
- Do not show raw AI output to homeowners.
