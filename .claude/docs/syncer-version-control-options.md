# Syncer Version-Control Options — Read/Clean/Consolidate Stage

> **Status:** decision doc (no code written). Companion to
> [syncer-architecture.md](syncer-architecture.md), which describes the pipeline as it exists
> today. This doc evaluates how to move the **read → clean → consolidate-into-master** stage out
> of the Apps Script editor and into the codebase. Last updated: 2026-06-27.

## Context

Today, the **read → clean → consolidate-into-master** stage of the syncer lives only in
the Google Apps Script editor (mirrored, but not deployed, at
[master-combined-tall-sync.gs](../../appscript/master-combined-tall-sync.gs) and
[master-audit-tall-sync.gs](../../appscript/master-audit-tall-sync.gs)). Every time we
change that logic we must **manually copy-paste it into the Apps Script editor and redeploy
the web app** — no version control, no review, no CI, and a live secret-handling surface
outside the repo.

The Sripts project on google - `https://script.google.com/d/1rj9TK8mFRwgILQ-2QpHxW5xEJUzUWd48UapFJKUdgPMRfXjy3I89DgEN/edit?usp=sharing`

The goal: get this stage into the codebase (version control, review, scripted deploy),
ideally **reusing the Service Account pattern** we already built for `pull-sheet-data`
([supabase/functions/pull-sheet-data/index.ts](../../supabase/functions/pull-sheet-data/index.ts)),
at **zero cost** at our usage rates.

### What the Apps Script actually does (the part we're moving)

