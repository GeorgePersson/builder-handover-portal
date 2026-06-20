# Cloudflare Pipeline Runbook

This runbook connects the Builder Handover Portal to a free-tier-safe
Cloudflare background pipeline scaffold.

The first version is intentionally dry-run only. It creates jobs, splits source
enrichment candidates into queue batches, stores job progress in a Durable
Object, and consumes queue messages without calling OpenAI or web search.
There is no config switch that enables live source enrichment yet.

## What It Uses

- Cloudflare Workers for the HTTP API and queue consumer.
- Cloudflare Queues for source-enrichment batches.
- SQLite-backed Durable Objects for per-job status.
- R2 binding reserved for future source PDF cache storage.
- Optional Cloudflare D1 binding for pipeline SQL metadata. D1 is not the app
  database; Supabase remains the product/auth/review/homeowner source of truth.

The scaffold lives in:

```txt
cloudflare/handover-pipeline/
```

## One-Time Account Setup

Run these from the repo root:

```powershell
npx.cmd wrangler login
npx.cmd wrangler whoami
```

The login command opens Cloudflare in your browser. Use your Cloudflare account
and approve Wrangler.

Create the queue and R2 bucket:

```powershell
npx.cmd wrangler queues create builder-handover-source-enrichment
npx.cmd wrangler r2 bucket create builder-handover-source-cache
```

Optional D1 setup for pipeline metadata:

```powershell
npx.cmd wrangler d1 create builder-handover-pipeline
```

Copy the returned `database_id` into `cloudflare/handover-pipeline/wrangler.jsonc`
as a `d1_databases` binding named `PIPELINE_DB`, then apply the schema:

```powershell
npx.cmd wrangler d1 execute builder-handover-pipeline --local --file cloudflare/handover-pipeline/schema.sql
```

For public deployment, run the same command without `--local` only after you are
ready to create/update the real Cloudflare D1 database:

```powershell
npx.cmd wrangler d1 execute builder-handover-pipeline --file cloudflare/handover-pipeline/schema.sql
```

The schema stores only pipeline-safe state: jobs, job events, context segments,
source candidates/results, source cache indexes, idempotency keys, and cost
events. Do not store raw project PDFs or homeowner-facing product truth in D1.

Optional but recommended before any public deploy:

```powershell
npx.cmd wrangler secret put PIPELINE_SHARED_SECRET --config cloudflare/handover-pipeline/wrangler.jsonc
```

Do not paste that secret into chat or commit it to the repo.

## Local Dev

In `.env.local`, point the Next.js app at the local Worker:

```txt
CLOUDFLARE_PIPELINE_URL=http://127.0.0.1:8787
```

Leave `CLOUDFLARE_PIPELINE_SHARED_SECRET` blank for local dry-run testing unless
you also start the Worker with a matching `PIPELINE_SHARED_SECRET`.

Start the Worker locally:

```powershell
npx.cmd wrangler dev --config cloudflare/handover-pipeline/wrangler.jsonc
```

By default, Wrangler local development uses local/simulated bindings for
resources such as R2. Keep it this way for the dry-run scaffold. Do not enable
remote bindings until the pipeline needs to test against real Cloudflare
resources.

