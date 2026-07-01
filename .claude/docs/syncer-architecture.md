# Syncer Architecture — Google Sheets → Supabase

> **Canonical reference** for the financial + audit data sync pipelines. Trust this file and the
> source code over `SYSTEM_REPORT.md` / `PROJECT_CONTEXT.md` where they conflict.
>
> Last verified against code: **2026-07-01**.

This document describes the **financial** and **audit** syncers end-to-end (AppScript →
Edge Function → browser pull → Supabase) and how secrets/keys flow between the layers. As of
this revision both syncers are **fully separated**: each has its own pair of Edge Functions
(`trigger-*-sync` / `pull-*-data`) rather than sharing one. The two pairs deliberately duplicate
their auth/SA-token code instead of sharing a module — see §2 note.

---

## 1. High-level flow

Each sync is a **two-step flow** kicked off by an MC user from the Admin page
([\_app.admin.tsx](../../src/routes/_app.admin.tsx) — "Google Sheets Sync" card for financial,
"EFB Audit Sync" card for audit).

```
┌─────────────┐   ① POST {mode,term,month}      ┌───────────────────────────┐
│  Browser    │   + Supabase JWT (Bearer)       │  Supabase Edge Function   │
│  (Admin UI) │ ───────────────────────────────▶│  trigger-financial-sync   │
│useSheetSync │                                  │  (or trigger-audit-sync) │
│ /useAuditSync│                                 │  • verify JWT             │
└─────────────┘                                  │  • require mc_user role  │
       │                                         │  • forward + secret       │
       │                                         └────────────┬──────────────┘
       │                                                      │ ② POST {secret,sync,mode,term,month}
       │                                                      ▼
       │                                         ┌───────────────────────────┐
       │                                         │  Google AppScript (doPost)│
       │                                         │  routes on params.sync:   │
       │                                         │  "financial" → syncCombinedTallMasterSheet│
       │                                         │  "audit"     → syncAuditConsolidationMasterSheet│
       │                                         └────────────┬──────────────┘
       │   ③ {ok,rowsWritten,warnings}                        │
       │◀─────────────────────────────────────────────────────┘
       │
       │   ④ POST (Supabase JWT)      ┌───────────────────────────┐
       │◀────────────────────────────│  Supabase Edge Function    │
       │   {ok, values[]}            │  pull-financial-data       │
       │                             │  (or pull-audit-data)      │
       │                             │  • verify JWT               │
       │                             │  • sign SA JWT               │
       │                             │  • fetch private sheet        │
       │                             └────────────┬────────────────┘
       │                                          │ SA OAuth token
       │                                          ▼
       │                             ┌────────────────────────────┐
       │                             │  Sheets API v4              │
       │                             │  MASTER_COMBINED_TALL /     │
       │                             │  MASTER_AUDIT_TALL          │
       │                             │  (private spreadsheet)      │
       │                             └────────────────────────────┘
       ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  Browser parses + aggregates, then upserts to Supabase:                   │
│    financial → monthly_metrics · revenue_streams · cost_breakdown         │
│    audit     → audit_scores                                               │
└───────────────────────────────────────────────────────────────────────────┘
```

**Step 1 (Trigger / consolidate):** the browser asks the relevant `trigger-*-sync` Edge Function
to run the AppScript, which **rebuilds** the corresponding master tab from the raw per-LC sheets
(financial) or the "LEY Consolidation" tab (audit).

**Step 2 (Pull / ingest):** once the AppScript returns `ok`, the browser calls the matching
`pull-*-data` Edge Function (Supabase JWT required), which signs a Service Account JWT, exchanges
it for a Google OAuth token, and fetches its hardcoded tab/range from the **private** master
spreadsheet. The row data is returned to the browser, which parses, aggregates, and upserts to
Postgres. The SA private key (`GOOGLE_SA_KEY`) is a Supabase secret shared by both `pull-*`
functions — it never reaches the browser.

Financial: [useSheetSync.ts](../../src/hooks/useSheetSync.ts) `sync()`.
Audit: [useAuditSync.ts](../../src/hooks/useAuditSync.ts) `sync()`.

---

## 2. Layer-by-layer

