# AIESEC SL Finance Intelligence Dashboard - Project Context

**Last Updated:** 24 April 2026  
**Branch:** `sashen/dev`  
**Status:** ✅ Build Successful | Schema Complete | Seed Data Pending

---

## 📋 Project Overview

End-to-end Finance Intelligence dashboard for AIESEC SL with backend (Lovable Cloud + Postgres RLS) and frontend (Vite + React).

**Key Users:**
- **LC Users** (Local Committee): See only their entity data
- **MC Users** (Member Committee): View all data, manage roles/entities
- **EFB Users** (External Finance Body): Read-only across all + write audit/review

---

## 🗄️ Database Schema (Supabase/Postgres)

### Core Tables

#### **entities** (11 Local Committees)
```
Colombo Central, Colombo North, Colombo South, Kandy, Jaffna, USJ, NSBM, Ruhuna, Rajarata, SLIIT, NIBM
```

#### **profiles**
- Auto-created on signup
- Links auth.users → entity_id
- RLS: Users see own + MC sees all + EFB sees all

#### **user_roles** (Separate security table — prevents privilege escalation)
- Enum: `lc_user`, `mc_user`, `efb_user`
- Many-to-many with auth.users
- RLS: Only MC manages

### Finance Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `monthly_metrics` | KPIs, rankings, health scores | bank_balance, inflow, outflow, assets, liabilities, receivables, liquidity, equity, revenue, cost, npm, gpm, health_index, od_score, rankings |
| `revenue_streams` | Revenue by function | entity_id, period_month, function_code, amount |
| `cost_breakdown` | Costs by function | entity_id, period_month, function_code, amount |
| `budget_actual` | Variance tracking | entity_id, period_month, function_code, category, budget, actual |
| `audit_scores` | Quarterly audits | entity_id, period_month, quarter, score, max_score, remarks |
| `monthly_review` | Pass/fail tracker | entity_id, period_month, status, remarks, reviewed_by |

**Function Codes:** `iGV`, `iGT`, `oGV`, `oGT`, `ELD`, `EwA`, `BD`

---

## 🔐 RBAC & Security

### Security Definer Functions
```sql
has_role(_user_id, _role) → BOOLEAN
get_user_entity(_user_id) → UUID
can_read_entity(_user_id, _entity_id) → BOOLEAN
```

### RLS Policies

| Resource | LC User | MC User | EFB User |
|----------|---------|---------|----------|
| **profiles** | See own | See all, Update any | See all |
| **user_roles** | See own | Manage all | See all |
| **finance tables (READ)** | Own entity | All entities | All entities |
| **finance tables (WRITE)** | ❌ | ✅ | ❌ |
| **audit_scores** | ❌ | ✅ | ✅ |
| **monthly_review** | ❌ | ✅ | ✅ |

**First User Becomes MC Admin:**
- Trigger `handle_new_user()` checks user count
- If count = 1, auto-assign `mc_user` role
- No manual admin setup needed

---

## 🎨 Frontend Pages (Vite + React)

### Public
- **`/login`** — Email + password sign in/up

### Authenticated
- **`/overview`** — Global KPIs (rankings, revenue, npm, gpm, equity growth, health, od score) + trend charts
- **`/lc`** — Bank balance, inflow/outflow, net cash, assets/liabilities/receivables/liquidity/equity, revenue/cost pies, gpm by function
- **`/budget`** — Color-coded variance table (budget vs actual)
- **`/performance`** — Period vs period, cumulative to-date, entity vs national avg (MC/EFB only)
- **`/audit`** — Quarterly summary, monthly breakdown, CSV export
- **`/review`** — Pass/fail tracker with remarks
- **`/contacts`** — Finance roles directory

### Admin (MC Only)
- **`/admin`** — Assign roles & entities to users

### Global Filters
- Entity dropdown (hidden for LC users, not just disabled)
- Date range picker
- Function selector
- Term filter

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| **Backend** | Lovable Cloud, Postgres with RLS, Supabase |
| **Frontend** | Vite, React, TypeScript |
| **UI Components** | shadcn/ui, Recharts (charts) |
| **Database Migrations** | Supabase SQL |
| **Package Manager** | npm |

