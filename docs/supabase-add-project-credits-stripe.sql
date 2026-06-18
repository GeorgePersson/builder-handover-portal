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

create or replace function public.consume_project_credit(
  target_organisation_id uuid,
  target_project_id uuid,
  event_notes text default 'Project creation credit used.'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_unlimited boolean;
  v_balance_after integer;
begin
  select credit_balance, unlimited
  into v_balance, v_unlimited
  from public.project_credit_accounts
  where organisation_id = target_organisation_id
  for update;

  if not found then
    raise exception 'project_credit_account_missing';
  end if;

  if v_unlimited then
    insert into public.project_credit_events (
      organisation_id,
      project_id,
      event_type,
      credit_delta,
      balance_after,
      notes
    )
    values (
      target_organisation_id,
      target_project_id,
      'project_created',
      0,
      null,
      'Unlimited credits. ' || coalesce(event_notes, '')
    );

    return v_balance;
  end if;

  if v_balance < 1 then
    raise exception 'insufficient_project_credits';
  end if;

  v_balance_after := v_balance - 1;

  update public.project_credit_accounts
  set credit_balance = v_balance_after,
      updated_at = now()
  where organisation_id = target_organisation_id;

  insert into public.project_credit_events (
    organisation_id,
    project_id,
    event_type,
    credit_delta,
    balance_after,
    notes
  )
  values (
    target_organisation_id,
    target_project_id,
    'project_created',
    -1,
    v_balance_after,
    event_notes
  );

  return v_balance_after;
end;
$$;

create or replace function public.apply_project_credit_purchase(
  target_organisation_id uuid,
  stripe_event text,
  stripe_customer text,
  stripe_checkout_session text,
  credit_quantity integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_event uuid;
  v_balance integer;
  v_balance_after integer;
begin
  if credit_quantity < 1 then
    raise exception 'credit_quantity_required';
  end if;

  select id into v_existing_event
  from public.project_credit_events
  where stripe_event_id = stripe_event
  limit 1;

  if v_existing_event is not null then
    select credit_balance
    into v_balance
    from public.project_credit_accounts
    where organisation_id = target_organisation_id;

    return coalesce(v_balance, 0);
  end if;

  insert into public.project_credit_accounts (
    organisation_id,
    stripe_customer_id,
    credit_balance
  )
  values (
    target_organisation_id,
    stripe_customer,
    0
  )
  on conflict (organisation_id)
  do update set
    stripe_customer_id = coalesce(public.project_credit_accounts.stripe_customer_id, excluded.stripe_customer_id),
    updated_at = now();

  select credit_balance
  into v_balance
  from public.project_credit_accounts
  where organisation_id = target_organisation_id
  for update;

  v_balance_after := coalesce(v_balance, 0) + credit_quantity;

  update public.project_credit_accounts
  set credit_balance = v_balance_after,
      stripe_customer_id = coalesce(stripe_customer_id, stripe_customer),
      updated_at = now()
  where organisation_id = target_organisation_id;

  insert into public.project_credit_events (
    organisation_id,
    stripe_event_id,
    event_type,
    credit_delta,
    balance_after,
    notes
  )
  values (
    target_organisation_id,
    stripe_event,
    'stripe_checkout_completed',
    credit_quantity,
    v_balance_after,
    'Stripe Checkout session ' || stripe_checkout_session || ' completed.'
  );

  return v_balance_after;
end;
$$;

grant execute on function public.consume_project_credit(uuid, uuid, text) to authenticated;
grant execute on function public.apply_project_credit_purchase(uuid, text, text, text, integer) to service_role;
