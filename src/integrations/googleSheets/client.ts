/**
 * Google Sheets API v4 Client
 *
 * Fetches data from the AIESEC SL finance Google Sheet.
 * Uses the MASTER_COMBINED_TALL tab (tall/tidy format).
 */

const SHEET_ID = "11veq_V1Eh4ZZ7PxDKnrc0GAJrXP2HGHbenAIXcFDgw8";
const DEFAULT_RANGE = "MASTER_COMBINED_TALL!A1:I10000";

/**
 * Fetch raw data from Google Sheet by range
 */
export async function fetchSheetData(
  spreadsheetId: string = SHEET_ID,
  range: string = DEFAULT_RANGE,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[][]> {
  const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "VITE_GOOGLE_SHEETS_API_KEY not found in .env. Please add your Google Sheets API key.",
    );
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Sheets API error (${response.status}): ${body}`);
  }

  const data = await response.json();
  return data.values || [];
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
