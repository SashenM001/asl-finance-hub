# Deferred: PostgREST delete-loop optimization (N+1 on sync)

**Status:** Deferred (intentionally not done as part of the audit-pull fix, 2026-06-29).
**Scope:** Sync write phase only — does not affect correctness, only request count.

## What the pattern is

Both sync paths upsert with a **delete-then-insert** strategy because the target tables have
no unique constraint to `upsert(..., { onConflict })` on. The delete step runs **one HTTP
request per unique `(entity_id, period_month)` pair** before a single bulk INSERT:

- `src/integrations/googleSheets/auditSync.ts:166-178` — `audit_scores`
- `src/integrations/googleSheets/sync.ts:340-343` — `revenue_streams`
- `src/integrations/googleSheets/sync.ts:360-363` — `cost_breakdown`

Each `.delete().eq("entity_id", eid).eq("period_month", pm)` is a separate PostgREST round-trip.
With ~10 LCs × a few months this is ~12–30 requests per table — small, but it scales O(pairs).

## Why it was deferred

The "hundreds of requests" originally observed in the network tab were a **symptom of the
wrong-tab bug** (the audit sync was reading 8385 financial rows and manufacturing a huge number
of distinct `(entity, month)` pairs). After the 4-function split fix, the audit pull returns the
correct ~120 audit rows, so the per-pair delete count collapses back to ~12. At this data scale
the N+1 is harmless and well within Supabase free-tier limits. Optimizing now would be premature.

## Options for when we revisit

### Option 1 — Single bulk delete per table (smallest change)
Replace each per-pair loop with **one** delete that targets exactly the payload's pair set, e.g.
collect the distinct entity ids and period months and issue a single filtered delete. Care is
required: you must delete **only** the `(entity, period)` combinations present in the new payload,
never a broader cross-product (`entity IN (...) AND period IN (...)` would wipe pairs that won't
be re-inserted). Safer forms:
- One delete per entity scoped to that entity's own periods: `.eq("entity_id", eid).in("period_month", [...periodsForThatEntity])` — reduces N pairs to N entities (~10 calls).
- A single `.or("and(entity_id.eq.X,period_month.eq.Y),...")` expression covering the exact pairs — 1 call, but a long filter string.

### Option 2 — Unique constraint + true upsert (cleanest, schema change)
Add a unique constraint:
- `audit_scores` → `(entity_id, period_month)`
- `revenue_streams` / `cost_breakdown` → `(entity_id, period_month, function_code)`

Then replace delete-then-insert with `upsert(payload, { onConflict: "..." })` — a single call per
table, no delete loop. Requires a migration and confirming no legitimate duplicate rows exist for
those keys first. This also removes the "delete exactly the payload set" footgun entirely.

## Trigger to revisit

Pick this up if any of these become true:
- Unique `(entity, period)` pairs per sync reach the thousands (e.g. many more LCs or full
  historical backfills), or
- Sync latency becomes user-visible, or
- We add the unique constraints anyway for data-integrity reasons (then Option 2 is free).
