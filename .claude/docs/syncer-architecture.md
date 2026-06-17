# Syncer Architecture — Google Sheets → Supabase

> **Canonical reference** for the financial data sync pipeline. Trust this file and the
> source code over `SYSTEM_REPORT.md` / `PROJECT_CONTEXT.md` where they conflict.
>
> Last verified against code: **2026-06-17** (branch `amzal/syncer-fix`).

This document describes the **existing financial-data syncer** end-to-end (AppScript →
Edge Function → browser pull → Supabase), how secrets/keys flow between the layers, the
known deviations from the intended design, and a step-by-step guide for adding a **new,
independent syncer** (e.g. the planned Audits sync) that reuses this pattern.

---

## 1. High-level flow

The sync is a **two-step flow** kicked off by an MC user from the Admin page
([_app.admin.tsx](../../src/routes/_app.admin.tsx) → "Google Sheets Sync" card → "Run Sync").

```
┌─────────────┐   ① POST {mode,term,month}      ┌──────────────────────────┐
│  Browser    │   + Supabase JWT (Bearer)       │  Supabase Edge Function  │
│  (Admin UI) │ ───────────────────────────────▶│  trigger-sheet-sync      │
│ useSheetSync│                                  │  • verify JWT            │
└─────────────┘                                  │  • require mc_user role  │
       │                                         │  • forward + secret      │
       │                                         └────────────┬─────────────┘
       │                                                      │ ② POST {secret,mode,term,month}
       │                                                      ▼
       │                                         ┌──────────────────────────┐
       │                                         │  Google AppScript (doPost)│
       │                                         │  syncCombinedTallMaster   │
       │                                         │  • read per-LC PnL/CFS tabs│
       │                                         │  • write MASTER_COMBINED_  │
       │                                         │    TALL master tab         │
       │                                         └────────────┬─────────────┘
       │   ③ {ok,rowsWritten,warnings}                        │
       │◀─────────────────────────────────────────────────────┘
       │
       │   ④ syncSheetData()  — read MASTER_COMBINED_TALL via Sheets API v4 (API key)
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser parses + aggregates per (entity, month) → upserts to Supabase:   │
│    monthly_metrics · revenue_streams · cost_breakdown                     │
└─────────────────────────────────────────────────────────────────────────┘
```

**Step 1 (Trigger / consolidate):** the browser asks the Edge Function to run the
AppScript, which **rebuilds** the `MASTER_COMBINED_TALL` tab from the raw per-LC sheets.

**Step 2 (Pull / ingest):** once the AppScript returns `ok`, the browser reads the freshly
rebuilt master tab and writes the aggregated results into Postgres.

Both steps are orchestrated by one hook call: [useSheetSync.ts](../../src/hooks/useSheetSync.ts) `sync()`.

---

## 2. Layer-by-layer

### 2.1 Browser — `useSheetSync` hook

File: [src/hooks/useSheetSync.ts](../../src/hooks/useSheetSync.ts)

- Exposes `sync({ mode, term?, month? })`, plus `loading`, `result`, `error`.
- `SyncMode`:
  - `"current"` → auto-sets `month` to the first-of-this-month ISO date; AppScript syncs only the latest consolidated workbook.
  - `"term"` → requires `term` (e.g. `"25-26"`); AppScript syncs only that term's workbook.
  - `"all"` → every configured workbook.
- Step 1: `fetch(`${VITE_SUPABASE_URL}/functions/v1/trigger-sheet-sync`)` with the user's
  `session.access_token` as `Bearer`. Sends **only** `{ mode, term, month }` — no secrets.
- Step 2: on `ok`, calls `syncSheetData()` and merges the webhook's `rowsWritten` /
  `warnings` into the `ExtendedSyncResult` shown in the Admin UI.

### 2.2 Edge Function — `trigger-sheet-sync` (the secret-holding proxy)

File: [supabase/functions/trigger-sheet-sync/index.ts](../../supabase/functions/trigger-sheet-sync/index.ts)

Deno function. Its entire job is to be a **trusted proxy** so the AppScript webhook URL and
shared secret never reach the browser.

1. **Authenticate** — reads the `Authorization` header, constructs a Supabase client with
   the caller's JWT, calls `supabase.auth.getUser()`. No user → 401.
2. **Authorize** — queries `user_roles` for the user; requires `mc_user`. Else → 403.
3. **Forward** — POSTs `{ secret, mode, term, month }` to the AppScript webhook URL.
4. **Relay** — returns the AppScript JSON `{ ok, rowsWritten, warnings }` (or `{ ok:false, error }`) verbatim to the browser, with CORS headers.

