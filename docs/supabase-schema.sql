-- Builder Handover Portal MVP schema draft.
-- Apply after creating a Supabase project. Review RLS before production use.

create extension if not exists pgcrypto with schema extensions;

create type public.org_role as enum ('owner', 'builder_admin');
create type public.project_status as enum ('draft', 'in_review', 'published', 'archived');
create type public.product_status as enum ('draft', 'needs_review', 'approved', 'blocked');
create type public.confidence_label as enum ('high', 'medium', 'low', 'blocked');
create type public.document_type as enum (
  'consent',
  'manual',
  'warranty',
  'producer_statement',
  'photo',
  'other'
);
create type public.specification_status as enum ('uploaded', 'extracting', 'needs_review', 'accepted');
create type public.extracted_item_type as enum ('product', 'document', 'maintenance');
create type public.client_request_type as enum ('product', 'document', 'maintenance');
create type public.client_request_status as enum (
  'submitted',
  'ai_checking',
  'admin_review',
  'builder_project_approved',
  'global_approved',
  'rejected'
);
create type public.extracted_item_status as enum (
  'proposed',
  'auto_approved',
  'builder_approved',
  'admin_review',
  'request_more_context',
  'needs_source_document',
  'needs_model_code',
  'global_approved',
  'accepted',
  'edited',
  'rejected'
);
create type public.uploaded_document_processing_status as enum (
  'uploaded',
  'processing',
  'needs_review',
  'package_ready',
  'completed',
  'failed'
);
create type public.document_extraction_job_status as enum (
  'uploaded',
  'queued',
  'processing',
  'needs_review',
  'partially_reviewed',
  'package_ready',
  'completed',
  'failed'
);
create type public.extracted_item_match_status as enum (
  'verified_match',
  'needs_review',
  'low_confidence',
  'unmatched'
);
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
create type public.item_review_action_type as enum (
  'approved_as_correct',
  'edited',
  'supporting_document_uploaded',
  'excluded',
  'marked_builder_supplied'
);
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
create type public.care_guidance_source_type as enum (
  'manufacturer',
  'supplier',
  'builder_supplied',
  'general_ai',
  'unknown'
);
create type public.source_review_status as enum (
  'pending',
  'approved',
  'rejected',
  'superseded'
);
create type public.quote_reference_status as enum (
  'not_applicable',
  'referenced',
  'quote_uploaded',
  'quote_extracted',
  'resolved'
);

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trading_name text,
  contact_email text,
  contact_phone text,
  created_at timestamptz not null default now()
);

