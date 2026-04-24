/**
 * Google Sheets Sync Service
 *
 * Reads MASTER_COMBINED_TALL tab (tall/tidy format with GFB codes),
 * aggregates per (entity, month), and upserts into Supabase.
 *
 * Pipeline:
 *  1. Fetch all rows from Google Sheets
 *  2. Parse each row → ParsedRow (classify, map function code, etc.)
 *  3. Group by (entityName, periodMonth)
 *  4. Aggregate into monthly_metrics, revenue_streams, cost_breakdown
 *  5. Upsert to Supabase
 */

import { fetchSheetData } from "./client";
import { parseRow, type ParsedRow } from "./mapper";
import { supabase } from "@/integrations/supabase/client";
import type { Entity } from "@/lib/finance";
import type { FunctionCode } from "@/lib/finance";

export interface SyncResult {
  success: boolean;
  message: string;
  metricsInserted: number;
  revenueInserted: number;
  costInserted: number;
  errors: string[];
}

/** Composite key for grouping: entityName + periodMonth */
type GroupKey = string;
function makeKey(entityName: string, periodMonth: string): GroupKey {
  return `${entityName}||${periodMonth}`;
}

/** Per-group accumulator */
interface GroupData {
  entityName: string;
  periodMonth: string;
  term: string;
  // Balance sheet (CFS)
  bank_balance: number;
  assets: number;
  receivables: number;
  equity: number;
  liabilities: number;
  // CFS cash flow aggregates
  inflow: number;
  outflow: number;
  // PnL aggregates
  totalRevenue: number;
  totalCost: number;
  // Revenue by function
  revenue: Record<FunctionCode, number>;
  // Cost by function
  cost: Record<FunctionCode, number>;
}

function newGroup(entityName: string, periodMonth: string, term: string): GroupData {
  return {
    entityName,
    periodMonth,
    term,
    bank_balance: 0,
    assets: 0,
    receivables: 0,
    equity: 0,
    liabilities: 0,
    inflow: 0,
    outflow: 0,
    totalRevenue: 0,
    totalCost: 0,
    revenue: { iGV: 0, iGT: 0, oGV: 0, oGT: 0, ELD: 0, EwA: 0, BD: 0 },
    cost: { iGV: 0, iGT: 0, oGV: 0, oGT: 0, ELD: 0, EwA: 0, BD: 0 },
  };
}

/**
 * Build map of entity names → IDs from DB
 */
async function buildEntityMap(): Promise<Map<string, string>> {
  const { data } = await supabase.from("entities").select("id,name,code");
  const map = new Map<string, string>();
  data?.forEach((entity: Entity) => {
    map.set(entity.name, entity.id);
    // Also map by code (e.g., "CC" → id) for fallback
    if (entity.code) {
      map.set(entity.code, entity.id);
    }
  });
  return map;
}

/**
 * Main sync function: Fetch sheet → Parse → Aggregate → Upsert
 */
