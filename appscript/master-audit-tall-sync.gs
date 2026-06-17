// ============================================================
// MASTER_AUDIT_TALL SYNC — AppScript (same project as the financial syncer)
// ============================================================
// Version-controlled reference copy. Lives in the SAME Apps Script project as
// master-combined-tall-sync.gs — Apps Script shares one global namespace across
// all .gs files, so this file reuses:
//   • WEBHOOK_SECRET          (defined in master-combined-tall-sync.gs)
//   • MASTER_SPREADSHEET_ID   (the central DB workbook that holds the tall tabs)
//   • _parseDateHeaderCombTall (date-header parser)
// Do NOT redeclare those here — a duplicate `const`/`function` name in the same
// project is a redeclaration error.
//
// PURPOSE: read the "LEY Consolidation" tab of the EFB Audit Performance
// Dashboard and rebuild a MASTER_AUDIT_TALL tab (full overwrite) in tall/tidy
// format. The browser then pulls that tab and upserts into `audit_scores`.
//
// SOURCE LAYOUT ("LEY Consolidation") — three stacked matrices, LC×Month:
//   ┌ "Audit Results"       header row → month dates in cols C..  ; LC rows = Pass/Fail
//   ├ "Audit Scores"        header row → month dates in cols C..  ; LC rows = fraction 0..1
//   └ "Quality Improvement" header row → month dates in cols C..  ; LC rows = MoM delta
// Column A is empty; col B holds the section label / LC code; data starts col C.
//
// Output columns (the contract the client ingest depends on):
//   LC | LC_Term | Year | Month | Date | Audit_Result | Audit_Score | Quality_Improvement
//     Year  → integer (e.g. 2025)
//     Month → 3-letter abbreviation (e.g. "Jul")
//     Date  → "YYYY-MM-01"  ← used as period_month
//     Audit_Result        → "Pass" / "Fail" (or "" if absent)   → audit_scores.remarks
//     Audit_Score         → fraction 0..1   (or "" if absent)   → audit_scores.score
//     Quality_Improvement → signed delta    (or "" if absent)   → spare / analytics
//   LC is the short code as it appears in the sheet (CC, CN, CS, Kandy, …); the
//   client maps that code → entity_id.
// ============================================================

// ─── Config ─────────────────────────────────────────────────────────────────
// The Google Sheet ID of the live "EFB Audit Performance Dashboard" workbook.
// ⚠️ FILL THIS IN with the real spreadsheet ID (from its URL: /d/<ID>/edit).
const AUDIT_SPREADSHEET_ID = "PUT_AUDIT_DASHBOARD_SPREADSHEET_ID_HERE";

// The tab inside that workbook we read from.
const AUDIT_SOURCE_TAB = "LEY Consolidation";

// The tall tab we write into the central DB workbook (MASTER_SPREADSHEET_ID).
const AUDIT_MASTER_TAB = "MASTER_AUDIT_TALL";

// Term this dashboard covers (the workbook is titled "[EFB 25.26]").
const AUDIT_TERM = "25-26";

// The three section labels in column B, in source order.
const AUDIT_SECTIONS = ["Audit Results", "Audit Scores", "Quality Improvement"];

// ─── Main: read "LEY Consolidation" → rebuild MASTER_AUDIT_TALL ───────────────
// filterMonth (optional): "YYYY-MM-01" — keep only that period. null/omitted = all.
function syncAuditConsolidationMasterSheet(filterMonth) {
  filterMonth = filterMonth || null;

  Logger.log("▶ Opening Audit Dashboard: " + AUDIT_SPREADSHEET_ID);
  var warnings = [];
  var ss, sheet;
  try {
    ss = SpreadsheetApp.openById(AUDIT_SPREADSHEET_ID);
  } catch (e) {
    Logger.log("✗ Error opening audit workbook: " + e.message);
    return { rowsWritten: 0, warnings: ["Error opening audit workbook: " + e.message] };
  }

  sheet = ss.getSheetByName(AUDIT_SOURCE_TAB);
  if (!sheet) {
    Logger.log("✗ Tab '" + AUDIT_SOURCE_TAB + "' not found.");
    return { rowsWritten: 0, warnings: ["Tab '" + AUDIT_SOURCE_TAB + "' not found."] };
  }

  var rows = _extractAuditConsolidation(sheet, AUDIT_TERM, filterMonth, warnings);

  if (rows.length === 0) {
    Logger.log("No audit data collected — nothing to write.");
    return { rowsWritten: 0, warnings: warnings.concat(["No audit data found for the selected filter."]) };
  }

  Logger.log("▶ Writing " + rows.length + " rows to " + AUDIT_MASTER_TAB + "...");
  _writeAuditTallSheet(rows, AUDIT_MASTER_TAB);
  Logger.log("✅ Audit consolidation sync complete.");
  return { rowsWritten: rows.length, warnings: warnings };
}

