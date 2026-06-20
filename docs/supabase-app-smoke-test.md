# Supabase App Smoke Test

Use this checklist after Supabase credentials have been configured locally or in
the cloud agent environment. It verifies the current Supabase-mode builder flow
without printing secrets.

## Automated Readiness Check

Run:

```bash
npm.cmd run supabase:smoke:app-readiness
```

The check loads `.env.local` or `.env`, then confirms:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
  `SUPABASE_SERVICE_ROLE_KEY` are present.
- The demo upload asset exists at `docs/demo-assets/bayview-demo-spec.csv`.
- Supabase REST can reach the app tables needed for project upload, extraction,
  publish readiness, open/download events, and handover approvals.
- The `handover-documents` Storage bucket exists and is private.

Optional warnings are expected when realistic extraction services are absent:

- `OPENAI_API_KEY` is needed for real structured extraction rather than the
  scaffold/mock extractor.
- `LLAMA_CLOUD_API_KEY` is needed when testing scanned/image-heavy PDFs with the
  LlamaCloud document-context path.

## Manual Supabase-Mode Flow

1. Start the app with Supabase env vars configured.
   - Command: `npm.cmd run dev`
   - Expected: Next.js starts at `http://127.0.0.1:3000`.
2. Sign in at `/login`.
   - Preferred repeatable test: password login with `test@gmail.com` if that
     account exists.
   - Magic-link test: request the link, open it in the same browser, and confirm
     `/auth/confirm` or `/auth/callback` returns to the app as an authenticated
     user.
3. Bootstrap or confirm the builder workspace.
   - Open `/builder/projects`.
   - Expected: the builder can see an organisation, at least one project, and
     project credit status. If no workspace exists, complete onboarding or run
     the documented Supabase bootstrap SQL for the chosen builder email.
4. Upload the deterministic demo asset.
   - In the project workspace upload `docs/demo-assets/bayview-demo-spec.csv`.
   - Expected: an `uploaded_documents` row and a `document_extraction_jobs` row
     are created, and extracted review rows appear for known and uncertain
     handover items.
5. Confirm extraction/review queue creation.
   - Open the project review queue and `/builder/specifications/review`.
   - Expected: known matches can become package-ready; uncertain rows remain in
     builder/admin review with source snippets, missing-field reasons, or review
     guidance.
6. Confirm publish-readiness behavior.
   - Try to publish while unresolved or failed workflow items remain.
   - Expected: publish is blocked and the UI explains the blockers.
   - Resolve or approve all required rows, tick the final builder/AI approval
     checkboxes, and publish.
   - Expected: `handover_approvals` records the approval and homeowner-safe data
     becomes visible in `/client/portal` only after publish.
7. Record event checks.
   - Open `/client/portal` as the assigned client/builder and confirm
     `handover_open_events` increments.
   - Download a visible document and confirm `document_download_events` records
     the event.

## Scanned PDF Note

The known real test PDF is scanned/image-heavy. Plain local `pdf-parse` may
extract very little text, so realistic extraction requires LlamaCloud/OCR
configuration. If the PDF is not accessible in the current environment, use
`docs/demo-assets/bayview-demo-spec.csv` for the Supabase-mode smoke and record
that `LLAMA_CLOUD_API_KEY` plus the real PDF are required for the scanned-PDF
follow-up.
