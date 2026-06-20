-- Phase 1 document workflow data model.
-- Adds upload, extraction, review, handover, and audit primitives without
-- changing existing app behaviour.

do $$ begin
  create type public.uploaded_document_processing_status as enum ('uploaded', 'processing', 'completed', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.document_extraction_job_status as enum ('queued', 'processing', 'completed', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.extracted_item_match_status as enum ('verified_match', 'needs_review', 'low_confidence', 'unmatched');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.extracted_item_review_status as enum (
    'verified_match',
    'needs_review',
    'low_confidence',
    'unmatched',
    'builder_supplied',
    'edited_by_builder',
    'excluded',
    'approved'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.item_review_action_type as enum (
    'approved_as_correct',
    'edited',
    'supporting_document_uploaded',
    'excluded',
    'marked_builder_supplied'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.uploaded_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  original_filename text not null,
  file_type text,
  mime_type text not null,
  storage_path text not null,
  processing_status public.uploaded_document_processing_status not null default 'uploaded',
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_extraction_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  uploaded_document_id uuid not null references public.uploaded_documents(id) on delete cascade,
  status public.document_extraction_job_status not null default 'queued',
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  retry_count integer not null default 0 check (retry_count >= 0),
  usage_metrics jsonb not null default '{}'::jsonb,
  redaction_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.extracted_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_document_id uuid not null references public.uploaded_documents(id) on delete cascade,
  extraction_job_id uuid references public.document_extraction_jobs(id) on delete set null,
  raw_extracted_data jsonb not null default '{}'::jsonb,
  product_name text,
  brand text,
  model text,
  category text,
  supplier text,
  location text,
  warranty_text text,
  maintenance_text text,
  confidence_score integer not null default 0 check (confidence_score between 0 and 100),
  match_status public.extracted_item_match_status not null default 'unmatched',
  review_status public.extracted_item_review_status not null default 'needs_review',
  matched_product_id uuid references public.products(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  excluded_at timestamptz,
  exclusion_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_matches (
  id uuid primary key default gen_random_uuid(),
  extracted_item_id uuid not null references public.extracted_items(id) on delete cascade,
  matched_product_id uuid references public.products(id) on delete set null,
  match_status public.extracted_item_match_status not null,
  match_confidence_score integer not null default 0 check (match_confidence_score between 0 and 100),
  match_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.item_review_actions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  extracted_item_id uuid not null references public.extracted_items(id) on delete cascade,
  action_type public.item_review_action_type not null,
  action_by uuid references auth.users(id) on delete set null,
  previous_review_status public.extracted_item_review_status,
  next_review_status public.extracted_item_review_status,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.handover_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_extracted_item_id uuid references public.extracted_items(id) on delete set null,
  source_document_id uuid references public.uploaded_documents(id) on delete set null,
  matched_product_id uuid references public.products(id) on delete set null,
  item_type public.extracted_item_type not null default 'product',
  title text not null,
  brand text,
  model text,
  category text,
  supplier text,
  location text,
  warranty_text text,
  maintenance_text text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  detail text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.uploaded_documents enable row level security;
alter table public.document_extraction_jobs enable row level security;
alter table public.extracted_items enable row level security;
alter table public.product_matches enable row level security;
alter table public.item_review_actions enable row level security;
alter table public.handover_items enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "Members can manage uploaded workflow documents" on public.uploaded_documents;
create policy "Members can manage uploaded workflow documents"
on public.uploaded_documents for all
using (exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organisation_id)))
with check (exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organisation_id)));

drop policy if exists "Members can manage document extraction jobs" on public.document_extraction_jobs;
create policy "Members can manage document extraction jobs"
on public.document_extraction_jobs for all
using (exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organisation_id)))
with check (exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organisation_id)));

drop policy if exists "Members can manage workflow extracted items" on public.extracted_items;
create policy "Members can manage workflow extracted items"
on public.extracted_items for all
using (exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organisation_id)))
with check (exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organisation_id)));

drop policy if exists "Members can read workflow product matches" on public.product_matches;
create policy "Members can read workflow product matches"
on public.product_matches for select
using (
  exists (
    select 1
    from public.extracted_items ei
    join public.projects p on p.id = ei.project_id
    where ei.id = extracted_item_id and public.is_org_member(p.organisation_id)
  )
);

drop policy if exists "Members can create workflow product matches" on public.product_matches;
create policy "Members can create workflow product matches"
on public.product_matches for insert
with check (
  exists (
    select 1
    from public.extracted_items ei
    join public.projects p on p.id = ei.project_id
    where ei.id = extracted_item_id and public.is_org_member(p.organisation_id)
  )
);

drop policy if exists "Members can manage workflow review actions" on public.item_review_actions;
create policy "Members can manage workflow review actions"
on public.item_review_actions for all
using (exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organisation_id)))
with check (exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organisation_id)));

drop policy if exists "Project users can read published handover items" on public.handover_items;
create policy "Project users can read published handover items"
on public.handover_items for select
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and p.status = 'published'
      and public.can_access_project(p.id)
  )
);

drop policy if exists "Members can manage handover items" on public.handover_items;
create policy "Members can manage handover items"
on public.handover_items for all
using (exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organisation_id)))
with check (exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organisation_id)));

drop policy if exists "Members can read workflow audit logs" on public.audit_logs;
create policy "Members can read workflow audit logs"
on public.audit_logs for select
using (
  project_id is not null
  and exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organisation_id))
);

drop policy if exists "Members can create workflow audit logs" on public.audit_logs;
create policy "Members can create workflow audit logs"
on public.audit_logs for insert
with check (
  project_id is not null
  and exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organisation_id))
);