// ─── Extract the three stacked blocks → one merged row per (LC, month) ────────
function _extractAuditConsolidation(sheet, term, filterMonth, warnings) {
  var data = sheet.getDataRange().getValues();

  // blocks[sectionName] = { dateCols:[{colIndex, year, month, date}], byLc:{ lc:{ dateStr:value } } }
  var blocks = {};
  var lcOrder = [];            // preserve first-seen LC order
  var lcSeen  = {};

  for (var i = 0; i < data.length; i++) {
    var label = String(data[i][1]).trim();   // col B (index 1)
    if (AUDIT_SECTIONS.indexOf(label) === -1) continue;

    // Header row → parse the month columns (col C onward, index 2+).
    var dateCols = [];
    for (var c = 2; c < data[i].length; c++) {
      var raw = data[i][c];
      if (raw === "" || raw === null) continue;
      var p = _parseAuditDate(raw);
      if (!p.date) continue;                  // unparseable header → skip column
      dateCols.push({ colIndex: c, year: p.year, month: p.month, date: p.date });
    }

    var byLc = {};
    // LC rows follow until a blank label in col B.
    var j = i + 1;
    for (; j < data.length; j++) {
      var lc = String(data[j][1]).trim();
      if (lc === "") break;                    // blank row ends the block
      if (AUDIT_SECTIONS.indexOf(lc) !== -1) break; // safety: next section abuts

      if (!lcSeen[lc]) { lcSeen[lc] = true; lcOrder.push(lc); }

      var cells = {};
      dateCols.forEach(function (col) {
        var v = data[j][col.colIndex];
        if (v !== "" && v !== null && v !== undefined) cells[col.date] = v;
      });
      byLc[lc] = cells;
    }

    blocks[label] = { dateCols: dateCols, byLc: byLc };
    i = j - 1; // resume scan just before the blank row
  }

  if (!blocks["Audit Scores"] && !blocks["Audit Results"]) {
    warnings.push("Neither 'Audit Scores' nor 'Audit Results' block found in " + AUDIT_SOURCE_TAB);
    return [];
  }

  // Canonical (date → {year,month}) lookup, built from whichever blocks exist.
  var dateMeta = {};
  AUDIT_SECTIONS.forEach(function (name) {
    if (!blocks[name]) return;
    blocks[name].dateCols.forEach(function (col) {
      dateMeta[col.date] = { year: col.year, month: col.month };
    });
  });

  var results  = blocks["Audit Results"]       ? blocks["Audit Results"].byLc       : {};
  var scores   = blocks["Audit Scores"]        ? blocks["Audit Scores"].byLc        : {};
  var quality  = blocks["Quality Improvement"] ? blocks["Quality Improvement"].byLc : {};

  var out = [];
  lcOrder.forEach(function (lc) {
    Object.keys(dateMeta).forEach(function (dateStr) {
      if (filterMonth && dateStr !== filterMonth) return;

      var result = (results[lc] && results[lc][dateStr] != null) ? results[lc][dateStr] : "";
      var score  = (scores[lc]  && scores[lc][dateStr]  != null) ? scores[lc][dateStr]  : "";
      var qi     = (quality[lc] && quality[lc][dateStr] != null) ? quality[lc][dateStr] : "";

      // Skip months with no data at all for this LC (e.g. future months).
      if (result === "" && score === "" && qi === "") return;

      var meta = dateMeta[dateStr];
      out.push([
        lc,            // LC
        term,          // LC_Term
        meta.year,     // Year
        meta.month,    // Month ("Jul")
        dateStr,       // Date ("2025-07-01")
        result,        // Audit_Result ("Pass"/"Fail")
        score,         // Audit_Score (0..1)
        qi             // Quality_Improvement (delta)
      ]);
    });
  });

  return out;
}

// ─── Parse a date-header cell into {year, month, date} ────────────────────────
// Live Google Sheets returns Date objects for date cells → delegate to the
// shared _parseDateHeaderCombTall. Guard the numeric Excel-serial case (only
// happens if a header cell is plain-number formatted) before delegating.
function _parseAuditDate(raw) {
  if (typeof raw === "number") {
    // Excel/Sheets serial → JS Date (epoch 1899-12-30; 25569 days to 1970-01-01).
    raw = new Date(Math.round((raw - 25569) * 86400 * 1000));
  }
  return _parseDateHeaderCombTall(raw);
}

// ─── Write rows to the audit tall tab (full overwrite) ────────────────────────
function _writeAuditTallSheet(dataRows, tabName) {
  var masterSs = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
  var sheet    = masterSs.getSheetByName(tabName) || masterSs.insertSheet(tabName);

  var HEADERS = ["LC", "LC_Term", "Year", "Month", "Date",
                 "Audit_Result", "Audit_Score", "Quality_Improvement"];
  var out = [HEADERS].concat(dataRows);

  sheet.clear();
  sheet.getRange(1, 1, out.length, out[0].length).setValues(out);

  try { sheet.getFilter().remove(); } catch (e) { /* none */ }
  sheet.getRange(1, 1, out.length, HEADERS.length).createFilter();

  Logger.log("  ✓ " + dataRows.length + " rows → " + tabName);
}
