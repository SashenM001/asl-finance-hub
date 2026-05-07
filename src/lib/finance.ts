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
