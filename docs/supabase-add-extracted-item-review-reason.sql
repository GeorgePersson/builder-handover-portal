-- Adds persisted reviewer notes for extracted handover item edits.
-- Run this if the main schema was already applied before review_reason existed.

alter table public.extracted_handover_items
add column if not exists review_reason text;