### 2.1 Browser — `useSheetSync` / `useAuditSync` hooks

Files: [src/hooks/useSheetSync.ts](../../src/hooks/useSheetSync.ts),
[src/hooks/useAuditSync.ts](../../src/hooks/useAuditSync.ts).

- `useSheetSync` exposes `sync({ mode, term?, month? })`, plus `loading`, `result`, `error`.
  `SyncMode`:
  - `"current"` → auto-sets `month` to the first-of-this-month ISO date; AppScript syncs only the latest consolidated workbook.
  - `"term"` → requires `term` (e.g. `"25-26"`); AppScript syncs only that term's workbook.
  - `"all"` → every configured workbook.
  - Step 1: `fetch(`${VITE_SUPABASE_URL}/functions/v1/trigger-financial-sync`)` with the user's
    `session.access_token` as `Bearer`. Sends **only** `{ mode, term, month }` — no secrets.
  - Step 2: on `ok`, calls `syncSheetData()` and merges the webhook's `rowsWritten` /
    `warnings` into the `ExtendedSyncResult` shown in the Admin UI.
- `useAuditSync` is the same two-step shape, calling `trigger-audit-sync` then `syncAuditData()`.

### 2.2 Edge Functions — `trigger-financial-sync` / `trigger-audit-sync` (secret-holding proxies)

Files: [supabase/functions/trigger-financial-sync/index.ts](../../supabase/functions/trigger-financial-sync/index.ts),
[supabase/functions/trigger-audit-sync/index.ts](../../supabase/functions/trigger-audit-sync/index.ts).

Two separate Deno functions with **intentionally duplicated** bodies (a "full-separation"
design — each file's header comment cross-references the other and says to keep them in sync
manually rather than sharing a module). Each one's job is to be a **trusted proxy** so the
AppScript webhook URL and shared secret never reach the browser.

1. **Authenticate** — reads the `Authorization` header, constructs a Supabase client with
   the caller's JWT, calls `supabase.auth.getUser()`. No user → 401.
2. **Authorize** — queries `user_roles` for the user; requires `mc_user`. Else → 403.
3. **Forward** — POSTs `{ secret, sync, mode, term, month }` to the AppScript webhook URL.
   `trigger-financial-sync` always sends `sync: "financial"`; `trigger-audit-sync` always sends
   `sync: "audit"` — the same AppScript `doPost` routes both.
4. **Relay** — returns the AppScript JSON `{ ok, rowsWritten, warnings }` (or `{ ok:false, error }`) verbatim to the browser, with CORS headers.

Both share the same `APPSCRIPT_WEBHOOK_URL` / `APPSCRIPT_SECRET` Supabase secrets.

### 2.3 Google AppScript — master tab builder (shared project, routed `doPost`)

This is **not currently in the repo** (it lives in the Apps Script editor). Reference copies are
committed at [appscript/master-combined-tall-sync.gs](../../appscript/master-combined-tall-sync.gs)
(financial) and [appscript/master-audit-tall-sync.gs](../../appscript/master-audit-tall-sync.gs)
(audit) — see §5 for why a committed copy matters and the secret-handling caveat. Both live in
the **same Apps Script project** (one project = one `doPost`) and share globals
(`WEBHOOK_SECRET`, `MASTER_SPREADSHEET_ID`, `_parseDateHeaderCombTall`) — do not redeclare them.

Entry point: `doPost(e)`

1. Parses `e.postData.contents` → `{ secret, sync, mode, term, month }`.
2. Rejects if `secret !== WEBHOOK_SECRET` (returns `{ ok:false, error:"Unauthorized" }`).
3. Routes by `sync`:

