/**
 * Data Mapper: MASTER_COMBINED_TALL → Database Schema
 *
 * The Google Sheet uses a tall/tidy format with GFB (Global Finance Book) codes.
 * Each row = one financial line item for one LC in one month.
 *
 * Columns: LC, LC_Term, Year, Month, Date, Report_Type, GFB_Code, Description, Amount
 *
 * This mapper:
 *  1. Maps LC codes → entity IDs (CC→Colombo Central, etc.)
 *  2. Classifies rows as Revenue, Cost, or Balance Sheet based on description
 *  3. Maps items to function codes (iGV, iGT, oGV, oGT, ELD, EwA, BD)
 *  4. Aggregates per (entity, month) for monthly_metrics
 */

import type { FunctionCode } from "@/lib/finance";

// ─── LC code → entity name mapping ──────────────────────────────────────────
export const LC_CODE_TO_NAME: Record<string, string> = {
  CC: "Colombo Central",
  CN: "Colombo North",
  CS: "Colombo South",
  Kandy: "Kandy",
  Jaffna: "Jaffna",
  USJ: "USJ",
  NSBM: "NSBM",
  Ruhuna: "Ruhuna",
  Rajarata: "Rajarata",
  SLIIT: "SLIIT",
  NIBM: "NIBM",
  Wayamba: "Wayamba",
};

// ─── Row classification ─────────────────────────────────────────────────────

export type RowCategory = "revenue" | "cost" | "balance_sheet" | "unknown";

/**
 * Classify a row based on GFB code prefix and description.
 * GFB 7xxx = Revenue/Cost (PnL). GFB 1xxx = Balance sheet (CFS).
 */
export function classifyRow(
  gfbCode: string,
  description: string,
  reportType: string
): RowCategory {
  const desc = description.toLowerCase();
  const code = gfbCode.trim();

  // PnL items
  if (reportType === "PnL" || code.startsWith("7") || code.startsWith("8")) {
    if (
      desc.includes("revenue") ||
      desc.includes("partner fee") ||
      desc.includes("program fee") ||
      desc.includes("grants") ||
      desc.includes("donations") ||
      desc.includes("participant fee") ||
      desc.includes("miscellaneous revenue")
    ) {
      return "revenue";
    }
    // Everything else in PnL is cost
    return "cost";
  }

  // CFS / Balance sheet items
  if (reportType === "CFS" || code.startsWith("1")) {
    return "balance_sheet";
  }

  return "unknown";
}

// ─── Function code mapping ──────────────────────────────────────────────────

/**
 * Map a description to a function code for revenue/cost streams.
 */
export function descriptionToFunctionCode(description: string): FunctionCode {
  const desc = description.toLowerCase();

  if (desc.includes("igv")) return "iGV";
  if (desc.includes("igta") || desc.includes("igte")) return "iGT";
  if (desc.includes("ogv")) return "oGV";
  if (desc.includes("ogta") || desc.includes("ogte")) return "oGT";
  if (desc.includes("eld") || desc.includes("leadership")) return "ELD";
  if (desc.includes("ewa")) return "EwA";

  // Everything else → BD (Business Development / general management)
  return "BD";
}

// ─── Balance-sheet field mapping ────────────────────────────────────────────

export type BalanceField =
  | "bank_balance"
  | "assets"
  | "receivables"
  | "equity"
  | "liabilities"
  | null;

/**
 * Map a CFS description to a monthly_metrics balance-sheet field.
 */
export function descriptionToBalanceField(description: string): BalanceField {
  const desc = description.toLowerCase();

  if (desc.includes("bank account") || desc.includes("petty cash")) return "bank_balance";
  if (desc.includes("receivable")) return "receivables";
  if (desc.includes("equity")) return "equity";
  if (
    desc.includes("long term assets") ||
    desc.includes("prepaid")
  ) {
    return "assets";
  }

  return null;
}

// ─── Parsed row type ────────────────────────────────────────────────────────

export interface ParsedRow {
  lcCode: string;
  entityName: string;
  term: string;
  periodMonth: string; // YYYY-MM-DD
  reportType: string;
  gfbCode: string;
  description: string;
  amount: number;
  category: RowCategory;
  functionCode: FunctionCode | null;
  balanceField: BalanceField;
}

/**
 * Parse a single raw sheet row into a structured ParsedRow.
 * Returns null if the row is invalid or empty.
 */
export function parseRow(row: any[]): ParsedRow | null {
  if (!row || row.length < 9) return null;

  const lcCode = String(row[0] || "").trim();
  const term = String(row[1] || "").trim();
  const date = String(row[4] || "").trim(); // YYYY-MM-DD format
  const reportType = String(row[5] || "").trim();
  const gfbCode = String(row[6] || "").trim();
  const description = String(row[7] || "").trim();
  const amountStr = String(row[8] || "0").replace(/[^0-9.\-]/g, "");
  const amount = parseFloat(amountStr) || 0;

  if (!lcCode || !date) return null;

  const entityName = LC_CODE_TO_NAME[lcCode];
  if (!entityName) return null;

  // Normalize date to first-of-month
  const periodMonth = date.length >= 10 ? date.substring(0, 10) : null;
  if (!periodMonth) return null;

  const category = classifyRow(gfbCode, description, reportType);
  const functionCode =
    category === "revenue" || category === "cost"
      ? descriptionToFunctionCode(description)
      : null;
  const balanceField =
    category === "balance_sheet"
      ? descriptionToBalanceField(description)
      : null;

  return {
    lcCode,
    entityName,
    term,
    periodMonth,
    reportType,
    gfbCode,
    description,
    amount,
    category,
    functionCode,
    balanceField,
  };
}
