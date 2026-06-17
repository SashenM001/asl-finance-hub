# ASL Finance Hub

A financial management dashboard for **AIESEC Sri Lanka**. It tracks KPIs, budgets, audit scores, and monthly reviews across the national entity and its Local Committees (LCs), with role-based access for LC, MC, and EFB users.

**Live demo:** https://asl-finance-hub.vercel.app

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript on **TanStack Start** (SSR + file-based routing via TanStack Router) |
| Build | Vite 7 (configured through `@lovable.dev/vite-tanstack-config`) |
| Database & Auth | Supabase (PostgreSQL with Row-Level Security, Auth, Edge Functions) |
| UI | Radix UI + shadcn/ui, TailwindCSS v4 |
| Charts | Recharts |
| Data sync | Google Sheets API v4 + Google AppScript webhook |
| Deployment | Cloudflare Workers (SSR) and Vercel (static SPA) |

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase project (URL + publishable key)
- A Google Sheets API key (for the data sync feature)

### Setup

```bash
npm install
```

Create a `.env` file in the project root:

```env
# Supabase (client-safe keys — VITE_ prefixed are bundled into the browser)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# Google Sheets sync (note: exposed in the client bundle)
VITE_GOOGLE_SHEETS_API_KEY=your-google-sheets-api-key

# Server-only (used by SSR / server functions — NEVER prefix with VITE_)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

> `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS and must never be exposed to the client. Keep it un-prefixed so Vite does not bundle it.

### Commands

```bash
npm run dev          # Start dev server at http://localhost:8080
npm run build        # Production build (emits dist/client + dist/server)
npm run build:dev    # Development-mode build
npm run preview      # Preview the production build
npm run lint         # ESLint
npm run format       # Prettier (write)
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

| Role | Access |
|------|--------|
| `lc_user` | Own entity only; mostly read-only |
| `mc_user` | All entities; manages users/roles; full write |
| `efb_user` | All entities; read-only except audit scores & monthly reviews |

RLS is enforced in PostgreSQL via `SECURITY DEFINER` helper functions (`has_role`, `get_user_entity`, `can_read_entity`). On signup, a trigger auto-creates a profile and assigns the **first user** the `mc_user` role to bootstrap the system.

### Google Sheets Sync

The Admin page sync runs in two steps:

1. An Edge Function (`supabase/functions/trigger-sheet-sync`) verifies the caller's JWT + `mc_user` role, then calls a Google AppScript webhook that consolidates source sheets into a `MASTER_COMBINED_TALL` master tab. The webhook URL and secret are stored as Supabase secrets.
2. The browser then reads the master tab and upserts aggregated data into `monthly_metrics`, `revenue_streams`, and `cost_breakdown`.

See [GOOGLE_SHEETS_SETUP.md](GOOGLE_SHEETS_SETUP.md) for API key setup.

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
