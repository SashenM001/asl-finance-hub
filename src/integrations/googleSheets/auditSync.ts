/**
 * Audit Sync Service
 *
 * Reads the MASTER_AUDIT_TALL tab (built by the AppScript audit syncer from the
 * "LEY Consolidation" tab of the EFB Audit Performance Dashboard) and upserts
 * into the `audit_scores` table.
 *
 * Tall row contract (must match _writeAuditTallSheet in
 * appscript/master-audit-tall-sync.gs):
 *   LC | LC_Term | Year | Month | Date | Audit_Result | Audit_Score | Quality_Improvement
 *
 * Values are stored AS-IS (no scaling): Audit_Score (a 0..1 fraction) → score,
 * Audit_Result ("Pass"/"Fail") → remarks.
 *
 * Pipeline:
 *  1. Fetch all rows from MASTER_AUDIT_TALL
 *  2. Map each LC label → entity_id
 *  3. Build one audit_scores row per (entity, month)
 *  4. Delete-then-insert per (entity, period) — audit_scores has no unique
 *     constraint on (entity_id, period_month), so upsert/onConflict is not usable.
 */

import { fetchSheetData } from "./client";
import { supabase } from "@/integrations/supabase/client";

// Same master workbook that holds MASTER_COMBINED_TALL (not a secret — also in client.ts).
const MASTER_SHEET_ID = "11veq_V1Eh4ZZ7PxDKnrc0GAJrXP2HGHbenAIXcFDgw8";
const AUDIT_RANGE = "MASTER_AUDIT_TALL!A1:H10000";

/**
 * LC label (as it appears in the "LEY Consolidation" tab) → canonical entity `code`.
 *
 * The audit dashboard labels are inconsistent — some are entity codes (CC, CN,
 * CS, NSBM, SLIIT, NIBM, USJ), others are entity *names* (Kandy, Rajarata,
 * Ruhuna) whose codes differ (KDY, RAJ, RUH). This map normalizes every audit
 * label to the entity `code` so resolution is unambiguous. The audit dashboard
 * covers 10 LCs.
 */
const AUDIT_LC_TO_CODE: Record<string, string> = {
  CC: "CC", // Colombo Central
  CN: "CN", // Colombo North
  CS: "CS", // Colombo South
  Kandy: "KDY",
  NIBM: "NIBM",
  NSBM: "NSBM",
  Rajarata: "RAJ",
  Ruhuna: "RUH",
  SLIIT: "SLIIT",
  USJ: "USJ",
};

export interface AuditSyncResult {
  success: boolean;
  message: string;
  scoresInserted: number;
  errors: string[];
}

interface AuditScoreRow {
  entity_id: string;
  period_month: string;
  quarter: string | null;
  score: number | null;
  max_score: number | null;
  remarks: string | null;
}

/** Build a map of entity `code` → id from the DB. */
async function buildEntityCodeMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("entities").select("id,code");
  if (error) throw new Error(`Failed to load entities: ${error.message}`);
  const map = new Map<string, string>();
  data?.forEach((e: { id: string; code: string | null }) => {
    if (e.code) map.set(e.code, e.id);
  });
  return map;
}

/** Resolve a raw audit LC label → entity_id (via the normalization map). */
function resolveEntityId(lcLabel: string, codeMap: Map<string, string>): string | null {
  const code = AUDIT_LC_TO_CODE[lcLabel.trim()];
  if (!code) return null;
  return codeMap.get(code) ?? null;
}

/** Parse a sheet cell into a number, or null if blank/non-numeric. Stored as-is. */
function toNumberOrNull(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/**
 * Main: Fetch MASTER_AUDIT_TALL → map → delete-then-insert into audit_scores.
 */
export async function syncAuditData(): Promise<AuditSyncResult> {
  const errors: string[] = [];
  let scoresInserted = 0;

  try {
    console.log("📋 Syncing audit data (MASTER_AUDIT_TALL)...");

    const rows = await fetchSheetData(MASTER_SHEET_ID, AUDIT_RANGE);
    if (!rows || rows.length < 2) {
      return {
        success: false,
        message: "Audit sheet appears to be empty",
        scoresInserted: 0,
        errors: ["No data rows found in MASTER_AUDIT_TALL"],
      };
    }
    console.log(`✅ Fetched ${rows.length - 1} audit rows`);

    const codeMap = await buildEntityCodeMap();
    console.log(`✅ Loaded ${codeMap.size} entity codes from database`);

    // Column indices (must match the tall contract above).
    const LC = 0,
      DATE = 4,
      RESULT = 5,
      SCORE = 6;
    // QI = 7 is parsed-but-not-stored — audit_scores has no column for it (see note).

    const payload: AuditScoreRow[] = [];
    const unknownLcs = new Set<string>();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const lcLabel = String(row[LC] ?? "").trim();
      const periodMonth = String(row[DATE] ?? "").trim();
      if (!lcLabel || !periodMonth) continue;

      const entityId = resolveEntityId(lcLabel, codeMap);
      if (!entityId) {
        unknownLcs.add(lcLabel);
        continue;
      }

      const result = String(row[RESULT] ?? "").trim();

      payload.push({
        entity_id: entityId,
        period_month: periodMonth, // "YYYY-MM-01"
        quarter: null, // data is monthly, not quarterly
        score: toNumberOrNull(row[SCORE]), // raw 0..1 fraction, stored as-is
        max_score: null, // consolidation provides no separate max
        remarks: result || null, // "Pass" / "Fail"
      });
    }

    if (unknownLcs.size > 0) {
      errors.push(`Unmapped LC labels (skipped): ${Array.from(unknownLcs).join(", ")}`);
    }

    if (payload.length === 0) {
      return {
        success: false,
        message: "No audit rows could be mapped to entities",
        scoresInserted: 0,
        errors,
      };
    }

    // Delete-then-insert per (entity, period) — no unique constraint to upsert on.
    const entityPeriods = new Set(payload.map((r) => `${r.entity_id}|${r.period_month}`));
    for (const ep of entityPeriods) {
      const [eid, pm] = ep.split("|");
      const { error } = await supabase
        .from("audit_scores")
        .delete()
        .eq("entity_id", eid)
        .eq("period_month", pm);
      if (error) errors.push(`Delete ${ep}: ${error.message}`);
    }

    const { error: insertError } = await supabase.from("audit_scores").insert(payload);
    if (insertError) {
      errors.push(`Audit scores insert: ${insertError.message}`);
      console.error("❌ Audit insert error:", insertError);
    } else {
      scoresInserted = payload.length;
      console.log(`✅ Inserted ${scoresInserted} audit score rows`);
    }

    const message =
      errors.length === 0
        ? `✅ Audit sync complete! Inserted ${scoresInserted} audit scores`
        : `⚠️ Audit sync completed with ${errors.length} issue(s)`;

    return { success: errors.length === 0, message, scoresInserted, errors };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ Audit sync failed:", message);
    errors.push(message);
    return { success: false, message: `Audit sync failed: ${message}`, scoresInserted, errors };
  }
}
