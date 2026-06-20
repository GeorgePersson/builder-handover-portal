# Supabase App Smoke Test

Use this checklist to run the first Supabase-mode browser smoke for the Builder Handover Portal without exposing secrets in agent logs.

## Scope

This smoke verifies the current core app path:

1. Magic-link login.
2. Builder workspace bootstrap.
3. Project creation/opening.
4. Project document/spec upload.
5. Extraction job and review queue creation.
6. Publish-readiness blocking while workflow items are unresolved.
7. Builder approval and homeowner/client portal visibility after publish.

## Secret Handling

Do not print or paste Supabase keys, magic-link URLs, access tokens, service-role keys, direct Postgres URLs, LlamaCloud keys, or OpenAI keys into chat, screenshots, docs, or test logs.

Codex cloud may not have local Hermes secrets. If secrets are missing, run only the readiness check and docs/code-safe checks, then record the missing secret names:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `LLAMACLOUD_API_KEY` for realistic scanned/image-heavy PDF extraction
- `OPENAI_API_KEY` when using OpenAI-backed extraction rather than fallback/mock behavior

## Readiness Command

Run:

```bash
npm run supabase:smoke:readiness
```

The command checks whether required environment variables are present in the process or `.env.local`, verifies the local smoke fixtures and relevant app files exist, and prints the manual checklist. It intentionally does not contact Supabase and does not print secret values.

## Recommended Test Asset

Use the repo fixture when the local scanned PDF is unavailable from Codex cloud:

```txt
docs/demo-assets/bayview-demo-spec.csv
```

The user-provided real PDF at `C:\Users\hunte\Downloads\2074 legal signed outline spec.pdf.pdf` is scanned/image-heavy. Plain local `pdf-parse` sees very little text, so use it only when LlamaCloud/OCR is configured. Without LlamaCloud/OCR, prefer the repo fixture for repeatable app workflow testing and document that realistic extraction remains unverified.

## Browser Smoke Steps

1. Start the app:

   ```bash
   npm run dev
   ```

2. Open `http://127.0.0.1:3000/login`.
3. Enter the builder test email and request a magic link.
4. Complete the magic-link flow locally without copying the link or token into logs.
5. Confirm the builder lands on `/builder/onboarding` or `/builder/projects`.
6. If onboarding appears, complete the builder workspace setup and confirm the `ensure_builder_workspace` path succeeds.
7. Open or create a project from `/builder/projects`.
8. Upload `docs/demo-assets/bayview-demo-spec.csv` through the project document upload flow. If testing the specification-PDF-only endpoint, use a real PDF fixture and note whether LlamaCloud/OCR is configured.
9. Confirm the project shows an uploaded document and an extraction job.
10. Confirm review items appear with evidence/review reasons and are not immediately homeowner-facing.
11. Attempt to publish before resolving blockers. Expected result: publish is blocked by workflow readiness.
12. Resolve or approve the review items as the builder.
13. Complete the final builder approval checkboxes and publish.
14. Sign in as the matching client/homeowner email and open `/client/portal`.
15. Confirm only approved and published package information is visible.

## Data Checks After Browser Smoke

When Supabase secrets are available, verify rows exist for the smoke project without printing returned secret-bearing config:

- `uploaded_documents`
- `document_extraction_jobs`
- `extracted_handover_items` or workflow handover item records used by the current upload path
- `handover_approvals` after publish
- `handover_open_events` after opening the client portal

## Expected Limitations

- Magic-link delivery depends on Supabase Auth email configuration and may hit provider/rate limits.
- Resend is not required for this smoke unless testing client invite email delivery.
- Stripe is not required for this smoke; use the existing test builder credit bypass where available.
- LlamaCloud/OCR is required for a realistic pass with the scanned/image-heavy PDF.
