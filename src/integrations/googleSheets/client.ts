/**
 * Google Sheets API v4 Client
 *
 * Fetches data from the AIESEC SL finance Google Sheet.
 * Financial data comes from MASTER_COMBINED_TALL, audit data from MASTER_AUDIT_TALL.
 *
 * Reads are routed through the `pull-financial-data` / `pull-audit-data` Supabase
 * Edge Functions, which authenticate via a Service Account — the master sheet
 * stays private. Use fetchFinancialData() / fetchAuditData() below.
 */

import { supabase } from "@/integrations/supabase/client";

const SHEET_ID = "11veq_V1Eh4ZZ7PxDKnrc0GAJrXP2HGHbenAIXcFDgw8";

/**
 * Fetch raw sheet rows via a pull Edge Function. Each Edge Function reads exactly
 * one private master tab using a Service Account, so the caller only picks the
 * function name — the tab/range lives server-side.
 */
async function fetchViaEdgeFunction(
  fnName: "pull-financial-data" | "pull-audit-data",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[][]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated — cannot fetch sheet data");

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Sheet pull (${fnName}) failed with HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Google Sheets API error: ${data.error ?? "unknown"}`);
  }

  return data.values ?? [];
}

/** Pull MASTER_COMBINED_TALL (financial) rows. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fetchFinancialData(): Promise<any[][]> {
  return fetchViaEdgeFunction("pull-financial-data");
}

/** Pull MASTER_AUDIT_TALL (audit) rows. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fetchAuditData(): Promise<any[][]> {
  return fetchViaEdgeFunction("pull-audit-data");
}

/**
 * Fetch multiple ranges from same sheet
 */
export async function fetchSheetDataMultiple(
  spreadsheetId: string,
  ranges: string[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Map<string, any[][]>> {
  const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_GOOGLE_SHEETS_API_KEY not found in .env");
  }

  const rangesParam = ranges.map((r) => encodeURIComponent(r)).join("&ranges=");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=${rangesParam}&key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Sheets API error: ${response.statusText}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await response.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = new Map<string, any[][]>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data.valueRanges?.forEach((range: any, index: number) => {
    result.set(ranges[index], range.values || []);
  });

  return result;
}

/**
 * Get sheet metadata (sheet names, grid properties)
 */
export async function getSheetMetadata(spreadsheetId: string) {
  const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_GOOGLE_SHEETS_API_KEY not found in .env");
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Sheets API error: ${response.statusText}`);
  }
  return await response.json();
}