create table public.organisation_members (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.org_role not null default 'builder_admin',
  created_at timestamptz not null default now(),
  primary key (organisation_id, user_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  parent_project_id uuid references public.projects(id) on delete set null,
  replication_batch_id uuid,
  unit_label text,
  is_replication_template boolean not null default false,
  name text not null,
  address text not null,
  project_type text not null,
  status public.project_status not null default 'draft',
  handover_date date,
  published_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_replication_batches (
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

alter table public.projects
  add constraint projects_replication_batch_id_fkey
  foreign key (replication_batch_id)
  references public.project_replication_batches(id)
  on delete set null;

create table public.project_units (
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

create table public.project_clients (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  invite_token_hash text,
  invited_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.client_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  request_type public.client_request_type not null default 'product',
  title text not null,
  location text,
  details text,
  attachment_name text,
  attachment_storage_path text,
  status public.client_request_status not null default 'admin_review',
  confidence_score integer not null default 0 check (confidence_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  uploaded_by uuid references auth.users(id),
  name text not null,
  document_type public.document_type not null default 'other',
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  visible_to_client boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.document_download_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  downloaded_by uuid references auth.users(id) on delete set null,
  user_agent text,
  downloaded_at timestamptz not null default now()
);

create table public.handover_open_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  opened_by uuid references auth.users(id) on delete set null,
  first_opened_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  open_count integer not null default 1 check (open_count >= 1),
  user_agent text,
  unique (project_id, opened_by)
);

create table public.uploaded_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  original_filename text not null,
  file_type text,
  mime_type text not null,
  storage_path text not null,
  workflow_role public.uploaded_document_workflow_role not null default 'specification',
  parent_extracted_item_id uuid,
  processing_status public.uploaded_document_processing_status not null default 'uploaded',
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_extraction_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  uploaded_document_id uuid not null references public.uploaded_documents(id) on delete cascade,
  status public.document_extraction_job_status not null default 'uploaded',
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  retry_count integer not null default 0 check (retry_count >= 0),
  usage_metrics jsonb not null default '{}'::jsonb,
  redaction_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.specification_uploads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  uploaded_by uuid references auth.users(id),
  file_name text not null,
  storage_path text not null,
  status public.specification_status not null default 'uploaded',
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  brand text,
  manufacturer text,
  category text,
  created_at timestamptz not null default now()
);

create table public.suppliers (
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

create table public.product_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  version_number integer not null,
  status public.product_status not null default 'draft',
  warranty_period text,
  warranty_start_condition text,
  warranty_exclusions text,
  void_conditions text,
  maintenance_requirements text,
  maintenance_frequency text,
  cleaning_instructions text,
  special_conditions jsonb not null default '{}'::jsonb,
  confidence_score integer not null default 0 check (confidence_score between 0 and 100),
  confidence_label public.confidence_label not null default 'low',
  confidence_reasons text[] not null default '{}',
  missing_fields text[] not null default '{}',
  conflicts text[] not null default '{}',
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (product_id, version_number)
);

create table public.product_sources (
  id uuid primary key default gen_random_uuid(),
  product_version_id uuid not null references public.product_versions(id) on delete cascade,
  title text not null,
  url text not null,
  source_type text not null,
  is_official boolean not null default false,
  is_nz_specific boolean not null default false,
  content_hash text,
  storage_path text,
  retrieved_at timestamptz not null default now()
);

create table public.source_documents (
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

create table public.source_document_versions (
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

create table public.care_guidance_versions (
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

create table public.supplier_documents (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete set null,
  project_id uuid not null references public.projects(id) on delete cascade,
  uploaded_document_id uuid references public.uploaded_documents(id) on delete set null,
  source_extracted_item_id uuid,
  document_role public.uploaded_document_workflow_role not null default 'quote',
  warranty_notes text,
  maintenance_notes text,
  client_visible boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.project_products (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  product_version_id uuid not null references public.product_versions(id),
  location text,
  notes text,
  created_at timestamptz not null default now(),
  unique (project_id, product_version_id, location)
);

create table public.maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  product_version_id uuid references public.product_versions(id),
  title text not null,
  description text,
  due_date date not null,
  frequency text,
  required_for_warranty boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.maintenance_completions (
  id uuid primary key default gen_random_uuid(),
  maintenance_task_id uuid not null references public.maintenance_tasks(id) on delete cascade,
  completed_by uuid references auth.users(id),
  completed_at timestamptz not null default now(),
  notes text,
  proof_storage_path text
);

create table public.extracted_handover_items (
  id uuid primary key default gen_random_uuid(),
  specification_upload_id uuid not null references public.specification_uploads(id) on delete cascade,
  client_request_id uuid references public.client_requests(id) on delete set null,
  item_type public.extracted_item_type not null,
  title text not null,
  category text,
  location text,
  extracted_text text,
  source_snippet text,
  source_page integer check (source_page is null or source_page > 0),
  review_reason text,
  matched_existing_record text,
  confidence_score integer not null default 0 check (confidence_score between 0 and 100),
  status public.extracted_item_status not null default 'proposed',
  created_at timestamptz not null default now()
);

create table public.extracted_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_document_id uuid not null references public.uploaded_documents(id) on delete cascade,
  extraction_job_id uuid references public.document_extraction_jobs(id) on delete set null,
  parent_extracted_item_id uuid references public.extracted_items(id) on delete set null,
  source_quote_document_id uuid references public.uploaded_documents(id) on delete set null,
  raw_extracted_data jsonb not null default '{}'::jsonb,
  original_extracted_values jsonb not null default '{}'::jsonb,
  builder_edited_values jsonb not null default '{}'::jsonb,
  item_type public.extracted_item_type not null default 'product',
  product_name text,
  manufacturer text,
  brand text,
  model text,
  category text,
  ai_suggested_category text,
  builder_approved_category text,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text,
  supplier text,
  supplier_sku text,
  location text,
  quantity text,
  variant_or_finish text,
  warranty_text text,
  maintenance_text text,
  care_guidance_source_type public.care_guidance_source_type not null default 'unknown',
  care_guidance_source_label text,
  care_guidance_review_required boolean not null default false,
  warranty_source_version_id uuid references public.source_document_versions(id) on delete set null,
  manual_source_version_id uuid references public.source_document_versions(id) on delete set null,
  care_guidance_version_id uuid references public.care_guidance_versions(id) on delete set null,
  identity_fingerprint text,
  quote_reference_text text,
  quote_reference_status public.quote_reference_status not null default 'not_applicable',
  source_page text,
  source_section text,
  source_snippet text,
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

alter table public.uploaded_documents
  add constraint uploaded_documents_parent_extracted_item_id_fkey
  foreign key (parent_extracted_item_id)
  references public.extracted_items(id)
  on delete set null;

alter table public.supplier_documents
  add constraint supplier_documents_source_extracted_item_id_fkey
  foreign key (source_extracted_item_id)
  references public.extracted_items(id)
  on delete set null;

create table public.extracted_item_value_history (
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

create table public.product_matches (
  id uuid primary key default gen_random_uuid(),
  extracted_item_id uuid not null references public.extracted_items(id) on delete cascade,
  matched_product_id uuid references public.products(id) on delete set null,
  match_status public.extracted_item_match_status not null,
  match_confidence_score integer not null default 0 check (match_confidence_score between 0 and 100),
  match_reason text,
  created_at timestamptz not null default now()
);

create table public.item_review_actions (
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

create table public.handover_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_extracted_item_id uuid references public.extracted_items(id) on delete set null,
  source_document_id uuid references public.uploaded_documents(id) on delete set null,
  matched_product_id uuid references public.products(id) on delete set null,
  item_type public.extracted_item_type not null default 'product',
  title text not null,
  manufacturer text,
  brand text,
  model text,
  category text,
  ai_suggested_category text,
  builder_approved_category text,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text,
  supplier text,
  supplier_sku text,
  location text,
  quantity text,
  variant_or_finish text,
  warranty_text text,
  maintenance_text text,
  care_guidance_source_type public.care_guidance_source_type not null default 'unknown',
  care_guidance_source_label text,
  warranty_source_version_id uuid references public.source_document_versions(id) on delete set null,
  manual_source_version_id uuid references public.source_document_versions(id) on delete set null,
  care_guidance_version_id uuid references public.care_guidance_versions(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.handover_approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz not null default now(),
  handover_version text not null,
  builder_confirmation_text text not null,
  ai_confirmation_text text,
  included_item_ids uuid[] not null default '{}',
  excluded_item_ids uuid[] not null default '{}',
  ai_generated_item_count integer not null default 0 check (ai_generated_item_count >= 0),
  reviewed_item_count integer not null default 0 check (reviewed_item_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  detail text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  detail text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.organisations enable row level security;
alter table public.organisation_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_replication_batches enable row level security;
alter table public.project_units enable row level security;
alter table public.project_clients enable row level security;
alter table public.client_requests enable row level security;
alter table public.documents enable row level security;
alter table public.document_download_events enable row level security;
alter table public.handover_open_events enable row level security;
alter table public.uploaded_documents enable row level security;
alter table public.document_extraction_jobs enable row level security;
alter table public.specification_uploads enable row level security;
alter table public.products enable row level security;
alter table public.product_versions enable row level security;
alter table public.product_sources enable row level security;
alter table public.suppliers enable row level security;
alter table public.supplier_documents enable row level security;
alter table public.source_documents enable row level security;
alter table public.source_document_versions enable row level security;
alter table public.care_guidance_versions enable row level security;
alter table public.project_products enable row level security;
alter table public.maintenance_tasks enable row level security;
alter table public.maintenance_completions enable row level security;
alter table public.extracted_handover_items enable row level security;
alter table public.extracted_items enable row level security;
alter table public.extracted_item_value_history enable row level security;
alter table public.product_matches enable row level security;
alter table public.item_review_actions enable row level security;
alter table public.handover_items enable row level security;
alter table public.handover_approvals enable row level security;
alter table public.audit_events enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organisation_members
    where organisation_id = target_org
      and user_id = auth.uid()
  );
$$;

create or replace function public.can_access_project(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = target_project
      and public.is_org_member(p.organisation_id)
  )
  or exists (
    select 1
    from public.project_clients pc
    where pc.project_id = target_project
      and pc.user_id = auth.uid()
  );
$$;

create or replace function public.accept_project_client_invite(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_project_id uuid;
  v_user_email text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select email into v_user_email
  from auth.users
  where id = auth.uid();

  update public.project_clients
  set
    user_id = auth.uid(),
    accepted_at = now(),
    invite_token_hash = null
  where invite_token_hash = encode(digest(raw_token, 'sha256'), 'hex')
    and accepted_at is null
    and invited_at > now() - interval '14 days'
    and lower(email) = lower(coalesce(v_user_email, ''))
  returning project_id into v_project_id;

  if v_project_id is null then
    raise exception 'invalid_invite';
  end if;

  return v_project_id;
end;
$$;

grant execute on function public.accept_project_client_invite(text) to authenticated;

create or replace function public.ensure_builder_workspace(
  org_name text,
  trading_name text default null,
  contact_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_org_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select organisation_id into v_org_id
  from public.organisation_members
  where user_id = v_user_id
  limit 1;

  if v_org_id is not null then
    return v_org_id;
  end if;

  select email into v_user_email
  from auth.users
  where id = v_user_id;

  if nullif(trim(org_name), '') is null then
    raise exception 'organisation_name_required';
  end if;

  insert into public.organisations (name, trading_name, contact_email, contact_phone)
  values (
    trim(org_name),
    coalesce(nullif(trim(trading_name), ''), trim(org_name)),
    v_user_email,
    nullif(trim(contact_phone), '')
  )
  returning id into v_org_id;

  insert into public.organisation_members (organisation_id, user_id, role)
  values (v_org_id, v_user_id, 'owner');

  return v_org_id;
end;
$$;

grant execute on function public.ensure_builder_workspace(text, text, text) to authenticated;

create policy "Members can read their organisations"
on public.organisations for select
using (public.is_org_member(id));

create policy "Members can update their organisations"
on public.organisations for update
using (public.is_org_member(id))
with check (public.is_org_member(id));

create policy "Users can read their own memberships"
on public.organisation_members for select
using (user_id = auth.uid());

create policy "Members can read projects"
on public.projects for select
using (public.is_org_member(organisation_id));

create policy "Members can manage projects"
on public.projects for all
using (public.is_org_member(organisation_id))
with check (public.is_org_member(organisation_id));

create policy "Members can manage project replication batches"
on public.project_replication_batches for all
using (public.is_org_member(organisation_id))
with check (public.is_org_member(organisation_id));

create policy "Members can manage project units"
on public.project_units for all
using (public.is_org_member(organisation_id))
with check (public.is_org_member(organisation_id));

create policy "Clients can read assigned projects"
on public.projects for select
using (
  exists (
    select 1 from public.project_clients pc
    where pc.project_id = id and pc.user_id = auth.uid()
  )
);

create policy "Project users can read client requests"
on public.client_requests for select
using (public.can_access_project(project_id));

create policy "Clients can create requests on accessible projects"
on public.client_requests for insert
with check (public.can_access_project(project_id));

create policy "Members can manage client requests"
on public.client_requests for all
using (
  exists (
    select 1
    from public.projects p
    where p.id = client_requests.project_id
      and public.is_org_member(p.organisation_id)
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = client_requests.project_id
      and public.is_org_member(p.organisation_id)
  )
);

create policy "Users can read accessible documents"
on public.documents for select
using (
  public.can_access_project(project_id)
  and (
    visible_to_client
    or exists (
      select 1 from public.projects p
      where p.id = project_id and public.is_org_member(p.organisation_id)
    )
  )
);

create policy "Members can manage project documents"
on public.documents for all
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
)
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
);

create policy "Users can create document download events"
on public.document_download_events for insert
with check (
  downloaded_by = auth.uid()
  and exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.project_id = project_id
      and public.can_access_project(d.project_id)
      and (
        d.visible_to_client
        or exists (
          select 1 from public.projects p
          where p.id = d.project_id and public.is_org_member(p.organisation_id)
        )
      )
  )
);

create policy "Users can read document download events"
on public.document_download_events for select
using (
  downloaded_by = auth.uid()
  or exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
);

create policy "Clients can create handover open events"
on public.handover_open_events for insert
with check (
  opened_by = auth.uid()
  and exists (
    select 1
    from public.projects p
    where p.id = project_id
      and p.status = 'published'
  )
  and exists (
    select 1
    from public.project_clients pc
    where pc.project_id = project_id
      and pc.user_id = auth.uid()
  )
);

create policy "Clients can update their handover open events"
on public.handover_open_events for update
using (
  opened_by = auth.uid()
  and exists (
    select 1
    from public.project_clients pc
    where pc.project_id = project_id
      and pc.user_id = auth.uid()
  )
)
with check (
  opened_by = auth.uid()
  and exists (
    select 1
    from public.project_clients pc
    where pc.project_id = project_id
      and pc.user_id = auth.uid()
  )
);

create policy "Users can read handover open events"
on public.handover_open_events for select
using (
  opened_by = auth.uid()
  or exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
);

create policy "Members can manage uploaded workflow documents"
on public.uploaded_documents for all
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
)
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
);

create policy "Members can manage document extraction jobs"
on public.document_extraction_jobs for all
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
)
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
);

create policy "Members can manage specification uploads"
on public.specification_uploads for all
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
)
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
);

create policy "Clients can read accepted specification uploads"
on public.specification_uploads for select
using (
  status = 'accepted'
  and public.can_access_project(project_id)
);

create policy "Authenticated users can read approved product library"
on public.products for select
to authenticated
using (true);

create policy "Authenticated users can create products"
on public.products for insert
to authenticated
with check (true);

create policy "Authenticated users can read product versions"
on public.product_versions for select
to authenticated
using (status = 'approved');

create policy "Authenticated users can create product versions"
on public.product_versions for insert
to authenticated
with check (true);

create policy "Authenticated users can create product sources"
on public.product_sources for insert
to authenticated
with check (true);

create policy "Members can manage organisation suppliers"
on public.suppliers for all
using (organisation_id is null or public.is_org_member(organisation_id))
with check (organisation_id is null or public.is_org_member(organisation_id));

create policy "Members can manage supplier project documents"
on public.supplier_documents for all
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
)
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
);

create policy "Authenticated users can read approved source documents"
on public.source_documents for select
to authenticated
using (review_status = 'approved');

create policy "Authenticated users can create source documents"
on public.source_documents for insert
to authenticated
with check (true);

create policy "Authenticated users can read approved source versions"
on public.source_document_versions for select
to authenticated
using (review_status = 'approved');

create policy "Authenticated users can create source versions"
on public.source_document_versions for insert
to authenticated
with check (true);

create policy "Authenticated users can read approved care guidance"
on public.care_guidance_versions for select
to authenticated
using (review_status = 'approved');

create policy "Authenticated users can create care guidance"
on public.care_guidance_versions for insert
to authenticated
with check (true);

create policy "Members can attach project products"
on public.project_products for insert
with check (public.can_access_project(project_id));

create policy "Accessible users can read project products"
on public.project_products for select
using (public.can_access_project(project_id));

create policy "Authenticated users can read product sources"
on public.product_sources for select
to authenticated
using (
  exists (
    select 1 from public.product_versions pv
    where pv.id = product_version_id and pv.status = 'approved'
  )
);

create policy "Members can create maintenance tasks"
on public.maintenance_tasks for insert
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
);

