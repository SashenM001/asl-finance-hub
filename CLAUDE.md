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

The dev server runs on **http://localhost:8080**. `npm run build` emits `dist/client` (browser bundle) and `dist/server` (SSR worker entry). No test suite is configured.

### Vite config — do not add plugins manually

`vite.config.ts` is a one-liner that calls `@lovable.dev/vite-tanstack-config`. That wrapper already bundles `tanstackStart`, `viteReact`, `tailwindcss`, `tsConfigPaths`, the Cloudflare plugin (build-only), `componentTagger` (dev-only), `VITE_*` env injection, and the `@` path alias. **Re-adding any of these manually will break the build with duplicate plugins.** Pass extra config via `defineConfig({ vite: { ... } })` if needed.

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

**Deployment:** two targets are configured. `wrangler.jsonc` deploys the SSR app as a **Cloudflare Worker** (`main: @tanstack/react-start/server-entry`). `vercel.json` deploys to **Vercel** as a static SPA (serves `dist/client`, rewrites all routes to `index.html`) — this is the live demo. The Supabase Edge Function (`supabase/functions/`) deploys separately via the Supabase CLI.

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

> ⚠️ **Enum drift:** the original migration defined the DB `function_code` enum as only `iGV, iGT, oGV, oGT, ELD, EwA, BD` (7 values). The frontend list above (10 values) is newer. The live Supabase enum must have been altered out-of-band to accept the newer codes; treat `src/lib/finance.ts` as the source of truth for the UI, and verify the live DB enum before relying on the migration file.

### Google Sheets Sync

External financial data flows in from Google Sheets. The Admin page sync (driven by the `useSheetSync` hook, `src/hooks/useSheetSync.ts`) is a **two-step** flow:

1. **Trigger** — POST to the `trigger-sheet-sync` Edge Function, which (after verifying the JWT + `mc_user` role) calls an external AppScript webhook that consolidates the origin sheets into the `MASTER_COMBINED_TALL` master tab. Webhook URL + secret live as server-side Supabase secrets and never reach the browser.
2. **Pull** — the browser then runs `syncSheetData()` (`src/integrations/googleSheets/sync.ts`), which reads `MASTER_COMBINED_TALL` via the Sheets API, aggregates per `(entity, month)`, and upserts into `monthly_metrics`/`revenue_streams`/`cost_breakdown`.

Supporting files: `client.ts` (Sheets API fetch), `mapper.ts` (`parseRow` → exact `GFB_DICTIONARY` lookup → classify GFB codes / function code / normalize), `index.ts` (public exports). The Sheets read in step 2 still happens client-side with `VITE_GOOGLE_SHEETS_API_KEY` (exposed in the bundle — a known limitation). The AppScript that builds the master tab is mirrored at `appscript/master-combined-tall-sync.gs`.

> 📖 **Full reference:** [`.claude/docs/syncer-architecture.md`](.claude/docs/syncer-architecture.md) is the canonical, code-verified description of the whole pipeline (AppScript → Edge Function → client pull → Supabase), the secret/key trust model, known deviations (currently the Edge Function + AppScript hold their secrets **hardcoded** rather than in env vars — pending revert), and a guide for adding a new **independent** syncer (e.g. the planned Audits sync). Read it before touching sync code.

> The root-level `update_mapper.js` / `update_mapper.py` are disposable one-off scripts that rewrote `mapper.ts` during a past migration. They are **not** part of the app or build — ignore them for normal work.

### Database Tables (Supabase)

`profiles`, `user_roles`, `monthly_metrics`, `revenue_streams`, `cost_breakdown`, `budget_actual`, `audit_scores`, `monthly_review`, `entities`

Full DDL, RLS policies, enums, and triggers are in the single migration under `supabase/migrations/`.

### Documentation files

- **`README.md`** — accurate project overview, setup, and architecture summary.
- **[`.claude/docs/syncer-architecture.md`](.claude/docs/syncer-architecture.md)** — canonical, code-verified reference for the Google Sheets → Supabase sync pipeline. Trust this over the older docs for anything sync-related.
- **`PROJECT_CONTEXT.md`** and **`SYSTEM_REPORT.md`** — detailed references for schema, RBAC, the sync pipeline, and feature status. Originally dated 24 April 2026; their **sync, function-code, and architecture sections were reconciled on 2026-06-17** to match the current Edge Function / AppScript flow. Other sections may still lag — trust the code (and the syncer doc) where they conflict.
- **`GOOGLE_SHEETS_SETUP.md`** documents the Sheets API key setup (the `VITE_GOOGLE_SHEETS_API_KEY` used for the step-2 read).
