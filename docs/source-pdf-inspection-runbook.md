# Source PDF Inspection Runbook

Use this runbook to test the future warranty/manual source PDF workflow without
committing to Supabase Storage, Cloudflare R2, or a specific search provider.

## Purpose

The source PDF inspector verifies that a candidate official source PDF can be:

- Fetched through server-side `fetch`.
- Checked for basic URL safety.
- Capped by file size.
- Parsed with the existing PDF extractor.
- Hashed by file bytes and extracted text.
- Returned as a structured source record for future admin review.

## Environment

Add this to `.env.local` for local testing:

```txt
ENABLE_DEBUG_COST_TESTS=true
```

The debug route returns 404 in production and when the flag is not enabled.

## Quick Test

Start the app:

```powershell
npm.cmd run dev
```

Run:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:3000/api/debug/source-pdf `
  -ContentType "application/json" `
  -Body '{"url":"https://example.com/warranty.pdf","productName":"Linea Weatherboard","brand":"James Hardie"}'
```

Use a real manufacturer or supplier PDF URL when testing. The route returns a
structured source record with URL, final redirected URL, domain, content type,
byte size, file hash, text hash, extracted text character count, page count,
title, optional identity term check, and warnings.

## Expected Result

For a normal PDF, the response should include:

```txt
source.fileHash
source.textHash
source.extractedTextCharacters
source.pageCount
source.warnings
```

Warnings are acceptable for unusual PDFs, image-heavy PDFs, or URLs that do not
look like warranty/manual/care documents.

## Guardrails

- Private/local hosts are rejected.
- Redirects to private/local hosts are rejected.
- Non-HTTP(S) URLs are rejected.
- Files larger than 25 MB are rejected.
- Optional `productName`, `brand`, `manufacturer`, and `model` hints are checked
  against extracted PDF text and returned as `source.identityCheck`.
- The inspector does not persist the PDF yet.
- Production storage should later write accepted PDFs to private Supabase
  Storage or Cloudflare R2.
