# Builder Handover Portal

AI-assisted digital handover and maintenance portal for NZ builders and homeowners.

The current build is an MVP foundation based on `handover_portal_master_plan.txt`.
It includes the phase 0 setup plus a first working shell for projects, documents,
manual product records, AI review queue, maintenance tasks, client portal preview,
and audit history.

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Environment

Copy `.env.example` to `.env.local` when connecting real services.

Required later:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`

## Current Scope

- Next.js App Router with TypeScript and Tailwind.
- Supabase browser client factory.
- Typed domain models for projects, documents, product versions, maintenance, and audit logs.
- Seed data that mirrors the intended MVP workflows.
- Responsive builder dashboard and homeowner preview.
- Shared builder/client layouts.
- Server-action backed form routes for projects, documents, products, and maintenance.
- Supabase-ready auth middleware and magic-link login scaffold.
- AI product draft endpoint plus live product-form draft preview.
- Specification PDF intake workflow with review pages and AI extraction contract.
- Local specification extraction preview that turns pasted spec text into proposed
  products, documents, and maintenance items.
- Local PDF extraction endpoint that parses selected specification PDFs and
  previews proposed package items.
- Local review-queue persistence for extracted specification proposals.
- Generated handover package preview from accepted extracted items.
- Combined PDF process endpoint that uploads, parses, extracts, and saves review
  proposals in one flow.
- Edit-before-acceptance flow for extracted items.
- Publish flow from builder package preview to client portal.

## Next Build Steps

- Apply `docs/supabase-schema.sql` to Supabase.
- Replace seed data with Supabase reads.
- Connect actual Supabase Storage uploads for documents.
- Improve PDF text/table parsing for uploaded specification PDFs.
- Polish the combined PDF upload/extraction/review UI.
- Add richer extracted-item editing controls and source snippets.
- Connect AI product draft endpoint to source search, extraction, and critic scoring.
- Add invite acceptance and client-specific route protection.