1. **Reads** 3 per-LC source workbooks (`CONSOLIDATED_SHEETS` in
   [config.gs](../../appscript/config.gs)) + the audit workbook — looping tabs, finding
   the header row, parsing date-column headers, applying summary-row rules
   ([master-combined-tall-sync.gs:225](../../appscript/master-combined-tall-sync.gs#L225)).
2. **Writes** the consolidated `MASTER_COMBINED_TALL` / `MASTER_AUDIT_TALL` tabs back into the
   master workbook ([master-combined-tall-sync.gs:298](../../appscript/master-combined-tall-sync.gs#L298)).
3. Then the **existing** `pull-sheet-data` Edge Function reads the master tab with the SA and
   the browser ingests it into Supabase — **this half already lives in the repo and doesn't change.**

### Key fact that changes the calculus

Our dashboards are **React + Recharts**, *not* Looker Studio. So the master tab's only
*confirmed* consumer is **our own app's pull step**. The `.gs` comments still mention Looker
Studio ("filter/segment in Looker Studio without data blending"), so **before choosing a
bypass option we must confirm no Looker Studio report (or any human) still reads the master
tab.** If nothing does, the master sheet becomes an optional intermediate we can drop.

---

## The options

### Option A — Port consolidation into a Supabase Edge Function (Service Account)

Reimplement the read/clean/consolidate logic in TypeScript as a **new Edge Function**
(e.g. `consolidate-sheets`), reusing the JWT-signing code already in `pull-sheet-data`.
`trigger-sheet-sync` calls this function instead of the Apps Script webhook. Apps Script is
retired.

**Two sub-variants (independent of A vs B):**
- **A1 — keep writing the master tab:** Edge Function rebuilds `MASTER_COMBINED_TALL`, then the
  existing pull path ingests it unchanged. Safe; preserves any unknown master-tab consumer.
- **A2 — bypass the master tab:** Edge Function reads source workbooks, transforms, and
  **upserts straight into Supabase** (`monthly_metrics` / `revenue_streams` / `cost_breakdown`),
  deleting the master sheet, the master-tab write, *and* the `pull-sheet-data` pull step.
  **Only viable if nothing but our app reads the master tab.**

**Setup (one-time, in Google Cloud / Sheets UI):**
- Share the 3 source workbooks (and, for A1, the master) with the SA email.
- Upgrade the SA token scope from `spreadsheets.readonly` → `spreadsheets` (write) — only needed
  for A1's master write; A2 stays read-only on Sheets.
- For A1: give the SA **Editor** on the master sheet.

**Cost:** $0. Sheets API isn't billed; we're far under the ~300 req/min read & write quota
([Sheets API quota](https://developers.google.com/sheets/api/limits)).

**Ramifications:**
- ✅ Fully in-repo, one language (TS), deploys with `supabase functions deploy`. Kills the
  manual copy-paste/redeploy loop **and** removes Apps Script as a separate runtime + secret surface.
- ✅ Strongest match to "similar to the service account setup we did."
- ✅ A2 additionally collapses the pipeline from 4 hops to 2 and removes the non-transactional
  master-tab + delete-then-insert intermediate.
- ⚠️ **We reimplement *every* function in both `.gs` files in TypeScript, not just the date
  parser** — and several rely on Apps Script-only APIs (`SpreadsheetApp`, `Logger`,
  `Utilities.formatDate`, `Session.getScriptTimeZone`, `PropertiesService`) that have **no
  drop-in Sheets-API equivalent**. See the [full inventory](#full-inventory--what-changes-under-option-a)
  below.
- ⚠️ **`valueRenderOption` conflict.** A single `values.batchGet` call has one render mode, but
  the extractor needs *both* numeric amounts (`typeof val === "number"`,
  [master-combined-tall-sync.gs:276](../../appscript/master-combined-tall-sync.gs#L276)) **and**
  parseable date headers. `UNFORMATTED_VALUE` returns amounts as numbers but date cells as Excel
  serials; `FORMATTED_VALUE` returns date headers as strings but amounts as locale strings. Pick
  `UNFORMATTED_VALUE` and convert header serials to dates the way `_parseAuditDate` already does
  ([master-audit-tall-sync.gs:171](../../appscript/master-audit-tall-sync.gs#L171)) — **don't**
  assume `FORMATTED_VALUE` is a free win.
- ⚠️ Edge Functions have a wall-clock/CPU limit. Reading 3 workbooks × many tabs should fit, but
  must be verified on real data; worst case, batch by workbook.
- ⚠️ Two consolidators today (financial + audit) → two functions, or one routed function.

### Option B — Keep the Apps Script, add `clasp` for version control + scripted deploy

Use Google's official [clasp CLI](https://developers.google.com/apps-script/guides/clasp) so the
`.gs` files **in the repo become the live project**. `clasp push && clasp deploy` (locally or via
a GitHub Action) replaces the manual copy-paste-redeploy. Logic is untouched.

**Setup (one-time):**
- `clasp login`, `clasp clone <scriptId>` to bind the repo to the existing project (or
  `clasp create`). Add `.clasp.json` + `appsscript.json`.
- For CI deploy: store the `.clasprc.json` contents as a `CLASPRC_JSON` GitHub secret, or use a
  service account with `clasp --adc`.

**Cost:** $0.

**Ramifications:**
- ✅ **Lowest risk** — the proven SpreadsheetApp/date logic stays byte-for-byte; nothing to
  re-derive or re-test.
- ✅ Smallest change; can be done in an afternoon. `/exec` web-app URL stays stable across redeploys.
- ✅ Gets us version control + review + scripted/auto deploy immediately.
- ⚠️ Apps Script **remains a separate runtime and deploy surface** — we've automated and
  version-controlled it, but not unified it into the app's stack. The dual secret model
  (`WEBHOOK_SECRET` in Script Properties **and** `APPSCRIPT_SECRET`/`APPSCRIPT_WEBHOOK_URL` in
  Supabase) stays.
- ⚠️ CI needs a `CLASPRC_JSON` secret (OAuth refresh token) — another credential to rotate/guard.
- ⚠️ clasp no longer transpiles TS; the files stay `.gs`/JS (fine — they already are).

### Option C — GCP Cloud Run / Cloud Functions with the SA

Move the logic to a GCP Cloud Function (gen2) or Cloud Run service, triggered over HTTP, using
the SA natively.

**Ramifications:**
- ✅ Free tier exists (2M invocations/mo); SA auth is first-class.
- ❌ Adds a **whole new GCP deploy target + billing-enabled project** when we already run Supabase
  Edge Functions that do the same job. It's Option A with more moving parts and a second platform.
- ❌ **Not recommended.**

---

## Full inventory — what changes under Option A

This is the complete list of functions, constants, and Apps Script API calls across the two
`.gs` files and `config.gs`, and what each becomes when ported to a TypeScript Edge Function.
Under **Option B (clasp) none of this changes** — the code runs as-is; only the deploy
mechanism is added.

### `config.gs` — constants & secrets

| Item | Today (Apps Script) | Under Option A (Edge Function) |
|---|---|---|
| `MASTER_SPREADSHEET_ID` | `const` in `config.gs` | EF constant / env var (same ID already hardcoded in [pull-sheet-data/index.ts:13](../../supabase/functions/pull-sheet-data/index.ts#L13)) |
| `CONSOLIDATED_SHEETS` (3× `{spreadsheetId, term}`) | `const` array | Port verbatim into the EF (or a Supabase config table). **Each ID must be shared with the SA email.** |
| `AUDIT_SPREADSHEET_ID`, `AUDIT_SOURCE_TAB`, `AUDIT_MASTER_TAB`, `AUDIT_TERM`, `AUDIT_SECTIONS` | `const`s | Port verbatim into the EF. `AUDIT_SPREADSHEET_ID` is still unfilled in the live project (see syncer-architecture §6.9) — resolve as part of the move. |
| `WEBHOOK_SECRET` via `PropertiesService.getScriptProperties()` | shared-secret gate for `doPost` | **Deleted.** Auth becomes the Supabase JWT + `mc_user` check already in `trigger-sheet-sync`. The whole `APPSCRIPT_SECRET` / `APPSCRIPT_WEBHOOK_URL` secret pair retires with it. |

### `master-combined-tall-sync.gs` — financial consolidator

| Function | Apps Script APIs it uses | Port action |
|---|---|---|
| `doPost(e)` | `ContentService`, JSON parse, secret check, `sync` routing | **Replaced**, not ported — `trigger-sheet-sync` already does auth + routing. New EF just exposes the two `sync*` entry points. |
| `syncCombinedTallMasterSheet(mode, term, month)` | `SpreadsheetApp.openById`, `ss.getSheets`, `sheet.getName`, `Logger.log` | Port logic. Tab listing → Sheets API `spreadsheets.get?fields=sheets.properties.title`. Values → `values.batchGet`. `Logger.log` → `console.log`. Mode/term filtering of `CONSOLIDATED_SHEETS` is pure logic. |
| `_extractTallRows(...)` | `sheet.getDataRange().getValues()` | Feed the `batchGet` 2-D array in instead. Header-row detection, `GFB CODE`/`DESCRIPTION` match, `^\d{4}-` code regex, and the **`ALLOWED` summary allow-list** all port as pure logic. Mind the `typeof val === "number"` amount check vs. the render-option conflict above. |
| `_parseDateHeaderCombTall(raw, term)` | `Utilities.formatDate`, `Session.getScriptTimeZone`, `new Date()` | Port, but **replace `Utilities.formatDate(d, tz, "MMM")`** (month abbreviation) with a TS month-abbr lookup, and **replace the spreadsheet-`Date`-object branch** with Excel-serial→Date conversion (Sheets API returns serials under `UNFORMATTED_VALUE`, never `Date` objects). 5 header formats + term inference all port. |
| `_writeTallSheet(rows, tab)` | `openById`, `getSheetByName`/`insertSheet`, `sheet.clear()`, `setValues()`, `getFilter().remove()`, `createFilter()` | **A1:** `values.clear` + `values.update` (write needs the `spreadsheets` scope + SA **Editor**). The auto-filter has **no values-API equivalent** — needs a `spreadsheets.batchUpdate` `setBasicFilter` request, or just drop the filter. **A2:** deleted entirely — upsert to Supabase instead. |

### `master-audit-tall-sync.gs` — audit consolidator

| Function | Apps Script APIs it uses | Port action |
|---|---|---|
| `syncAuditConsolidationMasterSheet(month)` | `SpreadsheetApp.openById`, `getSheetByName`, `Logger.log` | Port; open + read `AUDIT_SOURCE_TAB` via `values.get`. |
| `_extractAuditConsolidation(...)` | `sheet.getDataRange().getValues()` | Port. The stacked-block scan (section labels in col B, blank-row block terminator, per-`(LC, month)` merge of the three blocks) is pure logic over the values array. |
| `_parseAuditDate(raw)` | numeric Excel-serial → `Date`, then delegates to `_parseDateHeaderCombTall` | Mostly **becomes the norm**: under `UNFORMATTED_VALUE` *all* date headers arrive as serials, so this serial-handling path is the primary one, not the edge case. |
| `_writeAuditTallSheet(rows, tab)` | same write APIs as `_writeTallSheet` | Same as `_writeTallSheet` above (A1 = Sheets write, A2 = drop). |

### Cross-cutting Apps Script → TypeScript substitutions

- `SpreadsheetApp.openById(id).getSheets()` → `GET spreadsheets/{id}?fields=sheets.properties.title`
- `sheet.getDataRange().getValues()` → `GET spreadsheets/{id}/values/{tab}?valueRenderOption=UNFORMATTED_VALUE`
- `sheet.clear()` + `setValues()` → `POST values/{tab}:clear` then `PUT values/{tab}?valueInputOption=RAW`
- `createFilter()` / `getFilter().remove()` → `spreadsheets.batchUpdate` (`setBasicFilter` / `clearBasicFilter`) — or omit
- `Logger.log` → `console.log` · `Utilities.formatDate` → TS date formatting · `Session.getScriptTimeZone` → fixed/UTC tz
- `PropertiesService` secret → Supabase JWT auth (already in place)

> **Net:** "the date parser changes" is the *smallest* part. The real work is replacing the
> `SpreadsheetApp` read/write surface (every `sync*`, `_extract*`, `_write*` function touches it),
> resolving the render-option conflict, and reproducing the auto-filter behaviour — across **both**
> consolidators.

---

## Side-by-side

| Dimension | A1 (EF, keep master) | A2 (EF, bypass master) | B (clasp) | C (Cloud Run) |
|---|---|---|---|---|
| In-repo / version-controlled | ✅ | ✅ | ✅ | ✅ |
| Retires Apps Script runtime | ✅ | ✅ | ❌ | ✅ |
| Reuses existing SA pattern | ✅ | ✅ | n/a | ✅ |
| Reimplements *all* `.gs` read/write/parse logic | ⚠️ yes | ⚠️ yes | ✅ no | ⚠️ yes |
| New deploy platform | ❌ none | ❌ none | ❌ none | ⚠️ GCP |
| Cost at our scale | $0 | $0 | $0 | $0 |
| Risk | Medium | Medium-high | Low | Medium-high |
| Pipeline simplification | some | **most** | none | some |
| Blocked on "who reads master tab?" | no | **yes** | no | no |

---

## Recommendation

- If the priority is **fastest, lowest-risk version control** of exactly today's behaviour →
  **Option B (clasp)**. We can ship it immediately and revisit a port later.
- If the priority is a **clean, unified, one-runtime end state** (the spirit of your SA hint) →
  **Option A**, and given Recharts (not Looker Studio) it's worth checking whether **A2 (bypass)**
  is available — it's the biggest simplification.
- A reasonable sequence: **B now** (instant version control + auto-deploy), then **A** as a
  follow-up once the TS reimplementation is validated against real workbook data.

## Open questions to resolve before committing

1. **Does anything other than our app read `MASTER_COMBINED_TALL` / `MASTER_AUDIT_TALL`?**
   (Looker Studio report, manual viewers, other scripts.) Determines whether A2 is on the table.
2. Acceptable to reimplement & re-test the **entire `.gs` read/write/parse surface** (see the
   Full Inventory — not just the parser), or keep it frozen in Apps Script (B)?
3. Want the audit consolidator moved in the same effort, or financial-only first?
4. Preferred deploy trigger for the chosen path (manual command vs GitHub Action on file change)?

> Once a lane is chosen (and Q1–Q4 answered), this doc should be followed by a concrete
> implementation plan for the selected option.
