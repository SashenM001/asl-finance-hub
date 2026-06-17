import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { Filters, defaultFilters, type FilterState } from "@/components/Filters";
import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchMetrics,
  fmtCurrency,
  fmtPct,
  fmtNumber,
  FUNCTION_CODES,
  type FunctionCode,
  type MonthlyMetric,
} from "@/lib/finance";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Banknote, Wallet, ArrowDownCircle, ArrowUpCircle, Landmark, Coins, TrendingUp, TrendingDown, Activity, X, Plus, ChevronRight, Download, Pin } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend, PieChart, Pie, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { PnLReport } from "@/components/PnLReport";
import { DashboardDock } from "@/components/DashboardDock";
import { PnLMatrixView } from "@/components/PnLMatrixView";

export const Route = createFileRoute("/_app/lc")({
  component: LCDashboard,
});

const FN_COLORS = [
  "var(--aiesec-blue)",
  "var(--aiesec-teal)",
  "var(--aiesec-orange)",
  "var(--aiesec-red)",
  "var(--aiesec-purple)",
  "var(--aiesec-green)",
  "var(--aiesec-yellow)",
];

const CustomLegend = (props: any) => {
  const { payload } = props;
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 pt-4">
      {payload?.map((entry: any, index: number) => (
        <div key={`item-${index}`} className="flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs font-medium text-muted-foreground leading-none">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

interface FnRow {
  entity_id: string;
  period_month: string;
  function_code: FunctionCode;
  amount: number;
}

interface DashboardSplitProps {
  config: {
    entity: string | null;
    term: string;
    function: string;
    from: string;
    to: string;
    viewMode: string;
  };
  onUpdate: (config: {
    entity: string | null;
    term: string;
    function: string;
    from: string;
    to: string;
    viewMode: string;
  }) => void;
  onRemove: () => void;
  isSplit: boolean;
  onMove?: (direction: "left" | "right") => void;
  isFirst?: boolean;
  isLast?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
}

function calculateTermFromDate(dateStr: string): string {
  if (!dateStr) return "all";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "all";

  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = January, 1 = February

  // AIESEC term starts in February
  const termStartYear = month >= 1 ? year : year - 1;
  const startShort = termStartYear % 100;
  const endShort = (termStartYear + 1) % 100;

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(startShort)}-${pad(endShort)}`;
}

function DashboardSplit({ config, onUpdate, onRemove, isSplit, onMove, isFirst, isLast, isPinned, onTogglePin }: DashboardSplitProps) {
  const { profile, isLC, isMC, isEFB } = useAuth();
  const [filters, setFilters] = useState<FilterState>(() => ({
    ...defaultFilters(),
    entityId: config.entity || "all",
    term: config.term || "all",
    functionCode: (config.function as FunctionCode) || "all",
    from: config.from,
    to: config.to,
  }));
  const [metrics, setMetrics] = useState<MonthlyMetric[]>([]);
  const [revenue, setRevenue] = useState<FnRow[]>([]);
  const [costs, setCosts] = useState<FnRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setFilters((prev) => {
      const nextEntityId = config.entity || "all";
      const nextTerm = config.term || "all";
      const nextFunctionCode = (config.function as FunctionCode) || "all";
      const nextFrom = config.from;
      const nextTo = config.to;
      if (
        prev.entityId !== nextEntityId ||
        prev.term !== nextTerm ||
        prev.functionCode !== nextFunctionCode ||
        prev.from !== nextFrom ||
        prev.to !== nextTo
      ) {
        return {
          ...prev,
          entityId: nextEntityId,
          term: nextTerm,
          functionCode: nextFunctionCode,
          from: nextFrom,
          to: nextTo,
        };
      }
      return prev;
    });
  }, [config.entity, config.term, config.function, config.from, config.to]);

  useEffect(() => {
    const lockEntity = isLC && !isMC && !isEFB;
    const entityId = lockEntity
      ? profile?.entity_id
      : filters.entityId !== "all"
        ? filters.entityId
        : null;



    setLoading(true);
    (async () => {
      const ids = entityId ? [entityId] : undefined;
      const [m, rev, c] = await Promise.all([
        fetchMetrics(ids, filters.from, filters.to),
        loadFn("revenue_streams", ids, filters),
        loadFn("cost_breakdown", ids, filters),
      ]);
      setMetrics(m);
      setRevenue(rev);
      setCosts(c);
      setLoading(false);
    })();
  }, [filters, profile?.entity_id, isLC, isMC, isEFB]);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    const calculatedTerm = calculateTermFromDate(newFilters.from);
    onUpdate({
      entity: newFilters.entityId === "all" ? null : newFilters.entityId,
      term: calculatedTerm,
      function: newFilters.functionCode,
      from: newFilters.from,
      to: newFilters.to,
      viewMode: config.viewMode,
    });
  };

  const aggregatedMetrics = useMemo(() => {
    const byMonth = new Map<
      string,
      {
        period_month: string;
        bank_balance: number;
        assets: number;
        liabilities: number;
        receivables: number;
        equity: number;
        inflow: number;
        outflow: number;
        total_revenue: number;
        total_cost: number;
        petty_cash: number;
        reserves: number;
      }
    >();

    metrics.forEach((m) => {
      const k = m.period_month;
      const cur = byMonth.get(k) ?? {
        period_month: k,
        bank_balance: 0,
        assets: 0,
        liabilities: 0,
        receivables: 0,
        equity: 0,
        inflow: 0,
        outflow: 0,
        total_revenue: 0,
        total_cost: 0,
        petty_cash: 0,
        reserves: 0,
      };
      cur.bank_balance += m.bank_balance ?? 0;
      cur.assets += m.assets ?? 0;
      cur.liabilities += m.liabilities ?? 0;
      cur.receivables += m.receivables ?? 0;
      cur.equity += m.equity ?? 0;
      cur.inflow += m.inflow ?? 0;
      cur.outflow += m.outflow ?? 0;
      cur.total_revenue += m.total_revenue ?? 0;
      cur.total_cost += m.total_cost ?? 0;
      cur.petty_cash += m.petty_cash ?? 0;
      cur.reserves += m.reserves ?? 0;
      byMonth.set(k, cur);
    });

    return Array.from(byMonth.values())
      .sort((a, b) => a.period_month.localeCompare(b.period_month))
      .map((m) => {
        const liquidity = m.liabilities > 0 ? (m.bank_balance + m.receivables) / m.liabilities : 0;
        return {
          ...m,
          liquidity,
        };
      });
  }, [metrics]);

  const latest = aggregatedMetrics[aggregatedMetrics.length - 1];

  const cashTrend = useMemo(
    () =>
      aggregatedMetrics.map((m) => ({
        label: format(parseISO(m.period_month), "MMM yy"),
        bank: m.bank_balance ?? 0,
        inflow: m.inflow ?? 0,
        outflow: m.outflow ?? 0,
        net: (m.inflow ?? 0) - (m.outflow ?? 0),
      })),
    [aggregatedMetrics],
  );

  const revByFn = useMemo(
    () => aggregateByFn(revenue, filters.functionCode),
    [revenue, filters.functionCode],
  );
  const revByFnPie = useMemo(
    () =>
      revByFn.filter(
        (r) => r.fn !== "ELD" && r.fn !== "NMF" && r.fn !== "National Conference Delegation",
      ),
    [revByFn],
  );
  const costByFn = useMemo(
    () => aggregateByFn(costs, filters.functionCode).filter((c) => c.fn !== "ELD"),
    [costs, filters.functionCode],
  );

  const gpmByFn = useMemo(
    () =>
      FUNCTION_CODES.filter(
        (fn) => fn !== "ELD" && fn !== "NMF" && fn !== "National Conference Delegation",
      ).map((fn) => {
        const r = revenue
          .filter((x) => x.function_code === fn)
          .reduce((s, x) => s + Number(x.amount), 0);
        const c = costs
          .filter((x) => x.function_code === fn)
          .reduce((s, x) => s + Number(x.amount), 0);
        return { fn, gpm: r > 0 ? ((r - c) / r) * 100 : 0 };
      }),
    [revenue, costs],
  );

  // Equity change across the filtered period
  const equityChange = useMemo(() => {
    if (aggregatedMetrics.length < 2) return null;
    const first = aggregatedMetrics[0].equity ?? 0;
    const last = aggregatedMetrics[aggregatedMetrics.length - 1].equity ?? 0;
    return last > 0 ? ((last - first) / last) * 100 : 0;
  }, [aggregatedMetrics]);

  // Revenue & Cost distribution %
  const revDistribution = useMemo(() => {
    const filtered = revByFn.filter(
      (r) => r.fn !== "ELD" && r.fn !== "NMF" && r.fn !== "National Conference Delegation",
    );
    const total = filtered.reduce((s, r) => s + r.amount, 0);
    return filtered.map((r) => ({ fn: r.fn, pct: total > 0 ? (r.amount / total) * 100 : 0 }));
  }, [revByFn]);

  const costDistribution = useMemo(() => {
    const total = costByFn.reduce((s, r) => s + r.amount, 0);
    return costByFn.map((r) => ({ fn: r.fn, pct: total > 0 ? (r.amount / total) * 100 : 0 }));
  }, [costByFn]);

  // MoCR = (bank_balance + petty_cash + reserves - liabilities) / avg monthly cost over last 12 months.
  // petty_cash (8502) and reserves (8602) are stored as separate DB columns to allow precise numerator isolation.
  // Total Assets on the frontend sums all five buckets (assets + bank_balance + receivables + petty_cash + reserves)
  // without any data duplication in the backend.
  const mocr = useMemo(() => {
    if (!latest) return null;
    const numerator =
      (latest.bank_balance ?? 0) +
      (latest.petty_cash ?? 0) +
      (latest.reserves ?? 0) -
      (latest.liabilities ?? 0);
    const last12 = metrics.slice(-12);
    const totalCost12m = last12.reduce((s, m) => s + (m.total_cost ?? 0), 0);
    const avgMonthlyCost = last12.length > 0 ? totalCost12m / last12.length : 0;
    return avgMonthlyCost > 0 ? +(numerator / avgMonthlyCost).toFixed(2) : null;
  }, [metrics, latest]);

  const isLoading = loading;
  const data = metrics;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 gap-y-2 pb-4 border-b">
        <div className="flex-grow">
          <Filters
            value={filters}
            onChange={handleFilterChange}
            showFunctionFilter={false}
            showTermFilter={false}
            showDateFilters={true}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex rounded-md border p-0.5 bg-muted">
            <button
              onClick={() => onUpdate({ ...config, viewMode: "graphical" })}
              className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-all cursor-pointer ${config.viewMode === "graphical"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Graphical
            </button>
            <button
              onClick={() => onUpdate({ ...config, viewMode: "report" })}
              className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-all cursor-pointer ${config.viewMode === "report"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Report
            </button>
          </div>
          {isSplit && (
            <Button 
              variant={isPinned ? "default" : "outline"} 
              size="icon" 
              className={`h-10 w-10 transition-colors ${isPinned ? "bg-blue-600 text-white hover:bg-blue-700" : ""}`} 
              onClick={onTogglePin} 
              title={isPinned ? "Unpin Card" : "Pin to Compare"}
            >
              <Pin className="h-4 w-4" />
            </Button>
          )}
          {isSplit && !isFirst && (
            <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => onMove?.("left")} title="Move Left">
              ←
            </Button>
          )}
          {isSplit && !isLast && (
            <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => onMove?.("right")} title="Move Right">
              →
            </Button>
          )}
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={onRemove} title="Remove Split">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading && <div className="p-8 text-center text-gray-500">Loading financial data...</div>}

      {!isLoading && (!data || data.length === 0) && (
        <div className="p-8 text-center text-gray-500">No data available for this selection.</div>
      )}

      {!isLoading && data && data.length > 0 && config.viewMode === "graphical" && latest && (
        <div className="mt-4 space-y-4">
          <div className={isSplit ? "flex flex-wrap gap-3" : "grid gap-4 md:grid-cols-3 lg:grid-cols-5"}>
            <KpiCard label="Bank Balance" value={fmtCurrency(latest.bank_balance)} icon={<Wallet className="h-4 w-4" />} accent="primary" className={isSplit ? "flex-grow min-w-[140px]" : ""} />
            {/* Total Assets = assets + bank_balance + receivables + petty_cash + reserves.
                petty_cash (8502) and reserves (8602) are stored in separate DB columns (not merged into assets)
                to allow the MoCR numerator to be calculated precisely. No double-counting in the backend. */}
            <KpiCard label="Total Assets" value={fmtCurrency((latest.assets ?? 0) + (latest.bank_balance ?? 0) + (latest.receivables ?? 0) + (latest.petty_cash ?? 0) + (latest.reserves ?? 0))} icon={<Landmark className="h-4 w-4" />} accent="teal" className={isSplit ? "flex-grow min-w-[140px]" : ""} />
            <KpiCard label="Liabilities" value={fmtCurrency(latest.liabilities)} icon={<ArrowDownCircle className="h-4 w-4" />} accent="red" className={isSplit ? "flex-grow min-w-[140px]" : ""} />
            <KpiCard label="Receivables" value={fmtCurrency(latest.receivables)} icon={<ArrowUpCircle className="h-4 w-4" />} accent="orange" className={isSplit ? "flex-grow min-w-[140px]" : ""} />
            {/* <KpiCard label="Liquidity" value={fmtNumber(latest.liquidity, 2)} icon={<Coins className="h-4 w-4" />} accent="green" /> */}
            <KpiCard label="Equity" value={fmtCurrency(latest.equity)} icon={<Banknote className="h-4 w-4" />} accent="purple" className={isSplit ? "flex-grow min-w-[140px]" : ""} />
          </div>

          <div className={isSplit ? "flex flex-wrap gap-3" : "grid gap-4 md:grid-cols-4"}>
            {/* <KpiCard label="NPM (Term)" value={fmtPct(termNpm)} icon={<Activity className="h-4 w-4" />} accent="teal" /> */}
            <KpiCard label="Equity Change" value={fmtPct(equityChange ?? 0)} icon={equityChange !== null && equityChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />} accent={equityChange !== null && equityChange >= 0 ? "green" : "red"} className={isSplit ? "flex-grow min-w-[140px]" : ""} />
            <KpiCard label="Total Revenue" value={fmtCurrency(metrics.reduce((s, m) => s + (m.total_revenue ?? 0), 0))} icon={<Banknote className="h-4 w-4" />} accent="green" className={isSplit ? "flex-grow min-w-[140px]" : ""} />
            <KpiCard label="Total Cost" value={fmtCurrency(metrics.reduce((s, m) => s + (m.total_cost ?? 0), 0))} icon={<ArrowDownCircle className="h-4 w-4" />} accent="red" className={isSplit ? "flex-grow min-w-[140px]" : ""} />
            {/* MoCR = (bank_balance + petty_cash + reserves - liabilities) / avg monthly cost (last 12 months) */}
            <KpiCard label="MoCR" value={mocr !== null ? `${fmtNumber(mocr, 2)}` : "—"} icon={<Activity className="h-4 w-4" />} accent="teal" className={isSplit ? "flex-grow min-w-[140px]" : ""} />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Cash and Cash Equivalent trend</CardTitle></CardHeader>
            <CardContent className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cashTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmtCurrency(Number(v))} />
                  <Line
                    type="monotone"
                    dataKey="bank"
                    stroke="var(--aiesec-blue)"
                    strokeWidth={2.5}
                    dot={false}
                    name="Bank balance"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 w-full">
            <Card>
              <CardHeader><CardTitle className="text-base">Inflow vs Outflow</CardTitle></CardHeader>
              <CardContent className="h-[300px] w-full">
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
              <CardContent className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => fmtCurrency(Number(v))} />
                    <Bar dataKey="net" name="Net">
                      {cashTrend.map((d, i) => (
                        <Cell
                          key={i}
                          fill={d.net >= 0 ? "var(--aiesec-green)" : "var(--aiesec-red)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className={isSplit ? "grid grid-cols-1 gap-6 w-full mb-8" : "grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-8"}>
            <Card>
              <CardHeader><CardTitle className="text-base">Revenue by function</CardTitle></CardHeader>
              <CardContent className="h-[300px] w-full overflow-x-auto">
                <div className="w-full h-full min-w-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={revByFnPie} dataKey="amount" nameKey="fn" innerRadius={50} outerRadius={90}>
                        {revByFnPie.map((_, i) => <Cell key={i} fill={FN_COLORS[i % FN_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmtCurrency(Number(v))} />
                      <Legend content={<CustomLegend />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Cost by function</CardTitle></CardHeader>
              <CardContent className="h-[300px] w-full overflow-x-auto">
                <div className="w-full h-full min-w-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={costByFn} dataKey="amount" nameKey="fn" innerRadius={50} outerRadius={90}>
                        {costByFn.map((_, i) => <Cell key={i} fill={FN_COLORS[i % FN_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmtCurrency(Number(v))} />
                      <Legend content={<CustomLegend />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">GPM by function (%)</CardTitle></CardHeader>
            <CardContent className="h-[300px] w-full overflow-x-auto">
              <div className="w-full h-full min-w-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gpmByFn}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="fn"
                      tick={{ fontSize: 11, angle: -45, textAnchor: "end", dy: 8 }}
                      height={60}
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => `${Number(v).toFixed(2)}%`} />

                    <Bar dataKey="gpm">
                      {gpmByFn.map((_, i) => (
                        <Cell key={`cell-${i}`} fill={FN_COLORS[i % FN_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className={isSplit ? "grid grid-cols-1 gap-6 w-full mb-8" : "grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-8"}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue Distribution (%)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {revDistribution.map((r) => (
                    <div key={r.fn} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-xs font-medium">{r.fn}</span>
                      <div className="flex-1 rounded-full bg-muted h-3 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(r.pct, 100)}%` }}
                        />
                      </div>
                      <span className="w-12 text-xs text-right font-medium">
                        {r.pct.toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cost Distribution (%)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {costDistribution.map((r) => (
                    <div key={r.fn} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-xs font-medium">{r.fn}</span>
                      <div className="flex-1 rounded-full bg-muted h-3 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-aiesec-red"
                          style={{ width: `${Math.min(r.pct, 100)}%` }}
                        />
                      </div>
                      <span className="w-12 text-xs text-right font-medium">
                        {r.pct.toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {!isLoading && data && data.length > 0 && config.viewMode === "report" && (
        <div className="mt-4">
          <PnLReport revenue={revenue} costs={costs} isSplit={isSplit} />
        </div>
      )}
    </div>
  );
}

function LCDashboard() {
  const [viewMode, setViewMode] = useState<'charts' | 'pnl'>('charts');
  const [activeMatrixIndex, setActiveMatrixIndex] = useState(0);
  const [pinnedViewId, setPinnedViewId] = useState<string | null>(null);
  const [views, setViews] = useState<{
    id: string;
    entity: string;
    term: string;
    function: string;
    from: string;
    to: string;
    viewMode: string;
  }[]>(() => {
    const defaultF = defaultFilters();
    return [
      {
        id: "1",
        entity: "Select LC",
        term: "25-26",
        function: "all",
        from: defaultF.from,
        to: defaultF.to,
        viewMode: "graphical",
      },
    ];
  });

  const [showScrollHint, setShowScrollHint] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const canScrollRight = container.scrollWidth - container.scrollLeft > container.clientWidth + 5;
      setShowScrollHint(canScrollRight);

      window.dispatchEvent(new CustomEvent('pnl-scroll-metrics', {
        detail: { 
          scrollLeft: container.scrollLeft, 
          scrollWidth: container.scrollWidth, 
          clientWidth: container.clientWidth 
        }
      }));
    };

    handleScroll();

    const resizeObserver = new ResizeObserver(() => {
      handleScroll();
    });
    resizeObserver.observe(container);

    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
    };
  }, [views, viewMode]);

  useEffect(() => {
    const handler = (e: any) => {
      if (viewMode === 'charts' && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ left: e.detail, behavior: 'smooth' });
      }
    };
    window.addEventListener('pnl-scroll-to', handler);
    return () => window.removeEventListener('pnl-scroll-to', handler);
  }, [viewMode]);

  const handleAddView = () => {
    const defaultF = defaultFilters();
    const newId = Date.now().toString();
    setViews((prev) => [
      ...prev,
      {
        id: newId,
        entity: "Select LC",
        term: "25-26",
        function: "all",
        from: defaultF.from,
        to: defaultF.to,
        viewMode: "graphical",
      },
    ]);
  };

  const handleUpdate = (
    id: string,
    newConfig: {
      entity: string | null;
      term: string;
      function: string;
      from: string;
      to: string;
      viewMode: string;
    }
  ) => {
    setViews((prev) =>
      prev.map((v) =>
        v.id === id
          ? {
            ...v,
            entity: newConfig.entity || "Select LC",
            term: newConfig.term,
            function: newConfig.function,
            from: newConfig.from,
            to: newConfig.to,
            viewMode: newConfig.viewMode,
          }
          : v
      )
    );
  };

  const handleRemove = (id: string) => {
    setViews((prev) => prev.filter((v) => v.id !== id));
  };

  const handleMove = (index: number, direction: "left" | "right") => {
    setViews((prev) => {
      const next = [...prev];
      const targetIndex = direction === "left" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const handleEditConfig = (id: string) => {
    setViewMode('charts');
    setTimeout(() => {
      document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">LC Dashboard</h2>
          <p className="text-sm text-muted-foreground">Local Committee detailed financial view.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-muted p-1 rounded-lg">
            <button
              onClick={() => setViewMode('charts')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'charts' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Charts
            </button>
            <button
              onClick={() => setViewMode('pnl')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'pnl' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              PnL Matrix
            </button>
          </div>
          
          {viewMode === 'pnl' && (
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('export-pnl-csv'))}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-2 text-sm font-medium shadow-sm border border-transparent"
            >
              <Download className="w-4 h-4" /> Download CSV
            </button>
          )}

          {viewMode === 'charts' && (
            <button 
              onClick={handleAddView}
              className="px-4 py-2 bg-[#037EF3] text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium shadow-sm"
            >
              <Plus size={16} /> Add Split View
            </button>
          )}
        </div>
      </div>

      {views.length === 0 ? (
        <Card className="border-dashed p-12 text-center">
          <CardContent className="space-y-4 pt-6">
            <p className="text-muted-foreground">No active split views. Add a split view to compare financial metrics.</p>
            <Button onClick={handleAddView} className="gap-2 mx-auto">
              <Plus className="h-4 w-4" /> Add Split View
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="relative w-full">
          {viewMode === 'charts' ? (
            <>
              <div
                ref={scrollContainerRef}
                className="flex flex-row flex-nowrap overflow-x-auto gap-6 p-4 w-full h-full items-start"
              >
                {views.map((view, index) => {
                  const isPinned = view.id === pinnedViewId;

                  return (
                    <div 
                      key={view.id} 
                      id={`card-${view.id}`} 
                      className={`${views.length === 1 ? "w-full" : "flex-none w-[500px]"} border rounded-xl p-3 md:p-6 shadow-sm space-y-4 transition-all duration-300 ${
                        isPinned ? "sticky left-0 z-20 shadow-xl border-2 border-blue-500 bg-white" : "bg-card/50"
                      }`}
                    >
                      <DashboardSplit
                        config={{
                          entity: view.entity === "Select LC" ? null : view.entity,
                          term: view.term,
                          function: view.function,
                          from: view.from,
                          to: view.to,
                          viewMode: view.viewMode,
                        }}
                        onUpdate={(newConfig) => handleUpdate(view.id, newConfig)}
                        onRemove={() => {
                          if (pinnedViewId === view.id) setPinnedViewId(null);
                          handleRemove(view.id);
                        }}
                        isSplit={views.length > 1}
                        onMove={(direction) => handleMove(index, direction)}
                        isFirst={index === 0}
                        isLast={index === views.length - 1}
                        isPinned={isPinned}
                        onTogglePin={() => setPinnedViewId(isPinned ? null : view.id)}
                      />
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => {
                  if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollBy({ left: 300, behavior: "smooth" });
                  }
                }}
                className={`fixed right-4 top-1/2 -translate-y-1/2 z-50 transition-opacity duration-300 bg-white/80 p-2 rounded-full shadow-lg border hover:scale-110 cursor-pointer ${
                  showScrollHint ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                }`}
                title="Scroll Right"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : (
            <PnLMatrixView 
              configs={views} 
              onAddConfig={handleAddView} 
              onRemoveConfig={handleRemove} 
              onEditConfig={handleEditConfig} 
              onUpdateConfig={(id, updates) => setViews(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v))}
              onScrollIndexChange={setActiveMatrixIndex}
            />
          )}

          <DashboardDock 
            views={views} 
            onReorder={setViews} 
            onRemove={handleRemove} 
            activeMatrixId={viewMode === 'pnl' ? views[activeMatrixIndex]?.id : undefined}
          />
        </div>
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
  const out = FUNCTION_CODES.filter((c) => fnFilter === "all" || c === fnFilter).map((fn) => ({
    fn,
    amount: map.get(fn) ?? 0,
  }));
  return out;
}
