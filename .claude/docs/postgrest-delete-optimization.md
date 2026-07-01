# Deferred: PostgREST delete-loop optimization (N+1 on sync)

**Status:** ✅ DONE (2026-06-29) — Option 2 implemented. Unique constraints added to
`audit_scores` `(entity_id, period_month)` and `revenue_streams` / `cost_breakdown`
`(entity_id, period_month, function_code)`; all three delete-then-insert loops replaced with
`upsert(payload, { onConflict })`. The notes below are retained for historical context.
**Scope:** Sync write phase only — does not affect correctness, only request count.

## What the pattern was (now resolved)

> The description below is the **pre-fix** state, kept for context. As of 2026-06-29 all three
> paths use `upsert(..., { onConflict })` (see the status banner above); the delete loops and the
> line numbers below no longer match the code.

Both sync paths used to upsert with a **delete-then-insert** strategy because the target tables had
no unique constraint to `upsert(..., { onConflict })` on. The delete step ran **one HTTP
request per unique `(entity_id, period_month)` pair** before a single bulk INSERT, in:

- `src/integrations/googleSheets/auditSync.ts` — `audit_scores`
- `src/integrations/googleSheets/sync.ts` — `revenue_streams`
- `src/integrations/googleSheets/sync.ts` — `cost_breakdown`

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
