# OpenAI 100-Item Cost Test Runbook

Use this runbook to measure real extraction cost before committing further to a
backend or AI workflow stack.

## Purpose

The test answers:

- How many OpenAI calls does a 100-row spec need?
- How many tokens does extraction use?
- How many unique identities remain after fingerprinting?
- How many duplicates can be avoided before source search?
- What is the approximate cost per upload, row, and unique identity?

This test currently measures extraction, identity normalization, dedupe
telemetry, matching/cache hits, and UI reporting. It does not yet measure real
official-source web search or warranty PDF enrichment.

## Test File

Use:

```txt
docs/demo-assets/100-item-cost-test-spec.csv
```

Regenerate it with:

```powershell
npm.cmd run demo:generate-100-item-spec
```

The file has 100 rows, 20 base product families, intentional duplicates,
late-spec model variants, and one intentional contact/admin row so redaction
telemetry has something meaningful to report.

## Environment

Add these values to `.env.local`:

```txt
OPENAI_API_KEY=
OPENAI_EXTRACTION_MODEL=gpt-5.1-mini
OPENAI_SOURCE_ENRICHMENT_MODEL=gpt-5.4-mini
OPENAI_EXTRACTION_INPUT_COST_PER_1M=
OPENAI_EXTRACTION_OUTPUT_COST_PER_1M=
OPENAI_ENRICHMENT_INPUT_COST_PER_1M=
OPENAI_ENRICHMENT_OUTPUT_COST_PER_1M=
OPENAI_WEB_SEARCH_COST_PER_1K=
ENABLE_DEBUG_COST_TESTS=true
```

Do not paste the API key into chat. Get the input/output rates from the current
OpenAI pricing page before testing if dollar estimates should appear in the UI.
As of 2026-06-20, the OpenAI pricing page lists `gpt-5.4-mini` Standard pricing
at `$0.75` input and `$4.50` output per 1M tokens. Web search pricing should
still be checked live before the full run; put the per-1,000-call rate in
`OPENAI_WEB_SEARCH_COST_PER_1K`.

## Steps

### Quick JSON Test

Use this first when you only want a fast cost read from the controlled fixture:

1. Start the app:

   ```powershell
   npm.cmd run dev
   ```

2. Run:

   ```powershell
   Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3000/api/debug/extraction-cost-test
   ```

3. Record `metrics` from the JSON response.
4. Copy `testingLogTemplate` into `TESTING_LOG.txt` and fill in any manual
   quality notes after reviewing `sampleItems`.

The debug route is guarded by `ENABLE_DEBUG_COST_TESTS=true` and returns 404 in
production. It does not create projects, upload files, publish handovers, or
persist extracted items.

### Source Search And Warranty Cost Test

Use this after the extraction-only run. Start with two unique items so the cost
and output shape are easy to inspect:

```powershell
$body = @{ maxUniqueItems = 2; inspectPdfSources = $true; searchContextSize = "low" } | ConvertTo-Json
$res = Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:3000/api/debug/source-enrichment-cost-test `
  -ContentType "application/json" `
  -Body $body
$res.testingLogTemplate
```

When the sample looks sane, run a larger sample or the full unique set from the
100-item fixture. The route caps `maxUniqueItems` at 40 to prevent accidental
runaway spend:

```powershell
$body = @{ maxUniqueItems = 40; inspectPdfSources = $true; searchContextSize = "low" } | ConvertTo-Json
$res = Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:3000/api/debug/source-enrichment-cost-test `
  -ContentType "application/json" `
  -Body $body
$res.testingLogTemplate
```

This route reruns extraction, dedupes to unique identities, performs one
web-search enrichment call per selected unique item, asks for official source
URLs and warranty/maintenance findings, and inspects at most one direct PDF URL
per item. It filters obvious admin/contact/redacted rows before searching. It
does not persist source records or handover data.

To include AI summarisation of the extracted PDF text, add
`summarizePdfSources = $true`. For larger runs, use `startAtUniqueItem` to split
the work into batches and avoid foreground request timeouts:

```powershell
$body = @{
  maxUniqueItems = 10
  startAtUniqueItem = 0
  inspectPdfSources = $true
  summarizePdfSources = $true
  searchContextSize = "low"
} | ConvertTo-Json
```

### Full UI Test

1. Start the app:

   ```powershell
   npm.cmd run dev
   ```

2. Sign in as the builder test account.
3. Open `/builder/projects`.
4. Open or create a test project.
5. Upload `docs/demo-assets/100-item-cost-test-spec.csv` as a project document.
6. Wait for the extraction job to complete.
7. In the project modal, record the extraction usage metrics shown on the job:
   rows extracted, unique identities, duplicates, cache hits/misses, AI calls,
   AI tokens, and estimated cost.
8. Review extracted items and note obvious extraction misses or bad merges.

## Numbers To Record

Use this checklist in `TESTING_LOG.txt`:

```txt
100-item OpenAI cost test
Date:
Model:
Input file:
Rows expected: 100
Rows extracted:
Unique identities:
Duplicates:
Cache hits:
Cache misses:
OpenAI calls:
OpenAI input tokens:
OpenAI output tokens:
OpenAI total tokens:
Redaction replacements:
Estimated extraction cost:
Estimated cost per row:
Estimated cost per unique identity:
Elapsed time:
Review-needed items:
Failed/malformed items:
Notes:
```

## Expected Result

The extraction should chunk into multiple model calls and merge results into one
job usage report. Because source search is not implemented yet, cache misses do
not trigger web enrichment; they remain review/matching work for later phases.
The fixture should also report redaction replacements because it includes one
intentional PII/admin row.

## Follow-Up Tests

After source search exists, rerun the same 100-item spec in three modes:

- Cache only, no web search.
- One search per unique unknown item.
- Deeper search for selected low-confidence/global-approval items.

That comparison will show whether the $150 project credit model has enough
margin for normal, heavy, and worst-case projects.
