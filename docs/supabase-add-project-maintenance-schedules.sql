-- Adds project-level exposure/CCC metadata used to calculate shared maintenance schedules.
-- Safe to rerun.

alter table public.projects
  add column if not exists ccc_granted_date date,
  add column if not exists exposure_zone text not null default 'standard';

alter table public.projects
  drop constraint if exists projects_exposure_zone_check;

alter table public.projects
  add constraint projects_exposure_zone_check
  check (exposure_zone in ('standard', 'coastal_sea_spray', 'geothermal', 'coastal_and_geothermal'));

alter table public.maintenance_tasks
  add column if not exists maintenance_schedule_key text,
  add column if not exists frequency_months integer,
  add column if not exists starts_from_ccc boolean not null default false;

create index if not exists projects_exposure_zone_idx on public.projects(exposure_zone);
create index if not exists maintenance_tasks_schedule_key_idx on public.maintenance_tasks(maintenance_schedule_key);