> ⚠️ **Known deviation (current deployed state):** the live function has the **webhook URL
> and `APPSCRIPT_SECRET` hardcoded inline** instead of reading `Deno.env.get(...)`. This was
> a temporary measure taken before the deployer had access to the Supabase secret store. The
> intended state (and what the file comments describe) is:
> ```ts
> const webhookRes = await fetch(Deno.env.get("APPSCRIPT_WEBHOOK_URL")!, {
>   method: "POST",
>   headers: { "Content-Type": "application/json" },
>   body: JSON.stringify({
>     secret: Deno.env.get("APPSCRIPT_SECRET")!,
>     mode: body.mode ?? "all",
>     term: body.term ?? null,
>     month: body.month ?? null,
>   }),
> });
> ```
> **TODO:** set `APPSCRIPT_WEBHOOK_URL` and `APPSCRIPT_SECRET` as Edge Function secrets
> (Supabase Dashboard → Edge Functions → Secrets) and revert to `Deno.env.get`. Until then,
> the secret lives in version-controllable source — treat it as compromised and rotate it
> once the env-var path is restored.

### 2.3 Google AppScript — `MASTER_COMBINED_TALL` builder

This is **not currently in the repo** (it lives in the Apps Script editor). A reference copy
is committed at [appscript/master-combined-tall-sync.gs](../../appscript/master-combined-tall-sync.gs)
— see §5 for why a committed copy matters and the secret-handling caveat.

Entry point: `doPost(e)`
1. Parses `e.postData.contents` → `{ secret, mode, term, month }`.
2. Rejects if `secret !== WEBHOOK_SECRET` (returns `{ ok:false, error:"Unauthorized" }`).
3. Calls `syncCombinedTallMasterSheet(mode, term, month)`.
4. Returns `{ ok:true, rowsWritten, warnings }`.

`syncCombinedTallMasterSheet(mode, filterTerm, filterMonth)`
- Selects which source workbooks to process from `CONSOLIDATED_SHEETS`:
  - `"term"` → only the matching term's workbook.
  - `"current"` → only the **last** entry in `CONSOLIDATED_SHEETS` (latest term).
  - `"all"` (default) → every workbook.
- For each workbook, iterates tabs. A tab is processed if its name **starts with** `PNL` /
  `[PNL]` (→ `Report_Type = "PnL"`) or `CFS` / `[CFS]` (→ `Report_Type = "CFS"`). The LC name
  is the tab name with the `PNL`/`CFS` prefix stripped. Tabs named `CONSOLIDATED` are skipped.
- `_extractTallRows()` per tab:
  - Finds the header row (first row whose col A == `GFB CODE` or col B == `DESCRIPTION`).
  - Treats every column from index 2 onward as a **date column**, parsed by
    `_parseDateHeaderCombTall` into `{ year, month(abbr), date("YYYY-MM-01") }`.
  - For each data row, keeps it only if col A matches `^\d{4}-` (a real GFB code) **or** the
    description is one of the `ALLOWED` summary lines (then `GFB_Code = "SUMMARY"`):
    `LC Revenue, LC Costs, Net Income before NMF & Tax, Total Assets, Total Liabilities,
    LC Equity, Cash Inflow, Cash Outflow, Net Cash Movement`.
  - Emits one tall row per (row × non-zero numeric date cell), optionally filtered to
    `filterMonth`.
- `_writeTallSheet()` **clears and overwrites** the `MASTER_COMBINED_TALL` tab (full replace,
  not append) and re-creates a filter.

**Output schema** (the contract Step 2 depends on), one row per line-item-per-month:

| Col | Header | Example | Notes |
|----:|--------|---------|-------|
| 0 | `LC` | `Kandy` | LC name (post-prefix-strip); must match `LC_CODE_TO_NAME` keys |
| 1 | `LC_Term` | `25-26` | term |
| 2 | `Year` | `2025` | integer |
| 3 | `Month` | `Feb` | 3-letter abbr |
| 4 | `Date` | `2025-02-01` | **first-of-month ISO — Step 2's `period_month`** |
| 5 | `Report_Type` | `PnL` / `CFS` | segments PnL vs Cash Flow |
| 6 | `GFB_Code` | `7001-EX-RV-LC` / `SUMMARY` | full GFB code |
| 7 | `Description` | `Direct Revenue: iGV Partner Fee` | line label |
| 8 | `Amount` | `50000` | numeric LKR |

> ⚠️ **Known footgun — duplicate definitions in the Apps Script project.** The project
> currently contains a **legacy file** that re-declares `syncCombinedTallMasterSheet`,
> `_parseDateHeaderCombTall`, `_extractTallRows`, and `_writeTallSheet` with the **same
> names** as the live `doPost`-enabled file. In Apps Script, all `.gs` files share **one
> global namespace**, so duplicate top-level `function` declarations collide and the
> last-loaded definition wins — which can silently shadow the webhook-aware version. The
> legacy `syncCombinedTallMasterSheet` also takes **no arguments**, so if it wins, `mode` /
> `term` / `month` filtering breaks. **Delete the legacy file** (or rename its functions) so
> only one definition of each exists.

