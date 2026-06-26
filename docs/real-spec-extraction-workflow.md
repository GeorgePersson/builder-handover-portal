# Real Spec Extraction Workflow

This workflow is for scanned or large builder specification PDFs, where the
raw extraction can include real products, legal metadata, site services,
allowances, and admin rows in the same document.

## Target Pipeline

1. **Source-quality inspection**
   - Detect selectable text, page count, OCR pages used, recovered OCR
     characters, warnings, and redaction counts.
   - Show a scanned/sparse verdict before the builder waits on a long run.

2. **Full extraction**
   - Extract all candidate workflow rows from the document.
   - Keep source page/snippet evidence where available.
   - Record rows extracted, unique identities, duplicate identities, model
     calls, tokens, elapsed time, and redaction replacements.

3. **Classification gate**
   - Split extracted rows into:
     - `source_ready`
     - `builder_input_needed`
     - `admin_or_fee`
     - `legal_or_contract`
     - `temporary_service`
     - `project_document`
     - `reference_code`
     - `generic_allowance`
     - `client_or_contact`
     - `insufficient_identity`
   - Only `source_ready` rows are eligible for automatic web/PDF source
     enrichment.
   - Builder-input-needed, rejected, or uncertain rows stay visible for
     builder/admin review instead of being discarded.
   - External supplier quote references such as "as per kitchen quote" or
     "as per Superior Kitchens quote" should be classified as `project_document`
     rather than source-enrichable products. The quote itself should not become
     a homeowner handover item, but the builder should be asked to upload the
     quote or provide the exact homeowner-safe products/materials, models,
     warranties, and care details hidden behind it.

4. **Dedupe and cache lookup**
   - Dedupe source-ready rows by product identity fingerprint.
   - Check existing approved/global product and source records before web
     search.
   - Do not pay for enrichment again when the product source version is already
     known.

5. **Builder source-gap resolution**
   - Ask the builder for exact identity, supplier quote, manual, invoice,
     warranty, and care details before spending on search for incomplete rows.
   - Store builder-supplied items as project-specific records.
   - Keep global reuse behind admin review.

6. **Batched source enrichment**
   - Enrich unknown source-ready identities in small batches only after cache
     lookup and builder/context filtering.
   - Start with one low-context web-search pass per identity.
   - Inspect at most one direct source PDF per identity in the first pass.
   - Summarise source PDFs only when the PDF looks relevant.
   - Send low-confidence, generic, or conflicting results to admin review.

7. **Review and publish**
   - Builder reviews unresolved rows, excluded rows, and source findings.
   - Admin/global approval promotes reusable source-backed product records.
   - Published homeowner handovers use only approved homeowner-safe data and
     retain the source version used at publish time.

## Current Real PDF Benchmark

Input file:

```txt
C:\Users\hunte\Downloads\2074 legal signed outline spec.pdf.pdf
```

The file is a scanned/image-heavy PDF. Selectable text is effectively absent,
so OCR dominates the extraction runtime.

All-page OCR extraction/classification pass:

```txt
Rows extracted: 321
Extracted unique identities: 291
Duplicate identities: 30
Source-enrichable unique identities: 181
Extraction calls: 81
Extraction input tokens: 30,295
Extraction output tokens: 15,582
Extraction total tokens: 45,877
Document text characters: 49,285
Redaction replacements: 3
Elapsed extraction ms: 211,267
```

Previous 20-page OCR extraction/classification pass:

```txt
Rows extracted: 156
Extracted unique identities: 149
Duplicate identities: 7
Source-enrichable unique identities: 118
Extraction calls: 47
Extraction input tokens: 16,868
Extraction output tokens: 7,963
Extraction total tokens: 24,831
Document text characters: 24,546
Redaction replacements: 2
Elapsed extraction ms: 112,350
```

Latest 5-source-item sample with source PDF inspection and PDF summarisation:

