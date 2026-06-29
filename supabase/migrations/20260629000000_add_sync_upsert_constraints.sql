-- Add unique constraints so the Google Sheets sync can upsert (onConflict)
-- instead of delete-then-insert. period_month stores a full YYYY-MM-01 date,
-- so these keys are globally unique (no month/year collisions).
--
-- Applied manually via the Supabase SQL editor on 2026-06-29; this file records
-- that change for local migration history. Dedupe any existing duplicate rows
-- BEFORE adding the constraints or the ALTER TABLE will fail.

alter table public.audit_scores
  add constraint audit_scores_entity_period_key
  unique (entity_id, period_month);

alter table public.revenue_streams
  add constraint revenue_streams_entity_period_func_key
  unique (entity_id, period_month, function_code);

alter table public.cost_breakdown
  add constraint cost_breakdown_entity_period_func_key
  unique (entity_id, period_month, function_code);
