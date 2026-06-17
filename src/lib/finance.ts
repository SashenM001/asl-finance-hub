import { supabase } from "@/integrations/supabase/client";

export interface Entity {
  id: string;
  name: string;
  code: string | null;
}

export interface MonthlyMetric {
  id: string;
  entity_id: string;
  period_month: string;
  term: string | null;
  bank_balance: number | null;
  inflow: number | null;
  outflow: number | null;
  assets: number | null;
  // MoCR-specific: isolated from assets. Frontend sums all five for Total Assets display.
  petty_cash: number | null;
  reserves: number | null;
  liabilities: number | null;
  receivables: number | null;
  liquidity: number | null;
  equity: number | null;
  total_revenue: number | null;
  total_cost: number | null;
  npm: number | null;
  gpm: number | null;
  finance_health_index: number | null;
  finance_od_score: number | null;
  global_ranking: number | null;
  ap_ranking: number | null;
}

export type FunctionCode =
  | "iGV"
  | "iGT"
  | "oGV"
  | "oGT"
  | "ELD"
  | "EwA"
  | "Miscellaneous"
  | "NMF"
  | "Conference"
  | "National Conference Delegation";

export const FUNCTION_CODES: FunctionCode[] = [
  "iGV",
  "iGT",
  "oGV",
  "oGT",
  "ELD",
  "EwA",
  "Miscellaneous",
  "NMF",
  "Conference",
  "National Conference Delegation",
];

export const FUNCTION_COLORS: Record<FunctionCode, string> = {
  iGV: "var(--aiesec-blue)",
  iGT: "var(--aiesec-teal)",
  oGV: "var(--aiesec-orange)",
  oGT: "var(--aiesec-red)",
  ELD: "var(--aiesec-purple)",
  EwA: "var(--aiesec-green)",
  Miscellaneous: "var(--aiesec-yellow)",
  NMF: "var(--aiesec-yellow)",
  Conference: "var(--aiesec-blue)",
  "National Conference Delegation": "var(--aiesec-blue)",
};

export async function fetchEntities(): Promise<Entity[]> {
  const { data } = await supabase.from("entities").select("id,name,code").order("name");
  return (data ?? []) as Entity[];
}

export async function fetchMetrics(entityIds?: string[], from?: string, to?: string) {
  let q = supabase.from("monthly_metrics").select("*").order("period_month");
  if (entityIds && entityIds.length) q = q.in("entity_id", entityIds);
  if (from) q = q.gte("period_month", from);
  if (to) q = q.lte("period_month", to);
  const { data } = await q;
  return (data ?? []) as MonthlyMetric[];
}

export function fmtCurrency(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function fmtNumber(n: number | null | undefined, digits = 1) {
  if (n == null) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function fmtPct(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n.toFixed(2)}%`;
}

export function formatEntityName(name: string) {
  if (!name || name === "Unassigned LC" || name === "all") {
    return "All Entities";
  }
  
  const map: Record<string, string> = {
    "Colombo North": "C. North",
    "Colombo South": "C. South",
    "Colombo Central": "C. Central"
  };
  return map[name] || name;
}

// export interface PnLMetrics {
//   igvIncome: number;
//   igtIncome: number;
//   ogvIncome: number;
//   ogtIncome: number;
//   eldIncome: number;
//   igvExpense: number;
//   igtExpense: number;
//   ogvExpense: number;
//   ogtExpense: number;
//   eldExpense: number;
//   grossProfit: number;
//   ewaIncome: number;
//   conferenceIncome: number;
//   pmIncome: number;
//   miscIncome: number;
//   totalIncome: number;
//   ewaExpense: number;
//   conferenceExpense: number;
//   natConferenceExpense: number;
//   nmfExpense: number;
//   pmExpense: number;
//   miscExpense: number;
//   totalExpense: number;
//   netProfit: number;
// }

// export function calculatePnLMetrics(rows: { gfbCode: string; amount: number }[]): PnLMetrics {
//   const metrics: PnLMetrics = {
//     igvIncome: 0,
//     igtIncome: 0,
//     ogvIncome: 0,
//     ogtIncome: 0,
//     eldIncome: 0,
//     igvExpense: 0,
//     igtExpense: 0,
//     ogvExpense: 0,
//     ogtExpense: 0,
//     eldExpense: 0,
//     grossProfit: 0,
//     ewaIncome: 0,
//     conferenceIncome: 0,
//     pmIncome: 0,
//     miscIncome: 0,
//     totalIncome: 0,
//     ewaExpense: 0,
//     conferenceExpense: 0,
//     natConferenceExpense: 0,
//     nmfExpense: 0,
//     pmExpense: 0,
//     miscExpense: 0,
//     totalExpense: 0,
//     netProfit: 0,
//   };

  rows.forEach(({ gfbCode, amount }) => {
    // Income
    if (/^700[1-5]/.test(gfbCode)) metrics.igvIncome += amount;
    else if (/^700[6-8]/.test(gfbCode)) metrics.ogvIncome += amount;
    else if (/^70(09|1[0126789])/.test(gfbCode)) metrics.igtIncome += amount;
    else if (/^70(1[345]|2[012])/.test(gfbCode)) metrics.ogtIncome += amount;
    
    else if (/^71(0[1-9]|1[01])/.test(gfbCode)) metrics.ewaIncome += amount;
    else if (/^730[12]/.test(gfbCode)) metrics.conferenceIncome += amount;
    else if (/^730[3-9]/.test(gfbCode)) metrics.pmIncome += amount;
    else if (/^7501/.test(gfbCode)) metrics.miscIncome += amount;

    // Expenses
    else if (/^760[1-4]/.test(gfbCode)) metrics.igvExpense += amount;
    else if (/^760[5-7]/.test(gfbCode)) metrics.ogvExpense += amount;
    else if (/^76(0[89]|10|1[456])/.test(gfbCode)) metrics.igtExpense += amount;
    else if (/^76(1[123789])/.test(gfbCode)) metrics.ogtExpense += amount;

    else if (/^770[1-6]/.test(gfbCode)) metrics.ewaExpense += amount;
    else if (/^7901/.test(gfbCode)) metrics.conferenceExpense += amount;
    else if (/^8108/.test(gfbCode)) metrics.natConferenceExpense += amount;
    else if (/^8207/.test(gfbCode)) metrics.nmfExpense += amount;
    else if (/^790[2-5]/.test(gfbCode)) metrics.pmExpense += amount;
    else if (
      /^800[12]/.test(gfbCode) ||
      /^810[1-79]/.test(gfbCode) ||
      /^820[1-68]/.test(gfbCode) ||
      /^840[12]/.test(gfbCode)
    ) {
      metrics.miscExpense += amount;
    }
  });

  // Calculate Aggregates
  metrics.eldIncome = metrics.igvIncome + metrics.ogvIncome + metrics.igtIncome + metrics.ogtIncome;
  metrics.totalIncome = metrics.eldIncome + metrics.ewaIncome + metrics.conferenceIncome + metrics.pmIncome + metrics.miscIncome;

  metrics.eldExpense = metrics.igvExpense + metrics.ogvExpense + metrics.igtExpense + metrics.ogtExpense;
  metrics.totalExpense = metrics.eldExpense + metrics.ewaExpense + metrics.conferenceExpense + metrics.natConferenceExpense + metrics.nmfExpense + metrics.pmExpense + metrics.miscExpense;

  metrics.grossProfit = metrics.eldIncome - metrics.eldExpense;
  metrics.netProfit = metrics.totalIncome - metrics.totalExpense;

  return metrics;
}