---

## ✅ Build Status

```bash
npm run dev   # Running on http://localhost:8080/ ✅
npm run build # ✅ Successful (warning: chunk >500kB — not critical)
```

**Note:** Large chunk is mainly Recharts library. Can be optimized with dynamic imports if needed.

---

## 📊 Implementation Status

### ✅ COMPLETED

#### Phase 1: Google Sheets Integration ✅ COMPLETE
1. **Google Sheets API Client** (`src/integrations/googleSheets/client.ts`) ✅
   - Fetches data from Google Sheets API v4
   - Supports single & multiple range queries
   - Handles API key authentication

2. **Data Mapper with Auto-Detection** (`src/integrations/googleSheets/mapper.ts`) ✅
   - Auto-detects column names (case-insensitive)
   - Parses months in multiple formats
   - Transforms sheet rows → DB schema types
   - Handles missing values & normalization

3. **Sync Orchestrator** (`src/integrations/googleSheets/sync.ts`) ✅
   - Fetches sheet data
   - Validates against DB entities
   - Upserts: monthly_metrics, revenue_streams, cost_breakdown
   - Returns detailed sync results (success, inserted count, errors)

4. **React Hook** (`src/hooks/useSheetSync.ts`) ✅
   - `useSheetSync()` hook for components
   - Loading state, results, error handling

5. **Admin UI** (`src/routes/_app.admin.tsx`) ✅
   - "Sync from Google Sheets" button
   - Real-time sync status & results display
   - Error alerts with actionable messages

6. **Setup Guide** (`GOOGLE_SHEETS_SETUP.md`) ✅
   - Step-by-step Google Cloud API setup
   - Sheet structure explanation
   - Troubleshooting guide

---

**TO USE:**
1. Follow [GOOGLE_SHEETS_SETUP.md](GOOGLE_SHEETS_SETUP.md) to get API key
2. Add `VITE_GOOGLE_SHEETS_API_KEY=...` to `.env`
3. Go to `/admin` → click "Sync from Google Sheets"
4. Data populates automatically! 🎉

---

### ⏳ IN PROGRESS / PENDING

#### Phase 1: Google Sheets Integration (CRITICAL)
- [ ] Implement Google Sheets API client
- [ ] Map sheet columns to dashboard metrics
- [ ] Create real-time sync function
- [ ] Populate initial data from sheet
- [ ] Handle missing values & normalization

#### Phase 2: Seed Data Initialization
- [ ] Create seed script for 12 months × 11 entities
- [ ] Populate monthly_metrics (KPIs, rankings, health scores)
- [ ] Populate revenue_streams (all 7 function codes)
- [ ] Populate cost_breakdown (all 7 function codes)
- [ ] Populate budget_actual (variance data)
- [ ] Populate audit_scores (quarterly)
- [ ] Populate monthly_review (pass/fail)

#### Phase 3: Frontend Refinement
- [ ] Verify all pages match design spec (KPIs, charts, layouts)
- [ ] Test filters (Entity, Date range, Function, Term)
- [ ] Validate RBAC at UI level (LC entity lock, MC full access, EFB read-only)
- [ ] Interactive charts with tooltips & legends
- [ ] Responsive design for all breakpoints
- [ ] Performance optimization for large datasets

