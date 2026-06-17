// ============================================================
// MASTER_COMBINED_TALL SYNC — AppScript web app
// ============================================================
// Version-controlled reference copy of the Google Apps Script that backs the
// financial-data syncer. The authoritative runtime lives in the Apps Script
// editor; keep this file in sync with it. See .claude/docs/syncer-architecture.md.
//
// NOTE ON LAYOUT: the live project splits this across files — a CONFIG file
// (MASTER_SPREADSHEET_ID, WEBHOOK_SECRET, CONSOLIDATED_SHEETS) and the sync
// logic. Apps Script shares one global namespace across all .gs files, so the
// split is cosmetic. This reference keeps everything in one file for clarity.
//
// Triggered by the Supabase Edge Function `trigger-sheet-sync` (which holds the
// webhook URL + secret). Reads each LC's per-tab PnL/CFS reports from the
// consolidated workbooks and rebuilds the MASTER_COMBINED_TALL tab (full
// overwrite) in tall/tidy format. The browser then pulls that tab into Supabase.
//
// ── SECRET HANDLING ─────────────────────────────────────────────────────────
// WEBHOOK_SECRET is read from Script Properties — NOT hardcoded — so no live
// secret is committed to git. Set it once in the Apps Script editor:
//   Project Settings → Script Properties → add `WEBHOOK_SECRET`.
// (The deployed copy historically hardcoded this value; that is a known
//  deviation tracked in the syncer-architecture doc.)
//
// Output columns (the contract the client ingest depends on):
//   LC | LC_Term | Year | Month | Date | Report_Type | GFB_Code | Description | Amount
//     Year  → integer (e.g. 2025)
//     Month → 3-letter abbreviation (e.g. "Feb")
//     Date  → "YYYY-MM-01"  ← used as period_month
// ============================================================

// ─── Config ─────────────────────────────────────────────────────────────────
// The central "database" spreadsheet that receives the MASTER_COMBINED_TALL tab.
const MASTER_SPREADSHEET_ID = "11veq_V1Eh4ZZ7PxDKnrc0GAJrXP2HGHbenAIXcFDgw8";

// Read once at global scope. Returns null if the Script Property is unset —
// doPost fails closed in that case (see the guard below).
const WEBHOOK_SECRET = PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET");

// One entry per consolidated workbook per term. Append a new row each term.
const CONSOLIDATED_SHEETS = [
  { spreadsheetId: "1hE-DFofqrkhgwbxkP7EaXc2hQ2VXkZ3GaUXgYCrSvYA", term: "24-25" },
  { spreadsheetId: "1dI28PE4Vyyae0cfkGMuShtW98m1xeFRD6twdm9G8Ot4", term: "25-26" },
];

