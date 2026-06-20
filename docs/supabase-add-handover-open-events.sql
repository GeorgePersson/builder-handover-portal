create table if not exists public.handover_open_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  opened_by uuid references auth.users(id) on delete set null,
  first_opened_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  open_count integer not null default 1 check (open_count >= 1),
  user_agent text,
  unique (project_id, opened_by)
);

alter table public.handover_open_events enable row level security;

drop policy if exists "Clients can create handover open events" on public.handover_open_events;
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

drop policy if exists "Clients can update their handover open events" on public.handover_open_events;
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

drop policy if exists "Users can read handover open events" on public.handover_open_events;
create policy "Users can read handover open events"
on public.handover_open_events for select
using (
  opened_by = auth.uid()
  or exists (
    select 1 from public.projects p
    where p.id = project_id and public.is_org_member(p.organisation_id)
  )
);
