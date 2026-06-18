-- Allows organisation members to update organisation contact/settings fields.

drop policy if exists "Members can update their organisations" on public.organisations;
create policy "Members can update their organisations"
on public.organisations for update
using (public.is_org_member(id))
with check (public.is_org_member(id));
