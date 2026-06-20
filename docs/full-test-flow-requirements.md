# Full Test Flow Requirements

Use this as the setup checklist for testing the Builder Handover Portal end to
end with real backend services.

## Quick Answer

For the full realistic test flow you need:

- Supabase for auth, database, storage, RLS, and project/client data.
- OpenAI API key for real document extraction. Without it, the app falls back to
  the mocked Phase 3 extractor.
- Resend for sending client invite emails. Without it, builders can still copy
  the manual invite link.
- Stripe test mode for project credit checkout. Without it, `test@gmail.com`
  still has unlimited scaffold credits.
- A local `.env.local` file copied from `.env.example`.

Supabase free tier is enough for early testing. Stripe test mode does not charge
real money. Resend usually has a free/dev testing path, but real delivery to
external recipients works best after sender/domain setup. OpenAI API usage
usually needs billing/credits on the OpenAI account.

## Best Setup For A One-Go Local User Demo

For a quick local demo with a potential user, aim for this setup:

- Supabase configured.
- Email/password login enabled.
- Private `handover-documents` bucket created.
- All current Supabase SQL applied.
- `test@gmail.com` builder account onboarded and ready.
- One demo client/homeowner account ready.
- OpenAI key added if you want real extraction.
- Resend skipped unless you specifically want to demo email delivery.
- Stripe skipped unless you specifically want to demo buying credits.

This gives the cleanest demo path:

1. Builder signs in.
2. Builder opens Projects.
3. Builder creates or opens a demo project.
4. Builder uploads a project document.
5. Extraction produces review items.
6. Builder resolves any uncertain items.
7. Builder opens Send package.
8. Builder ticks the approval checkboxes.
9. Builder publishes.
10. Homeowner signs in and sees the published handover.

For this demo, use password login instead of magic links. It avoids email
rate-limits, template issues, and custom SMTP requirements while you are still
testing locally.

### Recommended Demo Accounts

Builder:

```txt
Email: test@gmail.com
Password: testingtest
```

Homeowner/client:

```txt
Email: client-test@example.com
Password: testingtest
```

The exact homeowner email should match the client email on the demo project.
If you use a different client email in the project form, create/sign in with
that same email for the homeowner side.

### Recommended Demo Choices

Use these choices to reduce moving parts:

- Use the manual invite link instead of Resend email delivery.
- Use `test@gmail.com` so project credits are unlimited.
- Keep Stripe off for the first demo.
- Use `docs/demo-assets/bayview-demo-spec.csv` as the first upload file.
- If OpenAI is not configured, tell the user this is the mocked extraction demo.
- If OpenAI is configured, use a short real spec file so extraction finishes
  quickly.

### Demo Upload File

Use this file for the first run:

```txt
docs/demo-assets/bayview-demo-spec.csv
```

It contains a small project schedule with:

- A known James Hardie Linea Weatherboard item for product matching.
- A bathroom extraction fan that may need review.
- A kitchen oven with brand/model details.
- A roofing producer statement document request.
- A garage door maintenance reminder.

Expected result:

- With `OPENAI_API_KEY`, extracted items should reflect the CSV contents.
- Without `OPENAI_API_KEY`, the app still exercises the upload/job/review UI
  through the mock extractor.

For cost testing rather than a quick demo, use:

```txt
docs/demo-assets/100-item-cost-test-spec.csv
```

See `docs/openai-100-item-cost-test-runbook.md` for the exact measurement
steps and numbers to record. The runbook includes a quick guarded debug route
for JSON-only measurement and a full project upload test for UI/runtime
verification.


### Supabase-Mode Smoke Preflight Script

Before opening the browser flow, run the repeatable preflight from the repo root:

```powershell
npm.cmd run supabase:smoke:preflight
```

The script never prints secret values. It loads `.env.local` when present, checks whether the Supabase URL, anon key, and service-role key are configured, verifies the key workflow REST tables plus the private `handover-documents` bucket when secrets are available, and optionally performs password-login automation when these non-committed test variables are set:

```txt
TEST_BUILDER_EMAIL=test@gmail.com
TEST_BUILDER_PASSWORD=testingtest
```

