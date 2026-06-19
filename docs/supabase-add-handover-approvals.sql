-- Phase 9 final handover approval records.
-- Run after docs/supabase-add-document-workflow-phase1.sql on existing projects.

create table if not exists public.handover_approvals (
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

alter table public.handover_approvals enable row level security;

drop policy if exists "Members can read handover approvals" on public.handover_approvals;
create policy "Members can read handover approvals"
on public.handover_approvals for select
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
);

drop policy if exists "Members can create handover approvals" on public.handover_approvals;
create policy "Members can create handover approvals"
on public.handover_approvals for insert
with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
);