#### Phase 4: Color Palette & Styling
- [ ] Apply AIESEC brand colors (#037EF3, #0CB9C1, #F48924, #F85A40, #7552CC, #00C16E, #FFC845, #52565E, #F5F5F5)
- [ ] Ensure minimal, corporate dashboard aesthetic
- [ ] Test dark/light mode if applicable

#### Phase 5: Testing & Validation
- [ ] Test all user roles end-to-end
- [ ] Verify data isolation (LC can't see other entities)
- [ ] Cross-entity filtering for MC/EFB
- [ ] Performance testing with ~12 months × 11 entities

---

## � Before Executing Anything

✅ **Always refer to this file to:**
1. Understand the schema structure
2. Remember the RBAC rules
3. Check which tables/pages exist
4. Know the current build status
5. Confirm what phase we're in

**Last Build:** ✅ Successful  
**Dev Server:** ✅ Running at http://localhost:8080/

---

## 📋 DETAILED IMPLEMENTATION ROADMAP

### PHASE 1: Google Sheets Integration ✅ COMPLETE

**What was built:**
- Google Sheets API client with auto-retry
- Intelligent column mapper (auto-detects "Entity", "Month", "Bank Balance", etc.)
- Sync orchestrator that upserts all financial tables
- Admin UI with sync button → results display
- Complete setup guide

**How to use:**
1. Get Google Sheets API key (follow [GOOGLE_SHEETS_SETUP.md](GOOGLE_SHEETS_SETUP.md))
2. Add to `.env`: `VITE_GOOGLE_SHEETS_API_KEY=AIza...`
3. Navigate to `/admin` → Click "Sync from Google Sheets"
4. Watch real-time status & see inserted counts

**Your sheet:** https://docs.google.com/spreadsheets/d/11veq_V1Eh4ZZ7PxDKnrc0GAJrXP2HGHbenAIXcFDgw8/

---

### PHASE 2: Seed Data (Priority: HIGH) — OPTIONAL IF SHEET READY

**Goal:** Populate realistic 12-month demo data across all 11 entities

If your Google Sheet isn't ready yet, I can create seed data instead:

**Tasks:**
1. Create `supabase/seed/data.ts`
   - Define 12 months (May 2025 - Apr 2026) ← current date: 24 Apr 2026
   - 11 entities (from entities table)
   - Realistic financial patterns

2. Seed all tables with realistic numbers

3. Run seed script
   ```bash
   npm run seed
   ```

**skip this if Google Sheets sync is working!**

---

### PHASE 3: Frontend Validation & Design (Priority: HIGH)

**Goal:** Ensure all pages match spec, responsive, performant

**By Page:**

#### `/login`
- [ ] Email + password sign in/up
- [ ] Show error messages
- [ ] Redirect to `/overview` on success
- [ ] First user auto-becomes MC admin

#### `/overview` (Home Dashboard)
- [ ] Display KPI cards:
  - Global Ranking
  - Asia Pacific Ranking
  - Total Revenue (sum across all selected entities)
  - NPM (calculate from revenue/cost)
  - GPM (avg across entities)
  - Equity Growth (%)
  - Finance Health Index (avg)
  - Finance OD Score (avg)
- [ ] Trend charts (line/area):
  - Revenue over time
  - Bank balance over time
  - Equity growth over time
- [ ] MC/EFB sees all; LC sees only own entity
- [ ] Apply filters: entity, date range, term

#### `/lc` (LC Dashboard - Detailed)
- [ ] Bank balance (line chart, 12-month history)
- [ ] Monthly inflow vs outflow (stacked bar)
- [ ] Net cash movement (area chart)
- [ ] Balance sheet breakdown (horizontal bar or card layout):
  - Assets
  - Liabilities
  - Receivables
  - Liquidity
  - Equity
- [ ] Revenue by function (pie chart)
- [ ] Cost by function (pie chart)
- [ ] GPM by function (horizontal bar)
- [ ] Locked to user's entity if LC user

#### `/budget`
- [ ] Table: Function × Category, Budget vs Actual, Variance, %
- [ ] Color coding:
  - Green: ≤10% variance (good)
  - Yellow: 10-20% variance (caution)
  - Red: >20% variance (alert)
- [ ] Sortable columns
- [ ] Date range filter

#### `/performance`
- [ ] Two modes:
  - **Cumulative to-date** (total from start of period)
  - **Custom period** (user selects range)
- [ ] Key metrics:
  - Revenue, Cost, NPM, GPM, Equity, Health Index
- [ ] Comparisons:
  - Entity vs National Average (MC/EFB only)
  - Period vs Period (e.g., This Q vs Last Q)
- [ ] Line/bar charts for comparisons

#### `/audit`
- [ ] Quarterly summary (cards or table)
- [ ] Monthly breakdown (expandable rows)
- [ ] Audit score timeline (line chart)
- [ ] CSV export button
- [ ] Remarks column

#### `/review`
- [ ] Pass/fail tracker (status column)
- [ ] Monthly grid view (12 rows × status badges)
- [ ] Remarks text
- [ ] Editable by EFB (forms/modal)

#### `/contacts`
- [ ] Directory table
- [ ] Columns: Entity, Finance Role, Name, Email, Phone
- [ ] Search/filter
- [ ] Printable

#### `/admin` (MC only)
- [ ] User management table
  - Email, Current Role, Current Entity
  - Dropdowns to change Role/Entity
  - Save button per row
  - Delete user option
- [ ] Bulk operations (optional)
- [ ] Activity log (optional)

---

### PHASE 4: Global Filters (ALL PAGES)

**Placement:** Top of every page (in Filters component)

**Filters:**
1. **Entity** — Dropdown (hidden for LC, not disabled)
2. **Date Range** — From/To date pickers
3. **Function** — Multi-select (iGV, iGT, oGV, oGT, ELD, EwA, BD)
4. **Term** — Dropdown (e.g., AM 2025 / PM 2025 / AM 2026)

**Behavior:**
- All charts/tables update on filter change
- Filters persist (localStorage or URL params)
- LC users cannot change Entity filter (only see their own)

---

### PHASE 5: RBAC Validation (UI + API)

**UI Level:**
- [ ] LC users don't see entity dropdown (not disabled, completely hidden)
- [ ] MC/EFB see all data
- [ ] Read-only indicators for EFB on non-audit pages
- [ ] Admin page hidden from LC/EFB, visible only to MC

**API Level:**
- [ ] Supabase RLS policies enforce access
- [ ] Verify test user (LC) gets 403 on other entity queries
- [ ] Verify test user (MC) can read all entities
- [ ] Verify test user (EFB) can read but not write (except audit)

---

### PHASE 6: Styling & Branding (Priority: MEDIUM)

**AIESEC Colors:**
```
Primary Blue:      #037EF3
Teal Accent:       #0CB9C1
Orange:            #F48924
Red Accent:        #F85A40
Purple:            #7552CC
Green:             #00C16E
Yellow:            #FFC845
Dark Gray:         #52565E
Light Gray:        #F5F5F5
```

**Tasks:**
- [ ] Update Tailwind/CSS variables with AIESEC palette
- [ ] Apply to KPI cards (borders, backgrounds)
- [ ] Apply to charts (line colors, bar colors)
- [ ] Apply to status badges (green=pass, red=fail, yellow=pending)
- [ ] Header/footer branding
- [ ] Logo + favicon

**Typography:**
- Corporate, minimal
- Clean sans-serif (system fonts or Google Fonts)

---

### PHASE 7: Performance & Testing (Priority: MEDIUM)

**Performance:**
- [ ] Lazy load page components
- [ ] Paginate large tables (budget, review)
- [ ] Memoize expensive calculations
- [ ] Chart debouncing on filter change
- [ ] Lighthouse score >80

**Testing:**
- [ ] E2E: Sign up → become MC → assign role to user → verify new user sees correct data
- [ ] E2E: LC user login → verify can only see own entity
- [ ] Spot check: Budget variance colours, revenue pies, KPI numbers
- [ ] Filter: Date range, term, function — verify all charts update
- [ ] Mobile: Test on phone/tablet responsiveness

---

## 📌 NEXT IMMEDIATE STEP

**START WITH PHASE 1: Google Sheets Integration**

1. Check Google Sheets structure (what columns exist?)
2. Create Google Sheets API client
3. Map columns to schema
4. Do initial sync to populate Supabase
5. Then proceed to Phase 2 (seed backup data)

**Command to start:**
```bash
cd /Users/sashend/Desktop/Finance\ Dashboard
npm run dev  # Already running ✅
```


