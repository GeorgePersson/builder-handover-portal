-- Adds document download history for existing Supabase projects.

create table if not exists public.document_download_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  downloaded_by uuid references auth.users(id) on delete set null,
  user_agent text,
  downloaded_at timestamptz not null default now()
);

alter table public.document_download_events enable row level security;

drop policy if exists "Users can create document download events" on public.document_download_events;
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

drop policy if exists "Users can read document download events" on public.document_download_events;
create policy "Users can read document download events"
on public.document_download_events for select
using (
  downloaded_by = auth.uid()
  or exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
);
