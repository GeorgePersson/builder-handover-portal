-- Allows assigned clients to read package-ready extracted items for their project.
-- Apply this after docs/supabase-schema.sql if your project was created before
-- the client portal package policy was added.

drop policy if exists "Project users can read package-ready extracted handover items"
on public.extracted_handover_items;

create policy "Project users can read package-ready extracted handover items"
on public.extracted_handover_items for select
using (
  status in ('accepted', 'auto_approved', 'builder_approved', 'global_approved')
  and exists (
    select 1
    from public.specification_uploads su
    where su.id = specification_upload_id
      and public.can_access_project(su.project_id)
  )
);
