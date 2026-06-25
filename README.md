# ASL Finance Hub

A financial management dashboard for **AIESEC Sri Lanka**. It tracks national and Local Committee (LC) KPIs and EFB audit scores across the 11 LCs, with role-based access for LC, MC, and EFB users.

> The current live pages are **Overview**, **LC Dashboard**, **EFB Audit**, **Help & Contacts**, and the MC-only **Admin** page. Budget vs. Actual, Performance, and Monthly Review pages exist in the codebase but are currently disabled (their route files are prefixed with `-` and their nav links are commented out), so the data layer still carries their tables. But the data does not exist in the sources provided by the EFB so far.

**Deployment:** runs as a Docker container behind Nginx on an Azure VM, deployed by GitHub Actions on push to `main`.

---

## Tech Stack

| Layer           | Technology                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------ |
| Framework       | React 19 + TypeScript on **TanStack Start** (SSR + file-based routing via TanStack Router) |
| Build           | Vite 7 (configured through `@lovable.dev/vite-tanstack-config`), built as a static SPA    |
| Database & Auth | Supabase (PostgreSQL with Row-Level Security, Auth, Edge Functions)                        |
| UI              | Radix UI + shadcn/ui, TailwindCSS v4                                                       |
| Charts          | Recharts                                                                                   |
| Data sync       | Google Sheets (read via a Service Account through a Supabase Edge Function) + AppScript webhook |
| Deployment      | Docker + Nginx on an Azure VM, via GitHub Actions                                          |

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase project (URL + publishable key)
- A Google Cloud Service Account with read access to the master spreadsheet (for the data sync feature — see [Supabase Edge Function secrets](#supabase-edge-function-secrets) below)

### Setup

```bash
npm install
```

Create a `.env` file in the project root:

```env
# Supabase (client-safe keys — VITE_ prefixed are bundled into the browser)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# Server-only (used by server functions — NEVER prefix with VITE_)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

> `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS and must never be exposed to the client. Keep it un-prefixed so Vite does not bundle it.
>
> The Google Sheets sync no longer uses a browser-side API key — the master sheet is private and is read server-side via a Service Account. See [Supabase Edge Function secrets](#supabase-edge-function-secrets). (`VITE_GOOGLE_SHEETS_API_KEY` is only still referenced by the unused `fetchSheetDataMultiple` / `getSheetMetadata` helpers and is not needed for the active sync.)

### Supabase Edge Function secrets

The sync runs through two Supabase Edge Functions, which read these secrets server-side (set them in **Supabase Dashboard → Edge Functions → Secrets**, or via `npx supabase secrets set`). They never reach the browser:

| Secret              | Used by              | Purpose                                                                                     |
| ------------------- | -------------------- | ------------------------------------------------------------------------------------------- |
| `GOOGLE_SA_KEY`     | `pull-sheet-data`    | Full Google Service Account JSON. Signs a JWT to read the private master sheet via OAuth.    |
| `APPSCRIPT_WEBHOOK_URL` | `trigger-sheet-sync` | URL of the AppScript webhook that rebuilds the master tab.                                  |
| `APPSCRIPT_WEBHOOK_SECRET` | `trigger-sheet-sync` | Shared secret the AppScript checks before running.                                      |

> **Service Account setup:** Create a Service Account in Google Cloud, download its JSON key, and **share the master spreadsheet with the SA's `client_email` as Viewer**. Paste the entire JSON as the `GOOGLE_SA_KEY` secret. The SA key must never be committed to git or placed in a `VITE_`-prefixed variable. To hand the project to a new owner, they create their own SA in their GCP project, share the sheet with the new `client_email`, and replace `GOOGLE_SA_KEY` — the GCP project and the AppScript project are independent.

### Commands

```bash
npm run dev          # Start dev server at http://localhost:8080
npm run build        # Production build (static SPA — emits dist/client with _shell.html)
npm run build:dev    # Development-mode build
npm run preview      # Preview the production build
npm run lint         # ESLint
npm run format       # Prettier (write)
npm run deploy:fn    # Deploy the Supabase Edge Functions (trigger-sheet-sync, pull-sheet-data)
```

There is no test suite configured.

---

## Architecture

```
Supabase Auth → AuthProvider (src/lib/auth.tsx)
  ↓ profile + roles loaded from DB
Route-level Gate blocks unauthenticated access (src/routes/_app.tsx)
  ↓
Pages query Supabase directly, filtered by role; RLS enforces isolation at the DB level
```

- **Routing** lives in `src/routes/` (TanStack Router file-based convention). `routeTree.gen.ts` is auto-generated — do not edit it.
- **Core data layer** is `src/lib/finance.ts` (entity/metric fetchers, function codes, formatting helpers).
- **Two Supabase clients**: `src/integrations/supabase/client.ts` (browser, RLS-enforced) and `client.server.ts` (server-only, service-role, bypasses RLS).

### Role-Based Access Control

| Role       | Access                                                        |
| ---------- | ------------------------------------------------------------- |
| `lc_user`  | Own entity only; mostly read-only                             |
| `mc_user`  | All entities; manages users/roles; full write                 |
| `efb_user` | All entities; read-only except audit scores & monthly reviews |

RLS is enforced in PostgreSQL via `SECURITY DEFINER` helper functions (`has_role`, `get_user_entity`, `can_read_entity`). On signup, a trigger auto-creates a profile and assigns the **first user** the `mc_user` role to bootstrap the system.

### Google Sheets Sync

There are **two independent syncers**, both triggered from the MC-only Admin page: a **financial** sync and an **audit** sync. They share the same trust/transport plumbing but pull from different data sources into different tables.

**What they share (one pipeline):**

- A single Edge Function, `supabase/functions/trigger-sheet-sync`, fronts both. It verifies the caller's JWT + `mc_user` role, then forwards the request to one Google AppScript webhook (URL + secret stored as Supabase secrets, never exposed to the browser).
- The request body carries a `sync` discriminator — `"financial"` (default) or `"audit"` — which routes `doPost` in the AppScript to build the correct master tab.
- Both follow the same **two-step** shape: (1) trigger the AppScript build via the `trigger-sheet-sync` Edge Function, then (2) read the resulting master tab through the `pull-sheet-data` Edge Function — which authenticates to Google as a Service Account, so the master sheet stays private — and write the rows to Supabase from the browser.

**Where they diverge (two data sources):**

|               | Financial sync                                                  | Audit sync                                                                                |
| ------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Hook          | `useSheetSync` (`src/hooks/useSheetSync.ts`)                    | `useAuditSync` (`src/hooks/useAuditSync.ts`)                                              |
| Source data   | Origin finance sheets                                           | "LEY Consolidation" tab of the EFB Audit Performance Dashboard                            |
| Master tab    | `MASTER_COMBINED_TALL`                                          | `MASTER_AUDIT_TALL`                                                                       |
| AppScript     | `appscript/master-combined-tall-sync.gs`                        | `appscript/master-audit-tall-sync.gs`                                                     |
| Client pull   | `syncSheetData()` (`src/integrations/googleSheets/sync.ts`)     | `syncAuditData()` (`src/integrations/googleSheets/auditSync.ts`)                          |
| Target tables | `monthly_metrics`, `revenue_streams`, `cost_breakdown` (upsert) | `audit_scores` (delete-then-insert per entity/period — no unique constraint to upsert on) |
| Coverage      | All 11 LCs                                                      | 10 LCs                                                                                    |

The financial sync also supports a `mode` (`all` / `term` / `current`) to scope which periods get rebuilt; the audit sync rebuilds the full audit set.

See [Supabase Edge Function secrets](#supabase-edge-function-secrets) for the Service Account and webhook secrets the sync needs. [GOOGLE_SHEETS_SETUP.md](GOOGLE_SHEETS_SETUP.md) documents the legacy API-key setup, which is no longer on the active sync path.

---

## Database

Schema (tables, enums, RLS policies, triggers) is defined in the migration under `supabase/migrations/`. Core tables:

`entities`, `profiles`, `user_roles`, `monthly_metrics`, `revenue_streams`, `cost_breakdown`, `budget_actual`, `audit_scores`, `monthly_review`

Detailed schema and RBAC notes are in [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) and [SYSTEM_REPORT.md](SYSTEM_REPORT.md).

---

## Further Documentation

- [CLAUDE.md](CLAUDE.md) — architecture guide for working in this repo
- [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) — schema, RBAC, and feature status
- [SYSTEM_REPORT.md](SYSTEM_REPORT.md) — full system report
- [GOOGLE_SHEETS_SETUP.md](GOOGLE_SHEETS_SETUP.md) — Google Sheets sync setup
