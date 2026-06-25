// ============================================================
// CONFIG — edit this file to add/remove LCs or new year sheets
// ============================================================




// ─── Master Sheet Settings ─────────────────────────────────────────────────────
// The ID of the central Google Sheet that will act as your database
const MASTER_SPREADSHEET_ID = "11veq_V1Eh4ZZ7PxDKnrc0GAJrXP2HGHbenAIXcFDgw8";

const WEBHOOK_SECRET = PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET");


// Add one entry per consolidated workbook per term.
const CONSOLIDATED_SHEETS = [
  { spreadsheetId: "1nyj5t4F8-EI9f1cxFrK7y3qL8WBra1kuNZJ5vxkVz0M", term: "24-25" },
  { spreadsheetId: "1_9U9EdmiPVRbUPawEwgvcC3PLU1nESXyeNKs7S1eAoc", term: "25-26" },
  { spreadsheetId: "16Ds6cB42ZnKHuNi0UuNZCXBZOxplxu_6bWCKMofT0e0", term: "26-27" }
];



// The Google Sheet ID of the live "EFB Audit Performance Dashboard" workbook.
// remember to update this to handle multiple files of multiple years
const AUDIT_SPREADSHEET_ID = "1Ytp425ujeoS-AWagV4bomz4p-LdT-_Qffh8uCRQ9mVo";

// The tab inside that workbook we read from.
const AUDIT_SOURCE_TAB = "LEY Consolidation";

// The tall tab we write into the central DB workbook (MASTER_SPREADSHEET_ID).
const AUDIT_MASTER_TAB = "MASTER_AUDIT_TALL";

// Term this dashboard covers (the workbook is titled "[EFB 25.26]").
const AUDIT_TERM = "25-26";

// The three section labels in column B, in source order.
const AUDIT_SECTIONS = ["Audit Results", "Audit Scores", "Quality Improvement"];
