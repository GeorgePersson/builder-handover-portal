-- Phase 1 document workflow data model.
-- Adds upload, extraction, review, handover, and audit primitives without
-- changing existing app behaviour.

do $$ begin
  create type public.uploaded_document_processing_status as enum ('uploaded', 'processing', 'needs_review', 'package_ready', 'completed', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.document_extraction_job_status as enum ('uploaded', 'queued', 'processing', 'needs_review', 'partially_reviewed', 'package_ready', 'completed', 'failed');
exception when duplicate_object then null;
end $$;

alter type public.uploaded_document_processing_status add value if not exists 'needs_review';
alter type public.uploaded_document_processing_status add value if not exists 'package_ready';
alter type public.document_extraction_job_status add value if not exists 'uploaded';
alter type public.document_extraction_job_status add value if not exists 'needs_review';
alter type public.document_extraction_job_status add value if not exists 'partially_reviewed';
alter type public.document_extraction_job_status add value if not exists 'package_ready';

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

do $$ begin
  create type public.uploaded_document_workflow_role as enum (
    'specification',
    'quote',
    'invoice',
    'supplier_schedule',
    'manual',
    'warranty',
    'photo',
    'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.care_guidance_source_type as enum (
    'manufacturer',
    'supplier',
    'builder_supplied',
    'general_ai',
    'unknown'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.source_review_status as enum (
    'pending',
    'approved',
    'rejected',
    'superseded'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.quote_reference_status as enum (
    'not_applicable',
    'referenced',
    'quote_uploaded',
    'quote_extracted',
    'resolved'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.project_replication_batches (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  source_project_id uuid references public.projects(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  batch_name text not null,
  unit_count integer not null check (unit_count > 0),
  credit_event_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.projects add column if not exists parent_project_id uuid references public.projects(id) on delete set null;
alter table public.projects add column if not exists replication_batch_id uuid references public.project_replication_batches(id) on delete set null;
alter table public.projects add column if not exists unit_label text;
alter table public.projects add column if not exists is_replication_template boolean not null default false;

create table if not exists public.project_units (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  replication_batch_id uuid references public.project_replication_batches(id) on delete set null,
  template_project_id uuid references public.projects(id) on delete set null,
  project_id uuid not null references public.projects(id) on delete cascade,
  unit_label text not null,
  address_override text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (replication_batch_id, unit_label),
  unique (project_id)
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  name text not null,
  contact_name text,
  email text,
  phone text,
  website_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, name)
);

create table if not exists public.source_documents (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  title text not null,
  source_url text,
  source_domain text,
  source_type text not null,
  review_status public.source_review_status not null default 'pending',
  file_hash text,
  text_hash text,
  storage_path text,
  checked_at timestamptz not null default now(),
  detected_effective_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.source_document_versions (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references public.source_documents(id) on delete cascade,
  version_number integer not null,
  source_url text,
  source_domain text,
  file_hash text,
  text_hash text,
  storage_path text,
  checked_at timestamptz not null default now(),
  detected_effective_date date,
  review_status public.source_review_status not null default 'pending',
  change_summary text,
  created_at timestamptz not null default now(),
  unique (source_document_id, version_number)
);

create table if not exists public.care_guidance_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  source_document_version_id uuid references public.source_document_versions(id) on delete set null,
  source_type public.care_guidance_source_type not null default 'unknown',
  source_label text not null,
  guidance_text text not null,
  review_status public.source_review_status not null default 'pending',
  requires_builder_approval boolean not null default true,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

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

alter table public.uploaded_documents add column if not exists workflow_role public.uploaded_document_workflow_role not null default 'specification';
alter table public.uploaded_documents add column if not exists parent_extracted_item_id uuid;

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

alter table public.extracted_items add column if not exists parent_extracted_item_id uuid references public.extracted_items(id) on delete set null;
alter table public.extracted_items add column if not exists source_quote_document_id uuid references public.uploaded_documents(id) on delete set null;
alter table public.extracted_items add column if not exists original_extracted_values jsonb not null default '{}'::jsonb;
alter table public.extracted_items add column if not exists builder_edited_values jsonb not null default '{}'::jsonb;
alter table public.extracted_items add column if not exists item_type public.extracted_item_type not null default 'product';
alter table public.extracted_items add column if not exists manufacturer text;
alter table public.extracted_items add column if not exists ai_suggested_category text;
alter table public.extracted_items add column if not exists builder_approved_category text;
alter table public.extracted_items add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
alter table public.extracted_items add column if not exists supplier_name text;
alter table public.extracted_items add column if not exists supplier_sku text;
alter table public.extracted_items add column if not exists quantity text;
alter table public.extracted_items add column if not exists variant_or_finish text;
alter table public.extracted_items add column if not exists care_guidance_source_type public.care_guidance_source_type not null default 'unknown';
alter table public.extracted_items add column if not exists care_guidance_source_label text;
alter table public.extracted_items add column if not exists care_guidance_review_required boolean not null default false;
alter table public.extracted_items add column if not exists warranty_source_version_id uuid references public.source_document_versions(id) on delete set null;
alter table public.extracted_items add column if not exists manual_source_version_id uuid references public.source_document_versions(id) on delete set null;
alter table public.extracted_items add column if not exists care_guidance_version_id uuid references public.care_guidance_versions(id) on delete set null;
alter table public.extracted_items add column if not exists identity_fingerprint text;
alter table public.extracted_items add column if not exists quote_reference_text text;
alter table public.extracted_items add column if not exists quote_reference_status public.quote_reference_status not null default 'not_applicable';
alter table public.extracted_items add column if not exists source_page text;
alter table public.extracted_items add column if not exists source_section text;
alter table public.extracted_items add column if not exists source_snippet text;

do $$ begin
  alter table public.uploaded_documents
    add constraint uploaded_documents_parent_extracted_item_id_fkey
    foreign key (parent_extracted_item_id)
    references public.extracted_items(id)
    on delete set null;
exception when duplicate_object then null;
end $$;

create table if not exists public.supplier_documents (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete set null,
  project_id uuid not null references public.projects(id) on delete cascade,
  uploaded_document_id uuid references public.uploaded_documents(id) on delete set null,
  source_extracted_item_id uuid references public.extracted_items(id) on delete set null,
  document_role public.uploaded_document_workflow_role not null default 'quote',
  warranty_notes text,
  maintenance_notes text,
  client_visible boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.extracted_item_value_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  extracted_item_id uuid not null references public.extracted_items(id) on delete cascade,
  action_id uuid,
  previous_values jsonb not null default '{}'::jsonb,
  next_values jsonb not null default '{}'::jsonb,
  changed_fields text[] not null default '{}',
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
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

alter table public.handover_items add column if not exists manufacturer text;
alter table public.handover_items add column if not exists ai_suggested_category text;
alter table public.handover_items add column if not exists builder_approved_category text;
alter table public.handover_items add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
alter table public.handover_items add column if not exists supplier_name text;
alter table public.handover_items add column if not exists supplier_sku text;
alter table public.handover_items add column if not exists quantity text;
alter table public.handover_items add column if not exists variant_or_finish text;
alter table public.handover_items add column if not exists care_guidance_source_type public.care_guidance_source_type not null default 'unknown';
alter table public.handover_items add column if not exists care_guidance_source_label text;
alter table public.handover_items add column if not exists warranty_source_version_id uuid references public.source_document_versions(id) on delete set null;
alter table public.handover_items add column if not exists manual_source_version_id uuid references public.source_document_versions(id) on delete set null;
alter table public.handover_items add column if not exists care_guidance_version_id uuid references public.care_guidance_versions(id) on delete set null;

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
alter table public.project_replication_batches enable row level security;
alter table public.project_units enable row level security;
alter table public.suppliers enable row level security;
alter table public.supplier_documents enable row level security;
alter table public.source_documents enable row level security;
alter table public.source_document_versions enable row level security;
alter table public.care_guidance_versions enable row level security;
alter table public.extracted_items enable row level security;
alter table public.extracted_item_value_history enable row level security;
alter table public.product_matches enable row level security;
alter table public.item_review_actions enable row level security;
alter table public.handover_items enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "Members can manage project replication batches" on public.project_replication_batches;
create policy "Members can manage project replication batches"
on public.project_replication_batches for all
using (public.is_org_member(organisation_id))
with check (public.is_org_member(organisation_id));

drop policy if exists "Members can manage project units" on public.project_units;
create policy "Members can manage project units"
on public.project_units for all
using (public.is_org_member(organisation_id))
with check (public.is_org_member(organisation_id));

drop policy if exists "Members can manage organisation suppliers" on public.suppliers;
create policy "Members can manage organisation suppliers"
on public.suppliers for all
using (organisation_id is null or public.is_org_member(organisation_id))
with check (organisation_id is null or public.is_org_member(organisation_id));

drop policy if exists "Members can manage supplier project documents" on public.supplier_documents;
create policy "Members can manage supplier project documents"
on public.supplier_documents for all
using (exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organisation_id)))
with check (exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organisation_id)));

drop policy if exists "Authenticated users can read approved source documents" on public.source_documents;
create policy "Authenticated users can read approved source documents"
on public.source_documents for select
to authenticated
using (review_status = 'approved');

drop policy if exists "Authenticated users can create source documents" on public.source_documents;
create policy "Authenticated users can create source documents"
on public.source_documents for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can read approved source versions" on public.source_document_versions;
create policy "Authenticated users can read approved source versions"
on public.source_document_versions for select
to authenticated
using (review_status = 'approved');

drop policy if exists "Authenticated users can create source versions" on public.source_document_versions;
create policy "Authenticated users can create source versions"
on public.source_document_versions for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can read approved care guidance" on public.care_guidance_versions;
create policy "Authenticated users can read approved care guidance"
on public.care_guidance_versions for select
to authenticated
using (review_status = 'approved');

drop policy if exists "Authenticated users can create care guidance" on public.care_guidance_versions;
create policy "Authenticated users can create care guidance"
on public.care_guidance_versions for insert
to authenticated
with check (true);

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

drop policy if exists "Members can read extracted item value history" on public.extracted_item_value_history;
create policy "Members can read extracted item value history"
on public.extracted_item_value_history for select
using (exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organisation_id)));

drop policy if exists "Members can create extracted item value history" on public.extracted_item_value_history;
create policy "Members can create extracted item value history"
on public.extracted_item_value_history for insert
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