### 2.4 Browser — `syncSheetData` (the ingest)

Files: [sync.ts](../../src/integrations/googleSheets/sync.ts),
[client.ts](../../src/integrations/googleSheets/client.ts),
[mapper.ts](../../src/integrations/googleSheets/mapper.ts).

1. **Fetch** — `client.ts` `fetchSheetData()` GETs
   `MASTER_COMBINED_TALL!A1:I10000` via Sheets API v4 using `VITE_GOOGLE_SHEETS_API_KEY`.
2. **Parse** — `mapper.ts` `parseRow()` turns each raw row into a `ParsedRow`:
   - Maps `LC` → entity name via `LC_CODE_TO_NAME`. Unknown LC → row dropped.
   - Looks up `GFB_Code` in the **exact `GFB_DICTIONARY`** to get `{ category, functionCode,
     balanceField }`. (This replaced the old prefix/keyword heuristics — see note below.)
   - Categories: `revenue`, `cost`, `balance_sheet`, `cash_flow`, `unknown`.
3. **Aggregate** — `sync.ts` groups rows by `(entityName, periodMonth)` and accumulates:
   - PnL: `totalRevenue`, `totalCost`, plus per-`FunctionCode` revenue/cost.
   - CFS: `inflow`/`outflow`, and balance-sheet fields `bank_balance`, `assets`,
     `receivables`, `petty_cash`, `reserves`, `equity`, `liabilities`.
   - Derived: `npm = (rev-cost)/rev*100`; liquidity = `(bank+receivables)/liabilities`
     (capped at 999 when liabilities = 0); inflow/outflow fall back to PnL-derived values if
     no CFS rows present.
   - **MoCR note:** `petty_cash` and `reserves` are kept **separate** from `assets` to keep
     the MoCR numerator precise; the frontend adds them back for "Total Assets" display.
4. **Upsert** — into Supabase:
   - `monthly_metrics` — upsert on `(entity_id, period_month)`.
   - `revenue_streams` / `cost_breakdown` — **delete-then-insert** per `(entity_id,
     period_month)` (no unique constraint on the function dimension), one row per function
     with a non-zero amount.

> **Heuristic → dictionary migration.** Older docs describe classification by GFB-code
> *prefix* (`7xxx`=PnL, `1xxx`=CFS) and function-code-by-keyword matching. The current
> `mapper.ts` uses an **exact dictionary** (`GFB_DICTIONARY`) keyed on the full GFB code
> (e.g. `7001-EX-RV-LC`). Treat `mapper.ts` as the source of truth.

---

## 3. Secret & key handling (trust model)

| Secret / key | Stored where | Reaches browser? | Purpose |
|--------------|-------------|:---------------:|---------|
| User Supabase JWT | Browser session | n/a (originates there) | Authn/authz to the Edge Function |
| `APPSCRIPT_WEBHOOK_URL` | **Should be** Edge Function secret (currently hardcoded — see §2.2) | ❌ | Where the Edge Function calls AppScript |
| `APPSCRIPT_SECRET` / `WEBHOOK_SECRET` | **Should be** Edge Function secret + AppScript Script Property (currently hardcoded in both — see §2.2, §5) | ❌ | Shared secret AppScript checks in `doPost` |
| `VITE_GOOGLE_SHEETS_API_KEY` | `.env`, **bundled into browser** | ✅ (known limitation) | Step 2 read of the master tab |
| `VITE_SUPABASE_URL` / anon key | Browser | ✅ (safe by design) | RLS-enforced DB access |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only (no `VITE_` prefix) | ❌ | Admin server ops (not used by this sync) |

**Trust boundaries:**
- The **only** privileged secret-bearing hop (browser → AppScript) is gated behind the Edge
  Function's JWT + `mc_user` check. The browser can never call the AppScript webhook directly
  because it never sees the URL or secret (once §2.2 is reverted to env vars).
- The **Step 2 read** is *not* gated server-side — it uses the public Sheets API key baked
  into the bundle. Anyone with the bundle can read `MASTER_COMBINED_TALL`. The master sheet
  must therefore be considered "readable by anyone with the API key + sheet ID". The
  **writes** that result are still RLS-protected (only MC can write finance tables).

---

## 4. Known issues / deviations (sync-specific)

1. **Hardcoded secrets in the deployed Edge Function** (§2.2) — revert to `Deno.env.get`
   and rotate the secret.
2. **Hardcoded `WEBHOOK_SECRET` in the AppScript** — move to
   `PropertiesService.getScriptProperties()` (§5).
3. **Duplicate function definitions in the Apps Script project** (§2.3) — delete the legacy
   file; risk of the no-arg version shadowing the webhook-aware one.
