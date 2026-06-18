-- Adds the RPC used by /client/accept-invite to attach a signed-in user to a
-- project client record by invite token. Apply this after docs/supabase-schema.sql
-- if your project was created before invite acceptance was added.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.accept_project_client_invite(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_project_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.project_clients
  set
    user_id = auth.uid(),
    accepted_at = now(),
    invite_token_hash = null
  where invite_token_hash = encode(digest(raw_token, 'sha256'), 'hex')
    and accepted_at is null
  returning project_id into v_project_id;

  if v_project_id is null then
    raise exception 'invalid_invite';
  end if;

  return v_project_id;
end;
$$;

grant execute on function public.accept_project_client_invite(text) to authenticated;
