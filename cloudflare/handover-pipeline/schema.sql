-- Cloudflare D1 pipeline metadata for the Builder Handover Portal.
-- This stores Worker/source-pipeline state only. Supabase remains the product
-- database for auth, tenant permissions, review state, billing, and homeowner
-- publication.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS pipeline_jobs (
  job_id TEXT PRIMARY KEY,
  project_id TEXT,
  status TEXT NOT NULL,
  pipeline_mode TEXT NOT NULL DEFAULT 'dry_run',
  dry_run INTEGER NOT NULL DEFAULT 1,
  candidate_count INTEGER NOT NULL DEFAULT 0,
  batch_count INTEGER NOT NULL DEFAULT 0,
  completed_batch_count INTEGER NOT NULL DEFAULT 0,
  failed_batch_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_project_updated
  ON pipeline_jobs (project_id, updated_at);

CREATE TABLE IF NOT EXISTS pipeline_job_events (
  event_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  batch_index INTEGER,
  message TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES pipeline_jobs (job_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pipeline_job_events_job_created
  ON pipeline_job_events (job_id, created_at);

CREATE TABLE IF NOT EXISTS context_segments (
  segment_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  upload_id TEXT,
  segment_kind TEXT NOT NULL,
  source_page INTEGER,
  source_section TEXT,
  source_snippet TEXT,
  text_hash TEXT,
  confidence REAL,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES pipeline_jobs (job_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_context_segments_job_kind
  ON context_segments (job_id, segment_kind);

CREATE TABLE IF NOT EXISTS identity_lookup_cache (
  identity_fingerprint TEXT PRIMARY KEY,
  normalized_identity TEXT,
  database_match_status TEXT NOT NULL DEFAULT 'unknown',
  approved_product_id TEXT,
  source_cache_key TEXT,
  confidence REAL,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_search_candidates (
  candidate_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  batch_index INTEGER,
  identity_fingerprint TEXT,
  product_name TEXT,
  category TEXT,
  search_query TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  review_reason TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES pipeline_jobs (job_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_source_search_candidates_job_status
  ON source_search_candidates (job_id, status);

CREATE INDEX IF NOT EXISTS idx_source_search_candidates_identity
  ON source_search_candidates (identity_fingerprint);

CREATE TABLE IF NOT EXISTS source_search_results (
  result_id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  source_url TEXT,
  source_domain TEXT,
  source_type TEXT,
  source_title TEXT,
  source_confidence REAL,
  source_summary TEXT,
  source_file_hash TEXT,
  source_text_hash TEXT,
  review_reason TEXT,
  status TEXT NOT NULL DEFAULT 'needs_review',
  payload_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (candidate_id) REFERENCES source_search_candidates (candidate_id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES pipeline_jobs (job_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_source_search_results_candidate
  ON source_search_results (candidate_id);

CREATE TABLE IF NOT EXISTS source_cache_index (
  cache_key TEXT PRIMARY KEY,
  identity_fingerprint TEXT,
  source_url TEXT,
  source_domain TEXT,
  source_file_hash TEXT,
  source_text_hash TEXT,
  r2_object_key TEXT NOT NULL,
  content_type TEXT,
  byte_size INTEGER,
  status TEXT NOT NULL DEFAULT 'stored',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_source_cache_index_identity
  ON source_cache_index (identity_fingerprint);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  idempotency_key TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  job_id TEXT,
  status TEXT NOT NULL,
  response_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_scope_job
  ON idempotency_keys (scope, job_id);

CREATE TABLE IF NOT EXISTS cost_meter_events (
  event_id TEXT PRIMARY KEY,
  job_id TEXT,
  candidate_id TEXT,
  event_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  input_units INTEGER NOT NULL DEFAULT 0,
  output_units INTEGER NOT NULL DEFAULT 0,
  search_count INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd REAL NOT NULL DEFAULT 0,
  dry_run INTEGER NOT NULL DEFAULT 1,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES pipeline_jobs (job_id) ON DELETE SET NULL,
  FOREIGN KEY (candidate_id) REFERENCES source_search_candidates (candidate_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cost_meter_events_job_created
  ON cost_meter_events (job_id, created_at);