4. **Sheets API key exposed in the browser bundle** — inherent to the client-side Step 2.
   Mitigation would be to move the read into the Edge Function too.
5. **Stale re-export in [googleSheets/index.ts](../../src/integrations/googleSheets/index.ts)** —
   it re-exports `classifyRow` and `descriptionToFunctionCode`, which no longer exist in
   `mapper.ts` (replaced by `getGfbMapping`). Harmless only as long as nothing imports them;
   clean up the export list.
6. **`revenue_streams` / `cost_breakdown` delete-then-insert is not transactional** — a
   failure between delete and insert leaves a gap for that `(entity, month)` until the next
   successful sync.

---

## 5. Committed AppScript copy & secret externalization

The operational AppScript is mirrored at
[appscript/master-combined-tall-sync.gs](../../appscript/master-combined-tall-sync.gs) so the
logic Step 2 depends on is **version-controlled and reviewable** instead of living only in the
Apps Script editor. The committed copy:

- Contains **only the live `doPost` version** (the legacy duplicate is intentionally omitted).
- Reads the shared secret from `PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET")`
  **instead of a hardcoded string**, so no live secret is committed to git.

**To deploy / sync the committed copy back to Apps Script:**
1. Apps Script editor → Project Settings → Script Properties → add `WEBHOOK_SECRET` (and, if
   you externalize them, the spreadsheet IDs).
2. Paste the committed `.gs` content, deploy as a Web App (Execute as: *me*; Access: *Anyone*),
   and keep the deployment URL in the Edge Function's `APPSCRIPT_WEBHOOK_URL` secret.

---

## 6. Adding a NEW independent syncer (e.g. Audits)

The planned Audits data has a **different sheet structure** and must be **syncable
independently** from the financial syncer (its own button in the Admin panel, its own
AppScript, its own Edge Function). Mirror the four layers — do **not** overload the existing
`MASTER_COMBINED_TALL` path:

1. **AppScript (new web app):** a separate Apps Script project (or a new file + new
   deployment) that consolidates the audit origin sheets into an audits master tab (e.g.
   `MASTER_AUDIT_TALL`) with whatever columns the audit structure needs. Same `doPost`
   secret-check pattern; use its **own** `WEBHOOK_SECRET`.
2. **Edge Function (`trigger-audit-sync`):** copy
   [trigger-sheet-sync/index.ts](../../supabase/functions/trigger-sheet-sync/index.ts) and
   change only the forwarded URL/secret env-var names (`APPSCRIPT_AUDIT_WEBHOOK_URL`,
   `APPSCRIPT_AUDIT_SECRET`). **Authorization decision:** finance writes are `mc_user`, but
   `audit_scores` are also writable by `efb_user` (see RBAC in CLAUDE.md) — decide whether the
   audit trigger should allow `efb_user` in addition to `mc_user` and adjust the role check.
3. **Client ingest module:** a new folder paralleling
   [src/integrations/googleSheets/](../../src/integrations/googleSheets/) (its own `client`
   range, `mapper` for the audit structure, and `sync` that upserts into `audit_scores` /
   `monthly_review`). Reuse `fetchSheetData(spreadsheetId, range)` if the API-key read model
   is acceptable.
4. **Hook + UI:** a `useAuditSync` hook parallel to `useSheetSync`, wired to a **separate**
   card/button in [_app.admin.tsx](../../src/routes/_app.admin.tsx) so the two syncers run
   independently.

**Decide up front:** whether the audit Step-2 read should also use the browser API key
(consistent with finance, but leaks the key) or be done inside the Edge Function (more
secure, but more code). The finance syncer chose the former; the audit syncer can differ.

---

## 7. File index

| Layer | File |
|-------|------|
| Admin UI (buttons, results) | [src/routes/_app.admin.tsx](../../src/routes/_app.admin.tsx) |
| Orchestration hook | [src/hooks/useSheetSync.ts](../../src/hooks/useSheetSync.ts) |
| Edge Function proxy | [supabase/functions/trigger-sheet-sync/index.ts](../../supabase/functions/trigger-sheet-sync/index.ts) |
| AppScript (committed copy) | [appscript/master-combined-tall-sync.gs](../../appscript/master-combined-tall-sync.gs) |
| Sheets API client | [src/integrations/googleSheets/client.ts](../../src/integrations/googleSheets/client.ts) |
| Row parser + GFB dictionary | [src/integrations/googleSheets/mapper.ts](../../src/integrations/googleSheets/mapper.ts) |
| Aggregate + upsert | [src/integrations/googleSheets/sync.ts](../../src/integrations/googleSheets/sync.ts) |
| Public exports | [src/integrations/googleSheets/index.ts](../../src/integrations/googleSheets/index.ts) |
</content>
</invoke>
