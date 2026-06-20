-- Adds durable extraction usage/cost telemetry fields for existing Supabase
-- projects. The app can already expose usage metrics from audit metadata and
-- local scaffold data; apply this when you want the job row itself to carry the
-- latest cost report.

alter table public.document_extraction_jobs
  add column if not exists usage_metrics jsonb not null default '{}'::jsonb;

alter table public.document_extraction_jobs
  add column if not exists redaction_summary jsonb not null default '{}'::jsonb;

comment on column public.document_extraction_jobs.usage_metrics is
  'Latest extraction usage report: rows, unique identities, duplicates, cache hits, AI calls, tokens, and optional cost estimates.';

comment on column public.document_extraction_jobs.redaction_summary is
  'PII redaction summary captured before extracted text is sent to AI providers.';

