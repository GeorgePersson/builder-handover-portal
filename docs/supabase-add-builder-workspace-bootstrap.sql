-- Adds a signed-in builder bootstrap RPC so the app can create the first
-- organisation_members row automatically instead of relying on a manual seed
-- script for every new builder test account.

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