export async function syncSheetData(): Promise<SyncResult> {
  const errors: string[] = [];
  let metricsInserted = 0;
  let revenueInserted = 0;
  let costInserted = 0;

  try {
    console.log("📊 Syncing Google Sheets data (MASTER_COMBINED_TALL)...");

    // 1. Fetch all rows
    const rows = await fetchSheetData();

    if (!rows || rows.length < 2) {
      return {
        success: false,
        message: "Sheet appears to be empty",
        metricsInserted: 0,
        revenueInserted: 0,
        costInserted: 0,
        errors: ["No data rows found in sheet"],
      };
    }

    console.log(`✅ Fetched ${rows.length - 1} data rows`);

    // 2. Build entity map
    const entityMap = await buildEntityMap();
    console.log(`✅ Loaded ${entityMap.size} entity mappings from database`);

    // 3. Parse rows and group by (entity, month)
    const groups = new Map<GroupKey, GroupData>();
    let parsedCount = 0;
    let skippedCount = 0;

    for (let i = 1; i < rows.length; i++) {
      const parsed = parseRow(rows[i]);
      if (!parsed) {
        skippedCount++;
        continue;
      }

      parsedCount++;
      const key = makeKey(parsed.entityName, parsed.periodMonth);

      if (!groups.has(key)) {
        groups.set(key, newGroup(parsed.entityName, parsed.periodMonth, parsed.term));
      }

      const group = groups.get(key)!;

      switch (parsed.category) {
        case "revenue":
          group.totalRevenue += parsed.amount;
          if (parsed.functionCode) {
            group.revenue[parsed.functionCode] += parsed.amount;
          }
          break;

        case "cost":
          group.totalCost += parsed.amount;
          if (parsed.functionCode) {
            group.cost[parsed.functionCode] += parsed.amount;
          }
          break;

        case "cash_flow":
          if (parsed.balanceField === "cash_inflow") {
            group.inflow += parsed.amount;
          } else if (parsed.balanceField === "cash_outflow") {
            group.outflow += parsed.amount;
          }
          break;

        case "balance_sheet":
          if (parsed.balanceField === "bank_balance") {
            group.bank_balance += parsed.amount;
          } else if (parsed.balanceField === "assets") {
            group.assets += parsed.amount;
          } else if (parsed.balanceField === "receivables") {
            group.receivables += parsed.amount;
          } else if (parsed.balanceField === "equity") {
            group.equity += parsed.amount;
          } else if (parsed.balanceField === "liabilities") {
            group.liabilities += parsed.amount;
          }
          break;
      }
    }

    console.log(`✅ Parsed ${parsedCount} rows, skipped ${skippedCount}, into ${groups.size} (entity, month) groups`);

    // 4. Build upsert payloads
    const metricsPayload: any[] = [];
    const revenuePayload: any[] = [];
    const costPayload: any[] = [];

    for (const group of groups.values()) {
      const entityId = entityMap.get(group.entityName);
      if (!entityId) {
        errors.push(`Entity not found in DB: ${group.entityName}`);
        continue;
      }

      // Calculate derived metrics
      const npm =
        group.totalRevenue > 0
          ? ((group.totalRevenue - group.totalCost) / group.totalRevenue) * 100
          : null;

      // CASH FLOW FALLBACK LOGIC:
      // We prefer the actual 'cash_flow' rows (CFS report type) from the Google Sheet.
      // If none are present (i.e., inflow/outflow are 0), we fall back to a synthetic calculation
      // based on PnL data: (totalRevenue + bank_balance) for inflow, totalCost for outflow.
      const inflow = group.inflow > 0 ? group.inflow : (group.totalRevenue + group.bank_balance);
      const outflow = group.outflow > 0 ? group.outflow : group.totalCost;

      const liquidity = group.bank_balance - group.liabilities;

      // monthly_metrics
      metricsPayload.push({
        entity_id: entityId,
        period_month: group.periodMonth,
        term: group.term || null,
        bank_balance: group.bank_balance || null,
        inflow: inflow || null,
        outflow: outflow || null,
        assets: group.assets || null,
        liabilities: group.liabilities || null,
        receivables: group.receivables || null,
        liquidity: liquidity || null,
        equity: group.equity || null,
        total_revenue: group.totalRevenue || null,
        total_cost: group.totalCost || null,
        npm: npm,
        gpm: null, // Not directly available from this data
        finance_health_index: null,
        finance_od_score: null,
        global_ranking: null,
        ap_ranking: null,
      });

      // revenue_streams (one row per function with non-zero amount)
      for (const [func, amount] of Object.entries(group.revenue)) {
        if (amount > 0) {
          revenuePayload.push({
            entity_id: entityId,
            period_month: group.periodMonth,
            function_code: func as FunctionCode,
            amount,
          });
        }
      }

      // cost_breakdown (one row per function with non-zero amount)
      for (const [func, amount] of Object.entries(group.cost)) {
        if (amount > 0) {
          costPayload.push({
            entity_id: entityId,
            period_month: group.periodMonth,
            function_code: func as FunctionCode,
            amount,
          });
        }
      }
    }

    // 5. Upsert to Supabase
    if (metricsPayload.length > 0) {
      console.log(`⏳ Upserting ${metricsPayload.length} monthly metrics...`);
      const { error } = await supabase
        .from("monthly_metrics")
        .upsert(metricsPayload, { onConflict: "entity_id,period_month" });

      if (error) {
        errors.push(`Monthly metrics: ${error.message}`);
        console.error("❌ Metrics error:", error);
      } else {
        metricsInserted = metricsPayload.length;
        console.log(`✅ Inserted ${metricsInserted} metrics`);
      }
    }

    if (revenuePayload.length > 0) {
      console.log(`⏳ Inserting ${revenuePayload.length} revenue stream rows...`);
      // Delete existing revenue data first (no unique constraint on entity+month+func)
      const entityPeriods = new Set(
        revenuePayload.map((r) => `${r.entity_id}|${r.period_month}`)
      );
      for (const ep of entityPeriods) {
        const [eid, pm] = ep.split("|");
        await supabase
          .from("revenue_streams")
          .delete()
          .eq("entity_id", eid)
          .eq("period_month", pm);
      }

      const { error } = await supabase.from("revenue_streams").insert(revenuePayload);

      if (error) {
        errors.push(`Revenue streams: ${error.message}`);
        console.error("❌ Revenue error:", error);
      } else {
        revenueInserted = revenuePayload.length;
        console.log(`✅ Inserted ${revenueInserted} revenue entries`);
      }
    }

    if (costPayload.length > 0) {
      console.log(`⏳ Inserting ${costPayload.length} cost breakdown rows...`);
      // Delete existing cost data first
      const entityPeriods = new Set(
        costPayload.map((r) => `${r.entity_id}|${r.period_month}`)
      );
      for (const ep of entityPeriods) {
        const [eid, pm] = ep.split("|");
        await supabase
          .from("cost_breakdown")
          .delete()
          .eq("entity_id", eid)
          .eq("period_month", pm);
      }

      const { error } = await supabase.from("cost_breakdown").insert(costPayload);

      if (error) {
        errors.push(`Cost breakdown: ${error.message}`);
        console.error("❌ Cost error:", error);
      } else {
        costInserted = costPayload.length;
        console.log(`✅ Inserted ${costInserted} cost entries`);
      }
    }

    const message =
      errors.length === 0
        ? `✅ Sync complete! Inserted ${metricsInserted} metrics, ${revenueInserted} revenue, ${costInserted} cost entries`
        : `⚠️ Sync completed with ${errors.length} error(s)`;

    console.log(message);

    return {
      success: errors.length === 0,
      message,
      metricsInserted,
      revenueInserted,
      costInserted,
      errors,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ Sync failed:", message);
    errors.push(message);

    return {
      success: false,
      message: `Sync failed: ${message}`,
      metricsInserted,
      revenueInserted,
      costInserted,
      errors,
    };
  }
}
