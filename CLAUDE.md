# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # Production build
npm run build:dev    # Development mode build
npm run preview      # Preview production build
npm run lint         # ESLint check
npm run format       # Prettier format (write)
```

The dev server runs on **http://localhost:8080**. `npm run build` now builds a **static SPA**: it emits `dist/client` with the SPA shell `dist/client/_shell.html` (no `dist/server` SSR worker — see Vite config below). No test suite is configured.

### Vite config — do not add plugins manually

`vite.config.ts` calls `@lovable.dev/vite-tanstack-config`. That wrapper already bundles `tanstackStart`, `viteReact`, `tailwindcss`, `tsConfigPaths`, the Cloudflare plugin (build-only), `componentTagger` (dev-only), `VITE_*` env injection, and the `@` path alias. **Re-adding any of these manually will break the build with duplicate plugins.** Pass extra config via `defineConfig({ vite: { ... } })` if needed.

The config currently passes two overrides to switch from the SSR-worker build to a static SPA for the Docker/Nginx deployment: `cloudflare: false` (disables the worker output) and `tanstackStart: { spa: { enabled: true } }` (emits the `_shell.html` shell). `wrangler.jsonc` and `vercel.json` still exist but no longer match the active build shape — the live target is now the Azure VM (see Deployment).

## Architecture Overview

**ASL Finance Hub** is a financial management dashboard for AIESEC Sri Lanka. It tracks KPIs, budgets, audit scores, and monthly reviews across 11 Local Committees (LCs).

### Tech Stack

- **React 19 + TypeScript** via **Vite** (not Next.js)
- **TanStack Start** — full-stack React framework (SSR + server functions) with file-based routing under `src/routes/`. The npm package is `@tanstack/react-start`; routing primitives come from `@tanstack/react-router`.
- **Supabase** — PostgreSQL database with Row-Level Security (RLS) + Auth + Edge Functions
- **Radix UI + shadcn/ui** — component library under `src/components/ui/`
- **Recharts** — financial chart visualizations
- **TailwindCSS v4** — styling with design tokens in `src/styles.css`
- **Google Sheets API v4** — external data sync

**Deployment:** the **live target is an Azure VM** running the app as a Docker container behind Nginx, deployed by GitHub Actions (see CI/CD below). The legacy `wrangler.jsonc` (Cloudflare Worker) and `vercel.json` (Vercel static SPA) configs are still in the repo but are not the active pipeline. The Supabase Edge Function (`supabase/functions/`) deploys separately via the Supabase CLI (`npm run deploy:fn`).

### CI/CD (GitHub Actions + Docker → Azure VM)

Workflows live in `.github/workflows/`:

- **`deploy.yaml`** — on push to `main` (or manual dispatch): builds the Docker image, pushes it to Docker Hub as `…/asldevteam:finance`, then SSHes into the Azure VM and runs `deploy-finance.sh` (prod, host port **8000**).
- **`test_deploy.yaml`** — identical flow on push to `test`, tag `…/asldevteam:finance-test`, host port **8001**.
- **`pull_request_test.yaml`** — on PRs (to `master`/`test`): builds the image and smoke-runs the container (no push, no deploy). Note the branch filter here still says `master` while the deploy workflow targets `main`.

Build/runtime pieces:

- **`Dockerfile`** — multi-stage: Node 22 Alpine builds the Vite SPA, then `nginx:alpine` serves `dist/client`. `VITE_*` values are required **at build time** (Vite inlines them) and arrive via a BuildKit **secret mount** (a `.env.production.local` file) so they never persist in an image layer. The CI composes that env file from GitHub Secrets. The build fails hard if `dist/client/_shell.html` is missing.
- **`nginx.conf`** — serves the SPA with `_shell.html` as the fallback for unmatched routes, long-cache `/assets/`, and a `/health` endpoint returning `200 ok`.
- **`deploy-finance.sh`** — runs on the VM. Does a **blue-green swap**: pulls the new image, starts it on a temp port, polls `/health`, and only then renames the old `*-current` container to `*-old` and promotes the new one to the production port — with rollback if the health check fails. Driven by env vars `APP`, `TAG`, `HOSTPORT`, `TEMP_PORT`, `CONTAINERPORT` exported by the workflow.

### Role-Based Access Control

Three user roles control data visibility and write access:

| Role | Access |
|------|--------|
| `lc_user` | Own entity only; read-only for most data |
| `mc_user` | All entities; can manage users and roles |
| `efb_user` | All entities; can write audit scores and monthly review data |

Role booleans (`isLC`, `isMC`, `isEFB`) are available via `useAuth()` from `src/lib/auth.tsx` (which also exposes `user`, `profile`, `roles`, `loading`, `signOut`, `refresh`). RLS enforces this at the database level — the frontend filtering mirrors what the DB already restricts.

RLS is implemented with `SECURITY DEFINER` helper functions (`has_role`, `get_user_entity`, `can_read_entity`) to avoid policy recursion — see the migration in `supabase/migrations/`. The `handle_new_user()` trigger auto-creates a profile on signup and **assigns the very first user the `mc_user` role** (bootstraps the system; no manual admin setup). MC can write all finance tables; EFB can additionally INSERT/UPDATE (but not DELETE) `audit_scores` and `monthly_review`.

### Data Flow

```
Supabase Auth → AuthProvider (src/lib/auth.tsx)
  ↓ profile + roles loaded from DB