- `"audit"` → `syncAuditConsolidationMasterSheet(month)`.
- default `"financial"` → `syncCombinedTallMasterSheet(mode, term, month)`.

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
    `_parseDateHeaderCombTall(rawHeader, term)` — `term` is threaded in from the enclosing
    workbook config — into `{ year, month(abbr), date("YYYY-MM-01") }`. Supported header
    formats (checked in priority order):

    | Format | Example | Year source |
    | --- | --- | --- |
    | Spreadsheet Date object | (cell type = Date) | `new Date(rawHeader)` |
    | Full month name + year | `"February 2025"` | regex `\b20\d{2}\b` |
    | 3-letter abbr + year | `"Feb 2025"` | regex `\b20\d{2}\b` |
    | Full month name only | `"February"` | inferred from `term` |
    | 3-letter abbr only | `"Feb"` | inferred from `term` |

    **Term inference rule** (AIESEC terms run Feb → Jan): term `"YY.YY"` (e.g. `"26.27"`) →
    base year = `2000 + YY`; Feb–Dec → base year, Jan → base year + 1. If neither an explicit
    year nor a valid `term` is present, `date` is empty and the mapper silently drops those rows.
  - For each data row, keeps it only if col A matches `^\d{4}-` (a real GFB code) **or** the
    description is one of the `ALLOWED` summary lines (then `GFB_Code = "SUMMARY"`):
    `LC Revenue, LC Costs, Net Income before NMF & Tax, Total Assets, Total Liabilities,
LC Equity, Cash Inflow, Cash Outflow, Net Cash Movement`.
  - Emits one tall row per (row × non-zero numeric date cell), optionally filtered to
    `filterMonth`.
- `_writeTallSheet()` **clears and overwrites** the `MASTER_COMBINED_TALL` tab (full replace,
  not append) and re-creates a filter.

**Output schema** (the contract Step 2 depends on), one row per line-item-per-month:

| Col | Header        | Example                           | Notes                                                          |
| --: | ------------- | --------------------------------- | -------------------------------------------------------------- |
|   0 | `LC`          | `Kandy`                           | LC name (post-prefix-strip); must match `LC_CODE_TO_NAME` keys |
|   1 | `LC_Term`     | `25-26`                           | term                                                           |
|   2 | `Year`        | `2025`                            | integer                                                        |
|   3 | `Month`       | `Feb`                             | 3-letter abbr                                                  |
|   4 | `Date`        | `2025-02-01`                      | **first-of-month ISO — Step 2's `period_month`**               |
|   5 | `Report_Type` | `PnL` / `CFS`                     | segments PnL vs Cash Flow                                      |
|   6 | `GFB_Code`    | `7001-EX-RV-LC` / `SUMMARY`       | full GFB code                                                  |
|   7 | `Description` | `Direct Revenue: iGV Partner Fee` | line label                                                     |
|   8 | `Amount`      | `50000`                           | numeric LKR                                                    |

`syncAuditConsolidationMasterSheet` and its output schema are covered in §6.

### 2.4 Browser — `syncSheetData` (financial ingest)

Files: [sync.ts](../../src/integrations/googleSheets/sync.ts),
[client.ts](../../src/integrations/googleSheets/client.ts),
[mapper.ts](../../src/integrations/googleSheets/mapper.ts).

1. **Fetch** — `client.ts` `fetchFinancialData()` POSTs to the `pull-financial-data` Edge
   Function with the user's Supabase session Bearer token. The Edge Function verifies the JWT and
   requires an `mc_user` or `efb_user` role (403 otherwise), then authenticates as the
   Service Account and returns `{ ok: true, values: string[][] }` containing
   `MASTER_COMBINED_TALL!A1:I10000`. No API key is used; the master sheet is private.
2. **Parse** — `mapper.ts` `parseRow()` turns each raw row into a `ParsedRow`:
   - Maps `LC` → entity name via `LC_CODE_TO_NAME`. Unknown LC → row dropped.
   - Looks up `GFB_Code` in the **exact `GFB_DICTIONARY`** (via `getGfbMapping()`) to get
     `{ category, functionCode, balanceField }`.
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
4. **Upsert** — into Supabase (all three via a single `upsert(..., { onConflict })` call each,
   after the `20260629000000_add_sync_upsert_constraints.sql` migration added the needed unique
   constraints):
   - `monthly_metrics` — upsert on `(entity_id, period_month)`.
   - `revenue_streams` / `cost_breakdown` — upsert on `(entity_id, period_month, function_code)`,
     one row per function with a non-zero amount.