If the script reports missing Supabase secrets in Codex cloud, do not invent them and do not print them. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in that environment, or continue with docs/code-only work. `OPENAI_API_KEY` and/or `LLAMACLOUD_API_KEY` are still needed for realistic extraction of scanned/table-heavy specs; without them, the app can still exercise mocked/local fallback paths.

### Pre-Demo Checklist

Run this before the person is watching:

1. Start the app:

   ```powershell
   npm.cmd run dev
   ```

2. Open `http://127.0.0.1:3000`.
3. Sign in as `test@gmail.com`.
4. Confirm `/builder/projects` loads.
5. Confirm at least one project exists.
6. Confirm the project has a client email you can sign in as.
7. Upload one test document and confirm extraction/review items appear.
8. If using OpenAI, confirm the item text comes from the document rather than
   the mock placeholder.
9. Publish once on a throwaway project to confirm the homeowner portal works.
10. Reset or create a fresh demo project for the actual demo.

### Demo Script

Use this flow while showing the product:

1. Open `/builder/projects`.
2. Open the project.
3. Upload a spec/manual/warranty document.
4. Show the processing/extraction status.
5. Show matched products and uncertain review items.
6. Approve/edit/exclude one item.
7. Open Send package.
8. Show publish blockers if anything is unresolved.
9. Resolve blockers.
10. Tick the final approval checkboxes.
11. Publish.
12. Open the homeowner/client portal.
13. Show that only approved published items are visible.

### Absolute Minimum For A Smooth Demo

If you only set up one thing properly, make it Supabase. The local scaffold is
useful for development, but a potential-user demo should use Supabase so sign-in,
project ownership, storage, client access, review actions, and publish state all
behave like the real product.

## Local App

Required on your machine:

- Node dependencies installed with `npm.cmd install`.
- Dev server started with `npm.cmd run dev`.
- App opened at `http://127.0.0.1:3000`.

