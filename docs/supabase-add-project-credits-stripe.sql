-- Adds the billing primitives needed for Stripe-backed project credits.
-- This is intentionally separate from checkout/webhook code so existing
-- Supabase projects can opt in when billing is ready.

create table if not exists public.project_credit_accounts (
  organisation_id uuid primary key references public.organisations(id) on delete cascade,
  stripe_customer_id text unique,
  credit_balance integer not null default 0 check (credit_balance >= 0),
  unlimited boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.project_credit_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  stripe_event_id text unique,
  event_type text not null,
  credit_delta integer not null,
  balance_after integer,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.project_credit_accounts enable row level security;
alter table public.project_credit_events enable row level security;

create policy "Members can read project credit account"
on public.project_credit_accounts for select
using (public.is_org_member(organisation_id));

create policy "Members can read project credit events"
on public.project_credit_events for select
using (public.is_org_member(organisation_id));

create or replace function public.ensure_test_project_credits()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_credit_accounts (organisation_id, unlimited)
  select om.organisation_id, true
  from public.organisation_members om
  join auth.users u on u.id = om.user_id
  where lower(u.email) = 'test@gmail.com'
  on conflict (organisation_id)
  do update set unlimited = true, updated_at = now();
end;
$$;

grant execute on function public.ensure_test_project_credits() to authenticated;
