-- Builder Handover Portal MVP bootstrap.
-- Run this in the Supabase SQL Editor after:
-- 1. docs/supabase-schema.sql has been applied.
-- 2. You have signed in once through /login so auth.users contains your email.
--
-- Replace the values in the settings block before running.

do $$
declare
  p_user_email text := 'you@example.co.nz';
  p_org_name text := 'Demo Builder Co';
  p_project_name text := 'Bayview Road New Build';
  p_project_address text := '24 Bayview Road, Auckland';
  p_client_name text := 'Avery Taylor';
  p_client_email text := 'client@example.co.nz';
  v_user_id uuid;
  v_org_id uuid;
  v_project_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower(p_user_email)
  limit 1;

  if v_user_id is null then
    raise exception 'No auth.users row found for %. Sign in through /login once, then rerun this script.', p_user_email;
  end if;

  select id into v_org_id
  from public.organisations
  where lower(name) = lower(p_org_name)
  limit 1;

  if v_org_id is null then
    insert into public.organisations (name, trading_name, contact_email)
    values (p_org_name, p_org_name, p_user_email)
    returning id into v_org_id;
  end if;

  insert into public.organisation_members (organisation_id, user_id, role)
  values (v_org_id, v_user_id, 'owner')
  on conflict (organisation_id, user_id)
  do update set role = excluded.role;

  select id into v_project_id
  from public.projects
  where organisation_id = v_org_id
    and lower(name) = lower(p_project_name)
  limit 1;

  if v_project_id is null then
    insert into public.projects (
      organisation_id,
      name,
      address,
      project_type,
      status,
      handover_date,
      created_by
    )
    values (
      v_org_id,
      p_project_name,
      p_project_address,
      'New build',
      'draft',
      current_date + interval '30 days',
      v_user_id
    )
    returning id into v_project_id;
  end if;

  insert into public.project_clients (project_id, name, email)
  select v_project_id, p_client_name, p_client_email
  where not exists (
    select 1
    from public.project_clients
    where project_id = v_project_id
      and lower(email) = lower(p_client_email)
  );
end $$;