// ─── Web app entry point ─────────────────────────────────────────────────────
function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);

    // Fail closed: reject if the secret is unset OR does not match. Without the
    // `!WEBHOOK_SECRET` check, an unset property (null) + `{"secret": null}`
    // would pass `null !== null` → false → authorized.
    if (!WEBHOOK_SECRET || params.secret !== WEBHOOK_SECRET) {
      return ContentService.createTextOutput(
        JSON.stringify({ ok: false, error: "Unauthorized" })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    var result = syncCombinedTallMasterSheet(
      params.mode  || "all",
      params.term  || null,
      params.month || null
    );
    return ContentService.createTextOutput(
      JSON.stringify({ ok: true, rowsWritten: result.rowsWritten, warnings: result.warnings })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: err.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── Main: read source workbooks → rebuild MASTER_COMBINED_TALL ───────────────
function syncCombinedTallMasterSheet(mode, filterTerm, filterMonth) {
  mode        = mode        || "all";
  filterTerm  = filterTerm  || null;
  filterMonth = filterMonth || null;

  var sheetsToProcess = CONSOLIDATED_SHEETS;
  if (mode === "term" && filterTerm) {
    sheetsToProcess = CONSOLIDATED_SHEETS.filter(function (c) { return c.term === filterTerm; });
  } else if (mode === "current") {
    sheetsToProcess = [CONSOLIDATED_SHEETS[CONSOLIDATED_SHEETS.length - 1]];
  }

  var allRows  = [];
  var warnings = [];

  sheetsToProcess.forEach(function (config) {
    Logger.log("▶ Opening Spreadsheet ID: " + config.spreadsheetId + " for Term: " + config.term);

    try {
      var ss = SpreadsheetApp.openById(config.spreadsheetId);
      var foundValidTabs = false;

      ss.getSheets().forEach(function (sheet) {
        try {
          var tabName  = sheet.getName();
          var tabClean = tabName.trim().toUpperCase();

          if (tabClean.indexOf("PNL") === 0 || tabClean.indexOf("[PNL]") === 0) {
            var lcName = tabName.replace(/^\[?PNL\]?\s*/i, "").trim();
            if (lcName.toUpperCase() !== "CONSOLIDATED") {
              Logger.log("  ↳ Extracting PnL for " + lcName);
              allRows = allRows.concat(_extractTallRows(sheet, lcName, config.term, "PnL", filterMonth));
              foundValidTabs = true;
            }
          } else if (tabClean.indexOf("CFS") === 0 || tabClean.indexOf("[CFS]") === 0) {
            var lcName = tabName.replace(/^\[?CFS\]?\s*/i, "").trim();
            if (lcName.toUpperCase() !== "CONSOLIDATED") {
              Logger.log("  ↳ Extracting CFS for " + lcName);
              allRows = allRows.concat(_extractTallRows(sheet, lcName, config.term, "CFS", filterMonth));
              foundValidTabs = true;
            }
          }
        } catch (tabError) {
          Logger.log("  ⚠ Error reading tab '" + sheet.getName() + "': " + tabError.message);
        }
      });

      if (!foundValidTabs) {
        Logger.log("  ⚠ WARNING: No PnL/CFS tabs found in " + config.spreadsheetId);
        warnings.push("No PnL/CFS tabs found in " + config.spreadsheetId);
      } else {
        Logger.log("✓ Done with Term: " + config.term);
      }
    } catch (e) {
      Logger.log("✗ Error opening " + config.spreadsheetId + ": " + e.message);
      warnings.push("Error opening " + config.spreadsheetId + ": " + e.message);
    }
  });

  if (allRows.length === 0) {
    Logger.log("No data collected — nothing to write.");
    return { rowsWritten: 0, warnings: ["No data found for the selected filter."] };
  }

  Logger.log("▶ Writing " + allRows.length + " combined rows to MASTER_COMBINED_TALL...");
  _writeTallSheet(allRows, "MASTER_COMBINED_TALL");
  Logger.log("✅ Combined tall sync complete.");
  return { rowsWritten: allRows.length, warnings: warnings };
}

// ─── Parse a date-header cell into {year, month, date} ────────────────────────
function _parseDateHeaderCombTall(rawHeader) {
  var ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var d    = new Date(rawHeader);
  var yearInt, monthAbbr, monthNum;

  if (!isNaN(d.getTime())) {
    yearInt   = d.getFullYear();
    monthNum  = d.getMonth() + 1;
    monthAbbr = Utilities.formatDate(d, Session.getScriptTimeZone(), "MMM");
  } else {
    var str = String(rawHeader).trim();
    yearInt = 0; monthAbbr = str; monthNum = 0;
    for (var mi = 0; mi < ABBR.length; mi++) {
      if (str.indexOf(ABBR[mi]) !== -1) {
        monthAbbr = ABBR[mi]; monthNum = mi + 1;
        var ym  = str.match(/\b(20\d{2})\b/);
        yearInt = ym ? parseInt(ym[1]) : 0;
        break;
      }
    }
  }

  var dateStr = (yearInt > 0 && monthNum > 0)
    ? yearInt + "-" + (monthNum < 10 ? "0" : "") + monthNum + "-01"
    : "";

  return { year: yearInt, month: monthAbbr, date: dateStr };
}

// ─── Extract tall rows from one source sheet ──────────────────────────────────
// filterMonth MUST be passed in (it is a local of syncCombinedTallMasterSheet,
// not a global). Omitting it makes the `if (filterMonth ...)` line below throw
// ReferenceError, which the per-tab catch swallows → silent "No data found".
function _extractTallRows(sheet, lc, term, reportType, filterMonth) {
  var data    = sheet.getDataRange().getValues();
  var results = [];

  var headerRow = -1;
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim().toUpperCase() === "GFB CODE" ||
        String(data[i][1]).trim().toUpperCase() === "DESCRIPTION") {
      headerRow = i; break;
    }
  }
  if (headerRow === -1) throw new Error("Cannot find header row for LC: " + lc);

  var dateCols   = [];
  var rawHeaders = data[headerRow];
  for (var c = 2; c < rawHeaders.length; c++) {
    var raw = rawHeaders[c];
    if (raw === "" || String(raw).trim() === "Description") continue;
    var p = _parseDateHeaderCombTall(raw);
    dateCols.push({ colIndex: c, year: p.year, month: p.month, date: p.date });
  }

  var ALLOWED = ["LC Revenue", "LC Costs", "Net Income before NMF & Tax",
                 "Total Assets", "Total Liabilities", "LC Equity",
                 "Cash Inflow", "Cash Outflow", "Net Cash Movement"];

  for (var r = headerRow + 1; r < data.length; r++) {
    var code = String(data[r][0]).trim();
    var desc = String(data[r][1]).trim();

    var finalCode = null;
    if (code.match(/^\d{4}-/)) {
      finalCode = code;
    } else if (ALLOWED.indexOf(desc) !== -1) {
      finalCode = "SUMMARY";
    }
    if (!finalCode) continue;

    dateCols.forEach(function (col) {
      var val = data[r][col.colIndex];
      if (typeof val === "number" && val !== 0) {
        if (filterMonth && col.date !== filterMonth) return;

        results.push([
          lc,          // LC
          term,        // LC_Term
          col.year,    // Year  (integer)
          col.month,   // Month ("Feb")
          col.date,    // Date  ("2025-02-01")
          reportType,  // Report_Type  "CFS" or "PnL"
          finalCode,   // GFB_Code
          desc,        // Description
          val          // Amount
        ]);
      }
    });
  }

  return results;
}

// ─── Write rows to a named tab (full overwrite) ───────────────────────────────
function _writeTallSheet(dataRows, tabName) {
  var masterSs = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
  var sheet    = masterSs.getSheetByName(tabName) || masterSs.insertSheet(tabName);

  var HEADERS = ["LC", "LC_Term", "Year", "Month", "Date", "Report_Type", "GFB_Code", "Description", "Amount"];
  var out     = [HEADERS].concat(dataRows);

  sheet.clear();
  sheet.getRange(1, 1, out.length, out[0].length).setValues(out);

  try { sheet.getFilter().remove(); } catch (e) { /* none */ }
  sheet.getRange(1, 1, out.length, HEADERS.length).createFilter();

  Logger.log("  ✓ " + dataRows.length + " rows → " + tabName);
}