Smoke test health:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/health
```

Create a dry-run job:

```powershell
$body = @{
  jobId = "local-test-001"
  projectId = "demo-project"
  sourceCandidates = @(
    @{
      fingerprint = "demo-001"
      productName = "Rinnai 180L mains pressure hot water cylinder"
      category = "Hot water"
    },
    @{
      fingerprint = "demo-002"
      productName = "VENT VB20 cavity batten"
      category = "Cavity batten"
    }
  )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8787/jobs `
  -ContentType "application/json" `
  -Body $body

Invoke-RestMethod http://127.0.0.1:8787/jobs/local-test-001
```

Local queue delivery may wait for the configured `max_batch_timeout` before the
consumer updates the Durable Object. In this scaffold that can mean waiting up
to about 30 seconds before `/jobs/<jobId>` moves from `queued` to `completed`.

Retry failed dry-run batches:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8787/jobs/local-test-001/retry-failed
```

Expected result: only failed batches are requeued, using the candidates already
stored in the job status object. If no failed batches exist, the endpoint
returns `no_failed_batches`.

Run the local module smoke for the failure and retry path:

```powershell
npm.cmd run cloudflare:smoke:retry
```

Expected result: the script imports the Worker, mocks the Queue and Durable
Object, forces batch 0 to fail once, retries exactly that failed batch with
`retryAttempt=1`, then confirms the retry completes with dry-run results. This
does not start Wrangler, call public Cloudflare, write R2, call OpenAI, or use
web search.

Smoke test the synthetic R2 cache path locally:

```powershell
$body = @{ jobId = "local-r2-smoke-001" } | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8787/cache/smoke `
  -ContentType "application/json" `
  -Body $body
```

Expected result: the Worker writes and reads one tiny synthetic JSON metadata
object through the `SOURCE_PDF_BUCKET` binding. In local Wrangler mode this uses
local simulated R2 storage, not the real Cloudflare bucket. Do not call the
deployed `/cache/smoke` endpoint until you intentionally want to write a small
test object to the real R2 bucket.

If `PIPELINE_SHARED_SECRET` is set, include:

```powershell
-Headers @{ Authorization = "Bearer <your-secret>" }
```

## Deploy

Deploy the dry-run Worker:

```powershell
npx.cmd wrangler deploy --config cloudflare/handover-pipeline/wrangler.jsonc
```

Then test the deployed health URL shown by Wrangler:

```powershell
Invoke-RestMethod https://builder-handover-pipeline.<your-subdomain>.workers.dev/health
```

For public-domain dry-run testing, update `.env.local`:

```txt
CLOUDFLARE_PIPELINE_URL=https://builder-handover-pipeline.<your-subdomain>.workers.dev
CLOUDFLARE_PIPELINE_SHARED_SECRET=<the same secret you set with wrangler>
```

Restart the Next.js dev server after changing `.env.local`.

## App Workflow Smoke

With the Worker running locally or deployed publicly:

1. Start the Next.js app.
2. Upload a supported project document from `/builder/projects`.
3. Wait for extraction to complete.
4. Reopen the project modal and check the upload processing card.
5. Confirm it shows source-ready identity counts and `Cloudflare dry-run`.
6. Click `Refresh pipeline status` after the Worker queue has had time to
   process the batch, then refresh the page and confirm the stored status
   remains visible.
7. If a dry-run failure scenario is configured and failed batches are present,
   click `Retry failed batches`, then refresh status again after the retry queue
   processes.
8. Open the Worker job URL from the runbook pattern if you need raw status:
   `/jobs/<document_extraction_job_id>`.

Expected result: the app queues a dry-run Cloudflare job and records the status
in extraction job usage metrics. Refresh and retry actions update those stored
usage metrics. The flow should not call OpenAI source enrichment, web search,
crawling, R2 source writes, or live source PDF fetching.

If `PIPELINE_DB` is configured and `schema.sql` has been applied, the Worker
also mirrors dry-run job metadata into D1 using prepared statements:

- `pipeline_jobs`
- `pipeline_job_events`
- `source_search_candidates`
- `cost_meter_events`

Without the binding, `/health` reports `d1Configured: false` and the Worker
continues using Durable Object status only.

When running this smoke without paid services, start the Next.js app in a local
scaffold environment or remove paid/service keys from the process. If
`.env.local` contains Supabase and OpenAI keys, `next dev` will use them by
default.

## Next Build Steps

1. Run the app workflow smoke from `/builder/projects` against the public
   dry-run Worker URL now stored in `.env.local`.
2. Run the failing dry-run UI smoke from `/builder/projects` and confirm the
   app-side retry button reflects the local module smoke behavior.
3. Replace dry-run queue processing with a one-candidate live pilot only after
   cost guards are implemented.
4. Add cost guards before enabling live OpenAI/web-search calls.
