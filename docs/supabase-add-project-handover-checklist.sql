-- Project handover checklist pivot tables.
-- Run in Supabase SQL editor or with SUPABASE_DB_URL after the base schema/migrations.

create table if not exists public.project_handover_checklist_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_extracted_item_id uuid references public.extracted_items(id) on delete set null,
  legacy_extracted_handover_item_id uuid references public.extracted_handover_items(id) on delete set null,
  source_document_id uuid references public.uploaded_documents(id) on delete set null,
  extraction_job_id uuid references public.document_extraction_jobs(id) on delete set null,
  title text not null,
  category text,
  brand text,
  manufacturer text,
  model text,
  sku text,
  product_code text,
  supplier text,
  supplier_sku text,
  care_instructions text,
  manual_document_id uuid references public.uploaded_documents(id) on delete set null,
  manual_url text,
  warranty_information text,
  warranty_document_id uuid references public.uploaded_documents(id) on delete set null,
  warranty_guidance_is_general boolean not null default false,
  invoice_document_id uuid references public.uploaded_documents(id) on delete set null,
  invoice_data text,
  code_compliance_document_id uuid references public.uploaded_documents(id) on delete set null,
  code_compliance_information text,
  supporting_document_ids jsonb not null default '[]'::jsonb,
  extra_notes text,
  section_statuses jsonb not null default '{}'::jsonb,
  value_sources jsonb not null default '[]'::jsonb,
  source_metadata jsonb not null default '{}'::jsonb,
  status text not null default 'needs_review',
  completion_summary text,
  accepted_incomplete_reason text,
  accepted_incomplete_at timestamptz,
  accepted_incomplete_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  last_edited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_handover_checklist_items
  add column if not exists source_extracted_item_id uuid references public.extracted_items(id) on delete set null,
  add column if not exists legacy_extracted_handover_item_id uuid references public.extracted_handover_items(id) on delete set null,
  add column if not exists source_document_id uuid references public.uploaded_documents(id) on delete set null,
  add column if not exists extraction_job_id uuid references public.document_extraction_jobs(id) on delete set null;

create unique index if not exists idx_project_handover_checklist_items_source_extracted
  on public.project_handover_checklist_items(source_extracted_item_id);

create unique index if not exists idx_project_handover_checklist_items_legacy_extracted
  on public.project_handover_checklist_items(legacy_extracted_handover_item_id);

create index if not exists idx_project_handover_checklist_items_project
  on public.project_handover_checklist_items(project_id, status, created_at desc);

create table if not exists public.project_handover_checklist_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  checklist_item_id uuid not null references public.project_handover_checklist_items(id) on delete cascade,
  event_type text not null,
  actor_id uuid references auth.users(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_handover_checklist_events_project
  on public.project_handover_checklist_events(project_id, checklist_item_id, created_at desc);

alter table public.project_handover_checklist_items enable row level security;
alter table public.project_handover_checklist_events enable row level security;

drop policy if exists "Builders can read checklist items for their organisation projects" on public.project_handover_checklist_items;
drop policy if exists "Builders can manage checklist items for their organisation projects" on public.project_handover_checklist_items;
drop policy if exists "Builders can read checklist events for their organisation projects" on public.project_handover_checklist_events;
drop policy if exists "Builders can insert checklist events for their organisation projects" on public.project_handover_checklist_events;

create policy "Builders can read checklist items for their organisation projects"
  on public.project_handover_checklist_items
  for select
  using (
    exists (
      select 1
      from public.projects p
      join public.organisation_members om on om.organisation_id = p.organisation_id
      where p.id = project_handover_checklist_items.project_id
        and om.user_id = auth.uid()
    )
  );

create policy "Builders can manage checklist items for their organisation projects"
  on public.project_handover_checklist_items
  for all
  using (
    exists (
      select 1
      from public.projects p
      join public.organisation_members om on om.organisation_id = p.organisation_id
      where p.id = project_handover_checklist_items.project_id
        and om.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.projects p
      join public.organisation_members om on om.organisation_id = p.organisation_id
      where p.id = project_handover_checklist_items.project_id
        and om.user_id = auth.uid()
    )
  );

create policy "Builders can read checklist events for their organisation projects"
  on public.project_handover_checklist_events
  for select
  using (
    exists (
      select 1
      from public.projects p
      join public.organisation_members om on om.organisation_id = p.organisation_id
      where p.id = project_handover_checklist_events.project_id
        and om.user_id = auth.uid()
    )
  );

create policy "Builders can insert checklist events for their organisation projects"
  on public.project_handover_checklist_events
  for insert
  with check (
    exists (
      select 1
      from public.projects p
      join public.organisation_members om on om.organisation_id = p.organisation_id
      where p.id = project_handover_checklist_events.project_id
        and om.user_id = auth.uid()
    )
  );
