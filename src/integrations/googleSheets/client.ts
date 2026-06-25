/**
 * Google Sheets API v4 Client
 *
 * Fetches data from the AIESEC SL finance Google Sheet.
 * Uses the MASTER_COMBINED_TALL tab (tall/tidy format).
 *
 * Reads are routed through the `pull-sheet-data` Supabase Edge Function,
 * which authenticates via a Service Account — the master sheet stays private.
 */

import { supabase } from "@/integrations/supabase/client";

const SHEET_ID = "11veq_V1Eh4ZZ7PxDKnrc0GAJrXP2HGHbenAIXcFDgw8";
const DEFAULT_RANGE = "MASTER_COMBINED_TALL!A1:I10000";

/**
 * Fetch raw data from Google Sheet via the pull-sheet-data Edge Function.
 * The spreadsheetId and range params are kept for API compatibility but
 * the Edge Function currently serves MASTER_COMBINED_TALL only.
 */
export async function fetchSheetData(
  _spreadsheetId: string = SHEET_ID,
  _range: string = DEFAULT_RANGE,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[][]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated — cannot fetch sheet data");

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pull-sheet-data`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Sheet pull failed with HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Google Sheets API error (403): ${data.error ?? "unknown"}`);
  }

  return data.values ?? [];
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
