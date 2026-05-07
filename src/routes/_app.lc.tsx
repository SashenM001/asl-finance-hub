import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Filters, defaultFilters, type FilterState } from "@/components/Filters";
import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchMetrics, fmtCurrency, fmtPct, fmtNumber, FUNCTION_CODES, type FunctionCode, type MonthlyMetric } from "@/lib/finance";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Banknote, Wallet, ArrowDownCircle, ArrowUpCircle, Landmark, Coins, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend, PieChart, Pie, Cell } from "recharts";

export const Route = createFileRoute("/_app/lc")({
  component: LCDashboard,
});

const FN_COLORS = ["var(--aiesec-blue)", "var(--aiesec-teal)", "var(--aiesec-orange)", "var(--aiesec-red)", "var(--aiesec-purple)", "var(--aiesec-green)", "var(--aiesec-yellow)"];

const CustomLegend = (props: any) => {
  const { payload } = props;
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 pt-4">
      {payload?.map((entry: any, index: number) => (
        <div key={`item-${index}`} className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-xs font-medium text-muted-foreground leading-none">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

interface FnRow { entity_id: string; period_month: string; function_code: FunctionCode; amount: number }

function LCDashboard() {
  const { profile, isLC, isMC, isEFB } = useAuth();
  const [filters, setFilters] = useState<FilterState>(defaultFilters());
  const [metrics, setMetrics] = useState<MonthlyMetric[]>([]);
  const [revenue, setRevenue] = useState<FnRow[]>([]);
  const [costs, setCosts] = useState<FnRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const lockEntity = isLC && !isMC && !isEFB;
    const entityId = lockEntity ? profile?.entity_id : filters.entityId !== "all" ? filters.entityId : null;

    setLoading(true);
    (async () => {
      const ids = entityId ? [entityId] : undefined;
      const [m, rev, c] = await Promise.all([
        fetchMetrics(ids, filters.from, filters.to),
        loadFn("revenue_streams", ids, filters),
        loadFn("cost_breakdown", ids, filters),
      ]);
      const f = (rows: MonthlyMetric[]) => filters.term === "all" ? rows : rows.filter((r) => r.term === filters.term);
      setMetrics(f(m));
      setRevenue(rev);
      setCosts(c);
      setLoading(false);
    })();
  }, [filters, profile?.entity_id, isLC, isMC, isEFB]);

  const latest = metrics[metrics.length - 1];

  const cashTrend = useMemo(() => metrics.map((m) => ({
    label: format(parseISO(m.period_month), "MMM yy"),
    bank: m.bank_balance ?? 0,
    inflow: m.inflow ?? 0,
    outflow: m.outflow ?? 0,
    net: (m.inflow ?? 0) - (m.outflow ?? 0),
  })), [metrics]);

  const revByFn = useMemo(() => aggregateByFn(revenue, filters.functionCode), [revenue, filters.functionCode]);
  const costByFn = useMemo(() => aggregateByFn(costs, filters.functionCode), [costs, filters.functionCode]);

  const gpmByFn = useMemo(() => FUNCTION_CODES.map((fn) => {
    const r = revenue.filter((x) => x.function_code === fn).reduce((s, x) => s + Number(x.amount), 0);
    const c = costs.filter((x) => x.function_code === fn).reduce((s, x) => s + Number(x.amount), 0);
    return { fn, gpm: r > 0 ? ((r - c) / r) * 100 : 0 };
  }), [revenue, costs]);

  // Equity change across the filtered period
  const equityChange = useMemo(() => {
    if (metrics.length < 2) return null;
    const first = metrics[0].equity ?? 0;
    const last = metrics[metrics.length - 1].equity ?? 0;
    return first > 0 ? ((last - first) / first) * 100 : 0;
  }, [metrics]);

  // NPM / GPM for the term
  const termNpm = useMemo(() => {
    const rev = metrics.reduce((s, m) => s + (m.total_revenue ?? 0), 0);
    const cost = metrics.reduce((s, m) => s + (m.total_cost ?? 0), 0);
    return rev > 0 ? ((rev - cost) / rev) * 100 : 0;
  }, [metrics]);

  // Revenue & Cost distribution %
  const revDistribution = useMemo(() => {
    const total = revByFn.reduce((s, r) => s + r.amount, 0);
    return revByFn.map((r) => ({ fn: r.fn, pct: total > 0 ? (r.amount / total) * 100 : 0 }));
  }, [revByFn]);

  const costDistribution = useMemo(() => {
    const total = costByFn.reduce((s, r) => s + r.amount, 0);
    return costByFn.map((r) => ({ fn: r.fn, pct: total > 0 ? (r.amount / total) * 100 : 0 }));
  }, [costByFn]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">LC Dashboard</h2>
        <p className="text-sm text-muted-foreground">Local Committee detailed financial view.</p>
      </div>
      <Filters value={filters} onChange={setFilters} />

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}

      {!loading && latest && (
        <>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <KpiCard label="Bank Balance" value={fmtCurrency(latest.bank_balance)} icon={<Wallet className="h-4 w-4" />} accent="primary" />
            <KpiCard label="Assets" value={fmtCurrency(latest.assets)} icon={<Landmark className="h-4 w-4" />} accent="teal" />
            <KpiCard label="Liabilities" value={fmtCurrency(latest.liabilities)} icon={<ArrowDownCircle className="h-4 w-4" />} accent="red" />
            <KpiCard label="Receivables" value={fmtCurrency(latest.receivables)} icon={<ArrowUpCircle className="h-4 w-4" />} accent="orange" />
            <KpiCard label="Liquidity" value={fmtNumber(latest.liquidity, 2)} icon={<Coins className="h-4 w-4" />} accent="green" />
            <KpiCard label="Equity" value={fmtCurrency(latest.equity)} icon={<Banknote className="h-4 w-4" />} accent="purple" />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard label="NPM (Term)" value={fmtPct(termNpm)} icon={<Activity className="h-4 w-4" />} accent="teal" />
            <KpiCard label="Equity Change" value={fmtPct(equityChange ?? 0)} icon={equityChange !== null && equityChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />} accent={equityChange !== null && equityChange >= 0 ? "green" : "red"} />
            <KpiCard label="Total Revenue" value={fmtCurrency(metrics.reduce((s, m) => s + (m.total_revenue ?? 0), 0))} icon={<Banknote className="h-4 w-4" />} accent="green" />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Cash and Cash Equivalent trend</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cashTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmtCurrency(Number(v))} />
                  <Line type="monotone" dataKey="bank" stroke="var(--aiesec-blue)" strokeWidth={2.5} dot={false} name="Bank balance" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Inflow vs Outflow</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => fmtCurrency(Number(v))} />
                    <Legend />
                    <Bar dataKey="inflow" fill="var(--aiesec-green)" name="Inflow" />
                    <Bar dataKey="outflow" fill="var(--aiesec-red)" name="Outflow" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Net cash movement</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => fmtCurrency(Number(v))} />
                    <Bar dataKey="net" name="Net">
                      {cashTrend.map((d, i) => (
                        <Cell key={i} fill={d.net >= 0 ? "var(--aiesec-green)" : "var(--aiesec-red)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="text-base">Revenue by function</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={revByFn} dataKey="amount" nameKey="fn" innerRadius={50} outerRadius={90}>
                      {revByFn.map((_, i) => <Cell key={i} fill={FN_COLORS[i % FN_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmtCurrency(Number(v))} />
                    <Legend content={<CustomLegend />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Cost by function</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={costByFn} dataKey="amount" nameKey="fn" innerRadius={50} outerRadius={90}>
                      {costByFn.map((_, i) => <Cell key={i} fill={FN_COLORS[i % FN_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmtCurrency(Number(v))} />
                    <Legend content={<CustomLegend />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">GPM by function (%)</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gpmByFn}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="fn" tick={{ fontSize: 11, angle: -45, textAnchor: "end", dy: 8 }} height={60} interval={0} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `${Number(v).toFixed(2)}%`} />

                    <Bar dataKey="gpm">
                      {gpmByFn.map((_, i) => (
                        <Cell key={`cell-${i}`} fill={FN_COLORS[i % FN_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Revenue Distribution (%)</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {revDistribution.map((r) => (
                    <div key={r.fn} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-xs font-medium">{r.fn}</span>
                      <div className="flex-1 rounded-full bg-muted h-3 overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(r.pct, 100)}%` }} />
                      </div>
                      <span className="w-12 text-xs text-right font-medium">{r.pct.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Cost Distribution (%)</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {costDistribution.map((r) => (
                    <div key={r.fn} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-xs font-medium">{r.fn}</span>
                      <div className="flex-1 rounded-full bg-muted h-3 overflow-hidden">
                        <div className="h-full rounded-full bg-aiesec-red" style={{ width: `${Math.min(r.pct, 100)}%` }} />
                      </div>
                      <span className="w-12 text-xs text-right font-medium">{r.pct.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {!loading && !latest && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          {isLC && !profile?.entity_id ? "Your account is not assigned to an entity yet. Ask MC admin to assign one." : "No data for the selected filters."}
        </CardContent></Card>
      )}
    </div>
  );
}

async function loadFn(table: "revenue_streams" | "cost_breakdown", ids: string[] | undefined, f: FilterState): Promise<FnRow[]> {
  let q = supabase.from(table).select("entity_id,period_month,function_code,amount");
  if (ids) q = q.in("entity_id", ids);
  if (f.from) q = q.gte("period_month", f.from);
  if (f.to) q = q.lte("period_month", f.to);
  if (f.functionCode !== "all") q = q.eq("function_code", f.functionCode);
  const { data } = await q;
  return (data ?? []) as FnRow[];
}

function aggregateByFn(rows: FnRow[], fnFilter: FunctionCode | "all") {
  const map = new Map<string, number>();
  rows.forEach((r) => map.set(r.function_code, (map.get(r.function_code) ?? 0) + Number(r.amount)));
  const out = FUNCTION_CODES.filter((c) => fnFilter === "all" || c === fnFilter).map((fn) => ({ fn, amount: map.get(fn) ?? 0 }));
  return out;
}