Create `.env.local` in the project root and fill values from `.env.example`:

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_EXTRACTION_MODEL=gpt-5.1-mini
RESEND_API_KEY=
RESEND_FROM_EMAIL=Builder Handover <onboarding@resend.dev>
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PROJECT_CREDIT_PRICE_ID=
ADMIN_EMAILS=test@gmail.com
```

Restart the dev server after changing `.env.local`.

## Supabase

Supabase is required for the real multi-user flow:

- Builder sign-in/sign-up.
- Builder organisation membership.
- Project/client records.
- Private document storage.
- Document workflow tables.
- Review/action/audit records.
- Homeowner portal access.
- Final handover approval records.

### Supabase Keys

Add these to `.env.local`:

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Keep `SUPABASE_SERVICE_ROLE_KEY` secret and server-only. Do not paste it into
client-side code or screenshots.

### Supabase SQL

For a fresh Supabase project, run:

1. `docs/supabase-schema.sql`
2. `docs/supabase-bootstrap.sql` after first sign-in, with your builder email
   filled in where the script asks for it.

For an existing Supabase project, also run any migration files that have not
already been applied:

- `docs/supabase-add-builder-workspace-bootstrap.sql`
- `docs/supabase-add-client-extracted-items-policy.sql`
- `docs/supabase-add-client-invite-acceptance.sql`
- `docs/supabase-add-document-download-events.sql`
- `docs/supabase-add-document-workflow-phase1.sql`
- `docs/supabase-add-extraction-usage-metrics.sql`
- `docs/supabase-add-extracted-item-review-reason.sql`
- `docs/supabase-add-handover-approvals.sql`
- `docs/supabase-add-maintenance-completion-policies.sql`
- `docs/supabase-add-organisation-update-policy.sql`
- `docs/supabase-add-project-credits-stripe.sql`

If you are not sure what has been applied, start with a fresh Supabase project
for testing. It is cleaner.

### Supabase Storage

Create a private bucket:

```txt
handover-documents
```

Expected:

- Raw uploaded project files are not public.
- Client downloads go through the app route and short-lived signed URLs.
- Document workflow uploads can be tied back to the project and builder.

### Supabase Auth

Enable email/password auth for easiest local testing.

Add these redirect URLs in Supabase Auth URL settings:

```txt
http://127.0.0.1:3000/auth/callback
http://localhost:3000/auth/callback
```

Magic links can work too, but Supabase can rate-limit them and template editing
may require custom SMTP. Email/password is the easiest path for the current
local test flow.

Recommended test builder:

```txt
Email: test@gmail.com
Password: testingtest
```

This account is treated as unlimited for project credits in the current test
scaffold.

## OpenAI

OpenAI is needed only for real AI extraction.

Add:

```txt
OPENAI_API_KEY=
OPENAI_EXTRACTION_MODEL=gpt-5.1-mini
```

Expected:

- Uploaded PDFs/CSVs are parsed and sent to the OpenAI extraction path.
- Extracted item raw AI output is stored internally only.
- Builder must review uncertain items before publish.
- Homeowners never see raw AI output.

Without `OPENAI_API_KEY`, the app uses the mocked Phase 3 extractor so the UI
can still be tested without spending money.

## Resend

Resend is needed for sending client invite emails from the builder project
workspace.

Add:

```txt
RESEND_API_KEY=
RESEND_FROM_EMAIL=Builder Handover <onboarding@resend.dev>
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
```

Expected:

- Builder can generate a client invite.
- If Resend is configured, the app attempts to email the invite.
- If Resend is not configured or delivery fails, the builder can still copy the
  manual invite link from the UI.

For proper external email testing, use a verified sender/domain in Resend and
set `RESEND_FROM_EMAIL` to that sender. The `onboarding@resend.dev` sender is
only suitable for limited development testing.

## Stripe

Stripe is needed for the project credit purchase flow.

Use Stripe test mode, not live mode.

Add:

```txt
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PROJECT_CREDIT_PRICE_ID=price_...
ADMIN_EMAILS=test@gmail.com
```

Also run:

```txt
docs/supabase-add-project-credits-stripe.sql
```

Use `docs/stripe-billing-runbook.md` for the detailed Stripe flow.

Expected:

- Builder can open Stripe Checkout from Settings.
- Stripe webhook records project credit purchases.
- Creating a non-unlimited builder project consumes one credit.
- `test@gmail.com` can create projects without paying because it is treated as
  unlimited.

If you are only testing upload, AI extraction, review, and homeowner publish,
Stripe can wait.

## Admin Access

Add:

```txt
ADMIN_EMAILS=test@gmail.com
```

Expected:

- Listed emails can use admin-only support surfaces such as billing recovery.
- Admin review/product screens still depend on the user's Supabase visibility
  and RLS policies.

## Minimum Full Test Flow Setup

For the main builder-to-homeowner flow, set up:

1. Supabase env vars.
2. Supabase schema and required migrations.
3. Private `handover-documents` bucket.
4. Supabase Auth redirect URLs.
5. One builder account with organisation onboarding completed.
6. `OPENAI_API_KEY` if you want real extraction instead of mock extraction.

Then test:

1. Sign in as builder.
2. Create or open a project.
3. Upload a project document.
4. Confirm extraction job and extracted items appear.
5. Resolve uncertain builder review items.
6. Open Send package.
7. Confirm final approval checkboxes.
8. Publish.
9. Sign in/open as the invited homeowner.
10. Confirm homeowner sees only approved/published handover data.

Use `docs/hunter-testing-checklist.md` for the exact test steps and expected
results.

## What Can Wait

These are useful but not required for the first full document workflow test:

- Resend, because invite links can be copied manually.
- Stripe, because `test@gmail.com` has unlimited credits.
- Custom Supabase SMTP, because email/password auth avoids magic-link template
  setup while testing.
- Real official web source search, because the current source-enrichment path is
  still scaffolded.
- Production deployment/Vercel, because local testing works at
  `http://127.0.0.1:3000`.

## Copy-Paste Help Prompt For ChatGPT

If you get stuck and want help from normal ChatGPT, paste this prompt and then
add the exact error, screenshot text, or step where you got stuck.

