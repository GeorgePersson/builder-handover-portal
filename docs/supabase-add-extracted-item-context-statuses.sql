-- Adds first-pass context-request statuses for legacy specification review rows.
-- These statuses keep over-extracted rows visible while telling the builder/admin
-- what kind of missing context is needed before approval.

alter type public.extracted_item_status add value if not exists 'request_more_context';
alter type public.extracted_item_status add value if not exists 'needs_source_document';
alter type public.extracted_item_status add value if not exists 'needs_model_code';