```txt
Rows extracted: 152
Extracted unique identities: 149
Duplicate identities: 3
Source-enrichable unique identities: 126
Source identities enriched: 5
Web search calls: 18
Source PDFs inspected: 4
Source PDF failures: 1
Source PDF summary calls: 3
Source enrichment input tokens: 91,100
Source enrichment output tokens: 3,524
Source enrichment total tokens: 94,624
Elapsed extraction ms: 113,968
Elapsed source ms: 41,558
```

Latest 10-source-item all-page batch with source PDF inspection and PDF
summarisation:

```txt
Rows extracted: 330
Extracted unique identities: 300
Duplicate identities: 30
Source-enrichable unique identities: 185
Extraction calls: 81
Extraction input tokens: 30,295
Extraction output tokens: 15,740
Extraction total tokens: 46,035
Document text characters: 49,285
Redaction replacements: 3
Source identities enriched: 10
Web search calls: 37
Source PDFs inspected: 7
Source PDF failures: 2
Source PDF summary calls: 5
Source enrichment input tokens: 170,489
Source enrichment output tokens: 5,876
Source enrichment total tokens: 176,365
Elapsed extraction ms: 210,036
Elapsed source ms: 88,236
```

Source quality notes from the 10-item batch:

- High-confidence examples: VENT VB20 cavity batten/vermin strip, Rinnai 180L
  mains-pressure hot water cylinder, and Newline DryFit shower.
- Review-needed examples: generic builder-range tiles were blocked because no
  official source or exact product identity was found; generic downlights were
  medium confidence because the search could only match category-level sources.
- Linear projection to the 185 source-ready identities is about 685 web
  searches, 130 PDF inspections, 93 PDF summaries, 3.15M source input tokens,
  and 108.7K source output tokens. Using the earlier rough `gpt-5.4-mini`
  Standard token rates plus an assumed $10/1K web-search price, the full list is
  roughly $9.70 before retries, persistence, and background infrastructure.

Good source-backed examples from the sample:

- Rheem/Zip-style 180L mains pressure electric hot water source PDF.
- Elementi Uno shower mixer source PDF.
- BRANZ appraisal PDF for damp proof membrane/slab context.

Review-needed examples:

- Generic cavity batten/vermin strip with no exact brand/model.
- Generic raft/concrete slab rows where the exact proprietary system is not
  known.

## Next Test Sequence

Run these in order before attempting a full all-candidate source enrichment run.

1. **All-page extraction only**

   Use OCR over the whole scanned PDF, with no web search. This has been run
   once and produced the all-page numbers above. Rerun after classifier or OCR
   changes:

   ```powershell
   $body = @{
     filePath = 'C:\Users\hunte\Downloads\2074 legal signed outline spec.pdf.pdf'
     ocrMaxPages = 40
     runSourceEnrichment = $false
   } | ConvertTo-Json

   $res = Invoke-RestMethod `
     -Method Post `
     -Uri http://127.0.0.1:3000/api/debug/local-document-cost-test `
     -ContentType "application/json" `
     -Body $body

   $res.testingLogTemplate
   $res.sourceCandidateBreakdown.countsByClassification
   ```

2. **Small source batch**

   Use 5-10 source-ready identities, including PDF inspection and summaries:

   ```powershell
   $body = @{
     filePath = 'C:\Users\hunte\Downloads\2074 legal signed outline spec.pdf.pdf'
     ocrMaxPages = 40
     runSourceEnrichment = $true
     maxUniqueItems = 5
     startAtUniqueItem = 0
     inspectPdfSources = $true
     summarizePdfSources = $true
     searchContextSize = 'low'
   } | ConvertTo-Json
   ```

3. **Batch through the source-ready list**

   The first all-page 10-item batch has been run from `startAtUniqueItem=0`.
   Continue from `startAtUniqueItem=10` in batches of 10. Keep `maxUniqueItems`
   small until cache lookup, exact product identity handling, and review-needed
   quality are stable.

4. **Only then project full-run cost**

   Use sampled cost per source-ready identity multiplied by the source-ready
   unique count. Avoid a full 100+ identity source run until the cache and
   review rules are persistent.
