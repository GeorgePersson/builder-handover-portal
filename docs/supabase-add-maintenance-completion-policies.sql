-- Allows accessible users to record and view maintenance task completions.

alter table public.maintenance_completions enable row level security;

drop policy if exists "Accessible users can create maintenance completions" on public.maintenance_completions;
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

drop policy if exists "Accessible users can read maintenance completions" on public.maintenance_completions;
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