> **Heuristic → dictionary migration.** Older docs describe classification by GFB-code
> _prefix_ (`7xxx`=PnL, `1xxx`=CFS) and function-code-by-keyword matching. The current
> `mapper.ts` uses an **exact dictionary** (`GFB_DICTIONARY`, looked up via `getGfbMapping()`)
> keyed on the full GFB code (e.g. `7001-EX-RV-LC`). Treat `mapper.ts` as the source of truth.

Audit ingest (`auditSync.ts`) is covered in §6.5.

---

## 3. Secret & key handling (trust model)

| Secret / key                          | Stored where                                          |    Reaches browser?    | Purpose                                         |
| ------------------------------------- | ------------------------------------------------------ | :--------------------: | ----------------------------------------------- |
| User Supabase JWT                     | Browser session                                        | n/a (originates there) | Authn/authz to all four Edge Functions          |
| `APPSCRIPT_WEBHOOK_URL`               | Edge Function secret (both `trigger-*-sync` functions) |           ❌           | Where the Edge Function calls AppScript          |
| `APPSCRIPT_SECRET` / `WEBHOOK_SECRET` | Edge Function secret + AppScript Script Property       |           ❌           | Shared secret AppScript checks in `doPost`       |
| `GOOGLE_SA_KEY`                       | Supabase secret (both `pull-*-data` functions)         |           ❌           | Service Account JSON for step-2 Sheets reads     |
| `VITE_SUPABASE_URL` / anon key        | Browser                                                |  ✅ (safe by design)   | RLS-enforced DB access                           |
| `SUPABASE_SERVICE_ROLE_KEY`           | Server only (no `VITE_` prefix)                        |           ❌           | Admin server ops (not used by this sync)         |
| `VITE_GOOGLE_SHEETS_API_KEY`          | `.env`, bundled into browser                           | ✅ (unused by sync)    | Only used by `fetchSheetDataMultiple` / `getSheetMetadata` — not called by the active sync path |

**Trust boundaries:**

- The **step-1 trigger** (browser → AppScript) is gated behind each `trigger-*-sync` Edge
  Function's JWT + `mc_user` check. The browser never sees the AppScript URL or shared secret.
- The **step-2 read** is gated behind each `pull-*-data` Edge Function's JWT check.
  Both `pull-financial-data` and `pull-audit-data` require an `mc_user` or `efb_user` role
  (403 otherwise). The master sheet is **private** — no public access. The SA key never leaves the
  Edge Function runtime. The writes that result are still RLS-protected (only MC can write
  finance tables; MC/EFB can write `audit_scores`).

---

## 4. Known issues / deviations (sync-specific)

1. ~~**Stale re-export in [googleSheets/index.ts](../../src/integrations/googleSheets/index.ts)**~~
   — **Resolved.** It previously re-exported `classifyRow` / `descriptionToFunctionCode`, which no
   longer exist in `./mapper`; the export list now re-exports the real `getGfbMapping` instead.
2. ~~**`revenue_streams` / `cost_breakdown` delete-then-insert is not transactional**~~ —
   **Resolved** (migration `20260629000000_add_sync_upsert_constraints.sql`, 2026-06-29). All
   three write paths (`monthly_metrics`, `revenue_streams`, `cost_breakdown`, plus `audit_scores`)
   now use a single `upsert(..., { onConflict })` call instead of a delete-then-insert loop, so
   there is no longer a delete/insert gap. See
   [.claude/docs/postgrest-delete-optimization.md](./postgrest-delete-optimization.md).
3. **Auth/SA-token logic is duplicated four ways** (`trigger-financial-sync` ↔
   `trigger-audit-sync`, `pull-financial-data` ↔ `pull-audit-data`) by design (see §2.2, §6.4)
   rather than shared via a common module. Any auth or token-signing fix must be applied to all
   affected files manually — each file's header comment says as much.

> The previously-documented issue where a single `pull-sheet-data` function ignored the
> requested range and always returned financial data has been **resolved** by the full split
> into `pull-financial-data` / `pull-audit-data`, each with its own hardcoded `SHEET_ID`/`RANGE`.

---

## 5. Committed AppScript copies & secret externalization