Route-level Gate component blocks unauthenticated access

src/lib/finance.ts — core data layer
  fetchEntities()  → entities table (11 LCs)
  fetchMetrics()   → monthly_metrics table
  fmtCurrency / fmtNumber / fmtPct — formatting helpers

Components fetch directly from Supabase client, filtered by role.
LC users are locked to their own entity_id.
MC/EFB users get a dropdown to select any entity.
```

**Two Supabase clients:**
- `src/integrations/supabase/client.ts` — browser client (anon key, RLS enforced). Default for all component/data-layer queries.
- `src/integrations/supabase/client.server.ts` — server-only admin client using the **service-role key, which bypasses RLS**. Only import in server functions/routes for trusted admin operations; never expose to client code. For user-authenticated server queries use `auth-middleware.ts` instead.

### Routing

Routes live in `src/routes/` using the file-based convention:

- `__root.tsx` — HTML shell
- `index.tsx` — root entry (redirects into the app)
- `_app.tsx` — AuthProvider + Gate (all authenticated pages nest here)
- `_app.overview.tsx` — National KPIs dashboard
- `_app.lc.tsx` — LC dashboard (balance, inflow/outflow, assets/liabilities)
- `_app.budget.tsx` — Budget vs. actual tracking
- `_app.performance.tsx` — Performance metrics
- `_app.audit.tsx` — Quarterly audit scores
- `_app.review.tsx` — Monthly pass/fail tracker
- `_app.admin.tsx` — User/role management (MC only)
- `_app.contacts.tsx` — Finance contacts directory
- `login.tsx` — Auth page

**Do not manually edit `src/routeTree.gen.ts`** — it is auto-generated by TanStack Router.

### Key Patterns

- Path alias `@/*` maps to `src/*`
- Supabase client: `src/integrations/supabase/client.ts`
- Google Sheets integration: `src/integrations/googleSheets/`
- `AppShell.tsx` renders the sidebar nav + `<Outlet>` for page content
- `Filters.tsx` provides global entity/date/term filters passed down to pages
- Supabase DB types are in `src/integrations/supabase/types.ts`

### Function Codes

Financial data is broken down by AIESEC function codes, defined as the `FunctionCode` type and `FUNCTION_CODES` array in `src/lib/finance.ts` (with matching `FUNCTION_COLORS`): `iGV`, `iGT`, `oGV`, `oGT`, `ELD`, `EwA`, `Miscellaneous`, `NMF`, `Conference`, `National Conference Delegation`. These appear throughout the metrics tables and chart components — use the exported constants rather than hardcoding the list.

> ⚠️ **Enum drift:** the original migration (`20260424043656_…sql`) defined the DB `function_code` enum as only `iGV, iGT, oGV, oGT, ELD, EwA, BD` (7 values). The frontend list above (10 values) is newer. The live Supabase enum was altered out-of-band; `20260625175845_remote_schema.sql` (pulled 2026-06-25) reflects the live state. Treat `src/lib/finance.ts` as the source of truth for the UI, and use the pulled migration file (not the original) when reading the current DB enum.

### Google Sheets Sync

External financial data flows in from Google Sheets. The Admin page sync (driven by the `useSheetSync` hook, `src/hooks/useSheetSync.ts`) is a **two-step** flow:

1. **Trigger** — POST to the `trigger-sheet-sync` Edge Function, which (after verifying the JWT + `mc_user` role) calls an external AppScript webhook that consolidates the origin sheets into the `MASTER_COMBINED_TALL` master tab. Webhook URL + secret live as server-side Supabase secrets and never reach the browser.
2. **Pull** — the browser POSTs to the `pull-sheet-data` Edge Function (with the user's Supabase JWT), which authenticates to Google as a Service Account, reads `MASTER_COMBINED_TALL` from the **private** master spreadsheet, and returns the rows. The browser (`syncSheetData()` in `src/integrations/googleSheets/sync.ts`) then aggregates per `(entity, month)` and upserts into `monthly_metrics`/`revenue_streams`/`cost_breakdown`. The SA key is stored as the `GOOGLE_SA_KEY` Supabase secret and never reaches the browser.

Supporting files: `client.ts` (routes step-2 reads through `pull-sheet-data` Edge Function), `mapper.ts` (`parseRow` → exact `GFB_DICTIONARY` lookup → classify GFB codes / function code / normalize), `index.ts` (public exports). The AppScript that builds the master tab is mirrored at `appscript/master-combined-tall-sync.gs`. `VITE_GOOGLE_SHEETS_API_KEY` is **no longer used for the financial sync**; it remains in `client.ts` only for `fetchSheetDataMultiple` / `getSheetMetadata` (not called by the active sync path).

> 📖 **Full reference:** [`.claude/docs/syncer-architecture.md`](.claude/docs/syncer-architecture.md) is the canonical, code-verified description of the whole pipeline (AppScript → Edge Functions → Supabase), the secret/key trust model, and known deviations. Read it before touching sync code.

> The root-level `update_mapper.js` / `update_mapper.py` are disposable one-off scripts that rewrote `mapper.ts` during a past migration. They are **not** part of the app or build — ignore them for normal work.

### Database Tables (Supabase)

`profiles`, `user_roles`, `monthly_metrics`, `revenue_streams`, `cost_breakdown`, `budget_actual`, `audit_scores`, `monthly_review`, `entities`

Full DDL, RLS policies, enums, and triggers are in `supabase/migrations/`.

### Migration Files and Schema Drift

There are currently **two migration files**:

- `20260424043656_4c7a59ec-…sql` — the original hand-written migration. Contains the initial schema, all tables, RLS policies, triggers, and seed data (entity rows including the initial 11 LCs).
- `20260625175845_remote_schema.sql` — generated by `npx supabase db pull` on 2026-06-25. Captures the actual live DB state including all out-of-band changes made since the original migration.

**Known drift between the original migration and the live DB:**
- `function_code` enum: original file has 7 values (`iGV, iGT, oGV, oGT, ELD, EwA, BD`); live DB was altered out-of-band and accepts 10 values (matching `src/lib/finance.ts`).
- The pulled migration file (`20260625175845_remote_schema.sql`) reflects the live state — trust it over the original for the current schema.

**How to re-sync local migrations with the live DB (read-only, safe):**

If the CLI complains that "remote migration history does not match local files", run these two commands in order:

```bash
# 1. Tell the CLI that the original migration is already applied (only updates the tracking table — does NOT touch live schema)
npx supabase migration repair --status applied 20260424043656

# 2. Pull live schema into a new local migration file
npx supabase db pull
# When prompted "Update remote migration history table? [Y/n]" → type Y
# This marks the new pulled file as applied in the tracking table so future CLI commands stay in sync.
```

`db pull` spins up a temporary local shadow DB, diffs it against the live DB, and writes the result to a new `.sql` file in `supabase/migrations/`. It **does not modify your live schema**.

**Entities are plain DB rows, not enums.** To add or remove an LC, run a SQL statement in the Supabase SQL editor:
```sql
DELETE FROM public.entities WHERE code = 'XYZ';
```
Also remove the corresponding seed line from the migration file to prevent it reappearing on a DB reset.

### Documentation files

- **`README.md`** — accurate project overview, setup, and architecture summary.
- **[`.claude/docs/syncer-architecture.md`](.claude/docs/syncer-architecture.md)** — canonical, code-verified reference for the Google Sheets → Supabase sync pipeline. Trust this over the older docs for anything sync-related.
- **`PROJECT_CONTEXT.md`** and **`SYSTEM_REPORT.md`** — detailed references for schema, RBAC, the sync pipeline, and feature status. Originally dated 24 April 2026; their **sync, function-code, and architecture sections were reconciled on 2026-06-17** to match the current Edge Function / AppScript flow. Other sections may still lag — trust the code (and the syncer doc) where they conflict.
- **`GOOGLE_SHEETS_SETUP.md`** documents the original Sheets API key setup (`VITE_GOOGLE_SHEETS_API_KEY`). The step-2 master-sheet read no longer uses this key — it goes through the `pull-sheet-data` Edge Function with a Service Account. The setup doc is now only relevant if you need `fetchSheetDataMultiple` / `getSheetMetadata` for non-master sheets.
- **`supabase/migrations/20260625175845_remote_schema.sql`** — live DB schema pulled on 2026-06-25 via `db pull`. More accurate than the original migration for the current live state. See the "Migration Files and Schema Drift" section above for the full workflow.