create policy "Accessible users can read maintenance tasks"
on public.maintenance_tasks for select
using (public.can_access_project(project_id));

create policy "Accessible users can create maintenance completions"
on public.maintenance_completions for insert
with check (
  completed_by = auth.uid()
  and exists (
    select 1
    from public.maintenance_tasks mt
    where mt.id = maintenance_task_id
      and public.can_access_project(mt.project_id)
  )
);

create policy "Accessible users can read maintenance completions"
on public.maintenance_completions for select
using (
  exists (
    select 1
    from public.maintenance_tasks mt
    where mt.id = maintenance_task_id
      and public.can_access_project(mt.project_id)
  )
);

create policy "Members can manage extracted handover items"
on public.extracted_handover_items for all
using (
  exists (
    select 1
    from public.specification_uploads su
    join public.projects p on p.id = su.project_id
    where su.id = specification_upload_id
      and public.is_org_member(p.organisation_id)
  )
)
with check (
  exists (
    select 1
    from public.specification_uploads su
    join public.projects p on p.id = su.project_id
    where su.id = specification_upload_id
      and public.is_org_member(p.organisation_id)
  )
);

create policy "Project users can read package-ready extracted handover items"
on public.extracted_handover_items for select
using (
  status in ('accepted', 'auto_approved', 'builder_approved', 'global_approved')
  and exists (
    select 1
    from public.specification_uploads su
    where su.id = specification_upload_id
      and public.can_access_project(su.project_id)
  )
);

