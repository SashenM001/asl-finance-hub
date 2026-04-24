# Google Sheets Integration Setup Guide

## Overview
Your Finance Dashboard now has **automatic Google Sheets sync** built in. This guide walks through getting it working.

---

## Step 1: Get Your Google Sheets API Key

### 1.1 Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Create Project**
3. Name it: `AIESEC Finance Dashboard`
4. Click **Create**

### 1.2 Enable Google Sheets API
1. In the left menu, go to **APIs & Services** → **Library**
2. Search for "Google Sheets API"
3. Click on it, then click **Enable**

### 1.3 Create API Key
1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **API Key**
3. Copy the API key (looks like: `AIza...`)

---

## Step 2: Add API Key to Your `.env` File

1. Open `.env` in your project root
2. Add this line:
```bash
VITE_GOOGLE_SHEETS_API_KEY=YOUR_API_KEY_HERE
```
Replace `YOUR_API_KEY_HERE` with the key from Step 1.3

3. Save the file

**⚠️ Important:** Do NOT commit `.env` to git. It's in `.gitignore` but double-check!

---

## Step 3: Verify Sheet Accessibility

The sheet must be **publicly readable** or shared with your Google API project account.

1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/11veq_V1Eh4ZZ7PxDKnrc0GAJrXP2HGHbenAIXcFDgw8/
2. Click **Share** (top right)
3. Make sure it's set to:
   - **Anyone with the link** → **Viewer**, OR
   - **Public on the web** (less secure but simpler for testing)
4. Click **Done**

---

## Step 4: Understand Sheet Structure

The sync function will **auto-detect column names**. Common patterns it looks for:

### Required Columns
- **Entity** — Local Committee name (must match DB entities exactly)
- **Month** — Format: "May 2025", "May-2025", or "2025-05"

### Metrics Columns (any of these)
- Bank Balance, Inflow, Outflow
- Assets, Liabilities, Receivables, Liquidity, Equity
- Total Revenue, Total Cost, NPM, GPM
- Health Index, OD Score
- Global Ranking, AP Ranking

### Revenue/Cost by Function
- Revenue iGV, Revenue iGT, Revenue oGV, etc.
- Cost iGV, Cost iGT, Cost oGV, etc.

**The sync will:** Find these columns, parse values, and populate the database.

---

## Step 5: Run the Sync

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Go to `/admin`** (you're MC admin after first signup)

3. **Click "Sync from Google Sheets"**

4. **Watch for results:**
   - ✅ Green: "Inserted X metrics, Y revenue, Z cost entries"
   - ❌ Red: Shows errors (check column names, entity names, date formats)

---

## Step 6: Validate Data

After successful sync:
1. Go to **`/overview`** — Should see KPI cards with real numbers
2. Go to **`/lc`** — Should see bank balance chart and breakdowns
3. Go to **`/budget`** — Should see budget vs actual table
4. Filters should work (date range, function, term)

---

## Troubleshooting

### Error: "VITE_GOOGLE_SHEETS_API_KEY not found"
- Solution: Add the env var to `.env` (see Step 2)
- Restart dev server after adding

### Error: "Google Sheets API error: 403"
- Solution: Sheet isn't publicly readable (see Step 3)
- OR API key doesn't have permission to Google Sheets API

### Error: "Entity not found in database"
- Solution: Entity name in sheet doesn't match database
- Check exact spelling (case-sensitive)
- Debug: Look at admin sync results for which entities failed

### Error: "Could not parse month"
- Solution: Month format unrecognized
- Use formats: "May 2025", "May-2025", or "2025-05"

### Data partially synced
- Some rows might have missing data (NULL values)
- Sync will skip rows without Entity or Month
- Check console output for warnings

---

## Next: Automate Sync (Optional)

Once working, you can:

1. **Add "Sync on Schedule"** (e.g., daily at 9 AM)
   - Use a cron job or Google Cloud Scheduler

2. **Add "Sync on Page Load"** in `/admin`
   - Auto-refresh data when admin opens page

3. **Add two-way sync** (write data back to sheet)
   - More complex, requires service account auth

---

## File Structure

```
src/
├── integrations/
│   └── googleSheets/
│       ├── client.ts      ← Fetch from API
│       ├── mapper.ts      ← Parse & map columns
│       ├── sync.ts        ← Main orchestration
│       └── index.ts       ← Public exports
├── hooks/
│   └── useSheetSync.ts    ← React hook for UI
└── routes/
    └── _app.admin.tsx     ← Admin page with sync button
```

---

## Questions?

- Sheet structure questions? Check `mapper.ts` `DEFAULT_CONFIG`
- API key issues? Check [Google Cloud docs](https://cloud.google.com/docs/authentication/rest)
- Data mapping issues? Debug in browser console — sync logs to `console.log()`

🎉 Once synced, your dashboard is live with real data!