The operational AppScript is mirrored at
[appscript/master-combined-tall-sync.gs](../../appscript/master-combined-tall-sync.gs) (financial)
and [appscript/master-audit-tall-sync.gs](../../appscript/master-audit-tall-sync.gs) (audit) so the
logic Step 2 depends on is **version-controlled and reviewable** instead of living only in the
Apps Script editor. The committed copies:

- Contain **only the live `doPost` version** (shared across both files' project).
- Read the shared secret from `PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET")`
  **instead of a hardcoded string**, so no live secret is committed to git.

**To deploy / sync the committed copies back to Apps Script:**

1. Apps Script editor → Project Settings → Script Properties → add `WEBHOOK_SECRET` (and, if
   you externalize them, the spreadsheet IDs).
2. Paste the committed `.gs` content, deploy as a Web App (Execute as: _me_; Access: _Anyone_),
   and keep the deployment URL in both `trigger-*-sync` Edge Functions' `APPSCRIPT_WEBHOOK_URL` secret.

---

## 6. EFB Audit syncer (LIVE)

> **Status:** implemented and live — fully split from the financial syncer into its own
> Edge Function pair (`trigger-audit-sync`, `pull-audit-data`).

The audit syncer reuses the financial four-layer pattern but with **its own data path**
(source tab, master tab, client function, hook, Admin card, destination table).

### 6.1 Flow

```
Admin "Run Audit Sync"  (MC only)
   → useAuditSync.sync()        POST { mode, term, month } + JWT
   → trigger-audit-sync         verify JWT + mc_user → forward { secret, sync:"audit", … }
   → AppScript doPost           routes on params.sync → syncAuditConsolidationMasterSheet()
        reads "LEY Consolidation" → rebuilds MASTER_AUDIT_TALL (full overwrite)
   → ok { rowsWritten }
   → auditSync.ts syncAuditData()   fetchAuditData() → pull-audit-data → audit_scores
```

### 6.2 Source structure — "LEY Consolidation" tab

The source is the **`LEY Consolidation`** tab of the _EFB Audit Performance Dashboard_
workbook — three **stacked LC × month matrices** (col B = section label / LC code; data from
col C; month headers are dates):

| Block (col B)         | Cell values                                                  |
| --------------------- | ------------------------------------------------------------ |
| `Audit Results`       | `Pass` / `Fail`                                              |
| `Audit Scores`        | fraction `0..1` (e.g. `0.93`)                                |
| `Quality Improvement` | month-over-month Δ of score (**derived; ignored on ingest**) |

QI is exactly `score[m] − score[m−1]`, so it is **not stored** — the audit page recomputes it
for display.

### 6.3 AppScript — same project, routed `doPost`

Committed reference: [appscript/master-audit-tall-sync.gs](../../appscript/master-audit-tall-sync.gs).
Lives in the **same Apps Script project** as the financial builder and **reuses its globals**
— `WEBHOOK_SECRET`, `MASTER_SPREADSHEET_ID`, `_parseDateHeaderCombTall`. **Do not redeclare
those** (one shared namespace → redeclaration error).

One project = one `doPost`, so route on `params.sync`:

```js
var result =
  params.sync === "audit"
    ? syncAuditConsolidationMasterSheet(params.month || null)
    : syncCombinedTallMasterSheet(params.mode || "all", params.term || null, params.month || null);
```

`syncAuditConsolidationMasterSheet(filterMonth?)` opens `AUDIT_SPREADSHEET_ID` →
`LEY Consolidation`, parses the three blocks (`_extractAuditConsolidation`), merges per
`(LC, month)`, and writes `MASTER_AUDIT_TALL` into `MASTER_SPREADSHEET_ID` (full overwrite).
Config constants (not secrets): `AUDIT_SPREADSHEET_ID`, `AUDIT_SOURCE_TAB = "LEY Consolidation"`,
`AUDIT_MASTER_TAB = "MASTER_AUDIT_TALL"`, `AUDIT_TERM = "25-26"`.

**Output schema** (`MASTER_AUDIT_TALL`; the contract `auditSync.ts` depends on), one row per
`(LC, month)`:

| Col | Header                | Example         | → `audit_scores`                                |
| --: | --------------------- | --------------- | ----------------------------------------------- |
|   0 | `LC`                  | `Kandy` / `CC`  | short code/name → entity via `AUDIT_LC_TO_CODE` |
|   1 | `LC_Term`             | `25-26`         | —                                               |
|   2 | `Year`                | `2025`          | —                                               |
|   3 | `Month`               | `Jul`           | —                                               |
|   4 | `Date`                | `2025-07-01`    | `period_month`                                  |
|   5 | `Audit_Result`        | `Pass` / `Fail` | `remarks`                                       |
|   6 | `Audit_Score`         | `0.93`          | `score` (**raw fraction, no scaling**)          |
|   7 | `Quality_Improvement` | `0.06`          | **parsed but not stored** (derived in UI)       |

### 6.4 Edge Functions — `trigger-audit-sync` / `pull-audit-data`

[trigger-audit-sync/index.ts](../../supabase/functions/trigger-audit-sync/index.ts) forwards
`sync: "audit"` to the shared AppScript endpoint; same JWT + `mc_user` gate as
`trigger-financial-sync` ⇒ the audit trigger is **MC-only** server-side. Its body is duplicated
from `trigger-financial-sync/index.ts` on purpose (full-separation design) — the file's header
comment says to keep the two in sync manually.

[pull-audit-data/index.ts](../../supabase/functions/pull-audit-data/index.ts) reads
`MASTER_AUDIT_TALL!A1:H10000` from the hardcoded `SHEET_ID` using the shared `GOOGLE_SA_KEY`
Service Account. Any `mc_user` or `efb_user` may call it (read-only). Its auth/SA-token block is
duplicated from `pull-financial-data/index.ts` on purpose — same manual-sync caveat.

### 6.5 Client pull — `auditSync.ts`

File: [src/integrations/googleSheets/auditSync.ts](../../src/integrations/googleSheets/auditSync.ts).

- Calls `fetchAuditData()` (`client.ts`), which POSTs to `pull-audit-data` — a dedicated Edge
  Function reading only `MASTER_AUDIT_TALL`, not shared with the financial pull.
- **`AUDIT_LC_TO_CODE`** normalizes the inconsistent audit labels (some are entity _codes_
  `CC/CN/CS/NSBM/SLIIT/NIBM/USJ`, some are _names_ `Kandy/Rajarata/Ruhuna` whose codes differ
  `KDY/RAJ/RUH`) → entity `code` → `entity_id`. The dashboard covers **10 LCs**.
- Stores values **as-is**: `score` = fraction, `remarks` = Pass/Fail, `max_score` = `null`,
  `quarter` = `null`. QI not stored.
- **Upsert on `(entity_id, period_month)`** — a single `upsert()` call with
  `onConflict: "entity_id,period_month"` (no delete-then-insert loop; `audit_scores` has a
  unique constraint on that pair).

### 6.6 Hook + Admin UI

- [src/hooks/useAuditSync.ts](../../src/hooks/useAuditSync.ts) — two-step (trigger
  `trigger-audit-sync` → `syncAuditData()`), parallel to `useSheetSync`.
- [\_app.admin.tsx](../../src/routes/_app.admin.tsx) **"EFB Audit Sync"** card → **Run Audit
  Sync** button. MC-only at **two layers**: the Admin route's `beforeLoad` redirects non-MC
  users, and the `trigger-audit-sync` Edge Function rejects non-`mc_user` with 403.

### 6.7 Audit page UI

[src/routes/\_app.audit.tsx](../../src/routes/_app.audit.tsx) reads `audit_scores`, pivots to
LC × month, and renders three sections in the system design language:

- **Audit Results** — matrix; Pass → green `CheckCircle2`, Fail → red `XCircle`.
- **Audit Scores** — per-LC **line chart** (trend + entity comparison).
- **Quality Improvement** — **line chart** of the derived MoM Δ.
- Date filter **floored at July 2025** (`AUDIT_MIN_DATE`) via the opt-in `minDate` prop on
  the shared [Filters](../../src/components/Filters.tsx) (other pages unaffected).

### 6.8 Deviations from the original "fully independent" plan

| Original plan                                              | As built                                                        | Why                                                                                                                                              |
| ------------------------------------------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Separate Apps Script project                                | **Same project**, new file, `doPost` routed by `sync`           | Requirement: keep it in the same project; one project allows only one `doPost`.                                                                  |
| Separate `trigger-audit-sync` Edge Function w/ own secret    | **Built as planned** — `trigger-audit-sync` is fully separate, sharing only the `APPSCRIPT_WEBHOOK_URL`/`APPSCRIPT_SECRET` secrets | Full separation was completed after the initial shared-function version; see history below. |
| New folder paralleling `googleSheets/`                       | **Single `auditSync.ts`**                                        | Audit ingest is one tab → one file is enough.                                                                                                    |
| Decide if `efb_user` may trigger                              | **MC-only** trigger (Admin guard + Edge Function); MC/EFB may *pull/read* | `audit_scores` is EFB-writable per RBAC, but the trigger was scoped to MC by request. Loosen the Edge Function role check if EFB should trigger. |

> **History note:** an earlier revision of this pipeline routed both financial and audit
> triggers/pulls through single shared `trigger-sheet-sync` / `pull-sheet-data` Edge Functions
> (discriminated by a `sync` field on trigger, and with the pull function hardcoded to
> financial data only — the audit pull had no way to select `MASTER_AUDIT_TALL`). That has since
> been replaced by the fully-separated four-function design described throughout this doc.

### 6.9 To go live (manual, outside code)

1. Fill **`AUDIT_SPREADSHEET_ID`** in `master-audit-tall-sync.gs` (if not already set).
2. Redeploy the AppScript — **Manage deployments → edit → New version** (keeps the same
   `/exec` URL).
3. Redeploy the Edge Functions — `supabase functions deploy trigger-audit-sync` and
   `supabase functions deploy pull-audit-data`.

Then **Admin → Run Audit Sync** runs the whole chain and the EFB Audit tab populates.

---

## 7. File index

| Layer                                    | File                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Admin UI (buttons, results)              | [src/routes/\_app.admin.tsx](../../src/routes/_app.admin.tsx)                                                 |
| Orchestration hook (finance)             | [src/hooks/useSheetSync.ts](../../src/hooks/useSheetSync.ts)                                                  |
| Orchestration hook (audit)               | [src/hooks/useAuditSync.ts](../../src/hooks/useAuditSync.ts)                                                  |
| Edge Function — financial trigger        | [supabase/functions/trigger-financial-sync/index.ts](../../supabase/functions/trigger-financial-sync/index.ts) |
| Edge Function — financial SA sheet read  | [supabase/functions/pull-financial-data/index.ts](../../supabase/functions/pull-financial-data/index.ts)      |
| Edge Function — audit trigger            | [supabase/functions/trigger-audit-sync/index.ts](../../supabase/functions/trigger-audit-sync/index.ts)       |
| Edge Function — audit SA sheet read      | [supabase/functions/pull-audit-data/index.ts](../../supabase/functions/pull-audit-data/index.ts)              |
| AppScript — finance (committed copy)     | [appscript/master-combined-tall-sync.gs](../../appscript/master-combined-tall-sync.gs)                        |
| AppScript — audit (committed copy)       | [appscript/master-audit-tall-sync.gs](../../appscript/master-audit-tall-sync.gs)                              |
| Sheets API client (shared)               | [src/integrations/googleSheets/client.ts](../../src/integrations/googleSheets/client.ts)                      |
| Row parser + GFB dictionary              | [src/integrations/googleSheets/mapper.ts](../../src/integrations/googleSheets/mapper.ts)                      |
| Aggregate + upsert (finance)             | [src/integrations/googleSheets/sync.ts](../../src/integrations/googleSheets/sync.ts)                          |
| Aggregate + upsert (audit)               | [src/integrations/googleSheets/auditSync.ts](../../src/integrations/googleSheets/auditSync.ts)                |
| Public exports                           | [src/integrations/googleSheets/index.ts](../../src/integrations/googleSheets/index.ts)                        |
| Audit page UI (matrix + charts)          | [src/routes/\_app.audit.tsx](../../src/routes/_app.audit.tsx)                                                 |