```txt
I am testing a local Next.js 16 app called Builder Handover Portal on Windows.
The project folder is:
C:\Users\hunte\OneDrive\Desktop\TestWebApp

This is not a deployed production app yet. I want to run a smooth local demo
for one potential user.

The app is a builder/homeowner handover portal with:
- Builder portal at http://127.0.0.1:3000/builder/projects
- Homeowner portal at http://127.0.0.1:3000/client/portal
- Login at http://127.0.0.1:3000/login
- Local dev command: npm.cmd run dev
- Main setup doc: docs/full-test-flow-requirements.md
- Manual demo checklist: docs/hunter-testing-checklist.md
- Supabase schema: docs/supabase-schema.sql
- Supabase bootstrap: docs/supabase-bootstrap.sql
- Document workflow migration: docs/supabase-add-document-workflow-phase1.sql
- Extraction usage migration: docs/supabase-add-extraction-usage-metrics.sql
- Final approval migration: docs/supabase-add-handover-approvals.sql
- Stripe details, if needed later: docs/stripe-billing-runbook.md

The intended quick local demo setup is:
- Supabase configured for auth/database/storage.
- Email/password auth enabled.
- Magic links are not required for this demo.
- Private Supabase Storage bucket named handover-documents.
- Builder test account: test@gmail.com / testingtest.
- test@gmail.com has unlimited project credits in the app scaffold.
- One homeowner/client test account whose email matches the project client email.
- OpenAI key is optional. If OPENAI_API_KEY is missing, extraction falls back to
  the mocked Phase 3 extractor.
- Resend can be skipped because manual invite links are available.
- Stripe can be skipped because test@gmail.com has unlimited credits.

My .env.local should contain:
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_EXTRACTION_MODEL=gpt-5.1-mini
RESEND_API_KEY=
RESEND_FROM_EMAIL=Builder Handover <onboarding@resend.dev>
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PROJECT_CREDIT_PRICE_ID=
ADMIN_EMAILS=test@gmail.com

The demo flow I am trying to get working:
1. Start app with npm.cmd run dev.
2. Sign in as builder.
3. Open /builder/projects.
4. Create/open a project.
5. Upload a project document.
6. Confirm extraction job and review items appear.
7. Resolve uncertain review items.
8. Open Send package.
9. Tick final approval checkboxes.
10. Publish.
11. Sign in/open as homeowner.
12. Confirm homeowner sees only approved/published handover items.

Important app behaviour:
- Homeowners must not see raw AI output.
- Homeowners must not see unresolved, excluded, or unpublished items.
- Publishing is blocked while extraction jobs are running/failed or review
  items are unresolved.
- Builder review changes after publish should not silently change the homeowner
  handover until the package is published again.

Please help me troubleshoot step by step. Ask me for the exact error message or
screenshot text if needed. Prefer practical setup/debug instructions over code
changes. Do not assume I am deploying to production; this is a local demo at
http://127.0.0.1:3000.

Here is what I am stuck on:
[PASTE ERROR, SCREENSHOT TEXT, OR STEP HERE]
```

## Common Problems

If builder pages redirect to login:

- Confirm Supabase env vars are present.
- Confirm the dev server was restarted.
- Confirm the account is signed in.

If a signed-in builder sees onboarding or no organisation:

- Complete `/builder/onboarding`, or run `docs/supabase-bootstrap.sql` with the
  correct email.

If uploads fail:

- Confirm `handover-documents` exists and is private.
- Confirm `docs/supabase-add-document-workflow-phase1.sql` has been run.
- Confirm the uploaded file type is supported.

If AI extraction looks mocked:

- Confirm `OPENAI_API_KEY` is present.
- Restart the dev server.
- Check the uploaded file contains extractable text, or try a CSV/PDF with clear
  product lines.

If invite emails fail:

- Confirm `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.
- Use the manual invite link while sender/domain setup is unfinished.

If Stripe credits do not appear:

- Confirm Stripe is in test mode.
- Confirm `STRIPE_WEBHOOK_SECRET`.
- Confirm the Stripe CLI or webhook endpoint is forwarding to
  `/api/billing/webhook`.
- See `docs/stripe-billing-runbook.md`.