create policy "Members can manage workflow extracted items"
on public.extracted_items for all
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
)
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
);

create policy "Members can read extracted item value history"
on public.extracted_item_value_history for select
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
);

create policy "Members can create extracted item value history"
on public.extracted_item_value_history for insert
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
);

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

create policy "Members can manage workflow review actions"
on public.item_review_actions for all
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
)
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
);

create policy "Project users can read published handover items"
on public.handover_items for select
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id
      and p.status = 'published'
      and public.can_access_project(p.id)
  )
);

create policy "Members can manage handover items"
on public.handover_items for all
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
)
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
);

create policy "Members can read handover approvals"
on public.handover_approvals for select
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
);

create policy "Members can create handover approvals"
on public.handover_approvals for insert
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
);

create policy "Members can create project clients"
on public.project_clients for insert
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
);

create policy "Accessible users can read project clients"
on public.project_clients for select
using (public.can_access_project(project_id));

create policy "Members can read and manage project audit"
on public.audit_events for select
using (
  organisation_id is not null and public.is_org_member(organisation_id)
);

create policy "Members can create project audit"
on public.audit_events for insert
with check (
  organisation_id is not null and public.is_org_member(organisation_id)
);

create policy "Members can read workflow audit logs"
on public.audit_logs for select
using (
  project_id is not null
  and exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
);

create policy "Members can create workflow audit logs"
on public.audit_logs for insert
with check (
  project_id is not null
  and exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
);
