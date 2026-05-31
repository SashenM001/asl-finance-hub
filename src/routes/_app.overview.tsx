import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Filters, defaultFilters, type FilterState } from "@/components/Filters";
import { KpiCard } from "@/components/KpiCard";
import { fetchMetrics, fmtCurrency, fmtPct, type MonthlyMetric } from "@/lib/finance";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from "recharts";
import { Trophy, Globe, Banknote, TrendingUp, TrendingDown, Heart, Activity, Award } from "lucide-react";
import { format, parseISO } from "date-fns";

export const Route = createFileRoute("/_app/overview")({
  component: OverviewPage,
});

function OverviewPage() {
  const { profile, isLC, isMC, isEFB } = useAuth();
  const [filters, setFilters] = useState<FilterState>(defaultFilters());
  const [metrics, setMetrics] = useState<MonthlyMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const lockEntity = isLC && !isMC && !isEFB;
    const entityIds =
      lockEntity && profile?.entity_id
        ? [profile.entity_id]
        : filters.entityId !== "all"
          ? [filters.entityId]
          : undefined;
    setLoading(true);
    fetchMetrics(entityIds, filters.from, filters.to).then((d) => {
      const filtered = filters.term === "all" ? d : d.filter((m) => m.term === filters.term);
      setMetrics(filtered);
      setLoading(false);
    });
  }, [filters, profile?.entity_id, isLC, isMC, isEFB]);

  const totals = useMemo(() => {
    if (!metrics.length) return null;
    const latest = metrics[metrics.length - 1];
    const totalRevenue = metrics.reduce((s, m) => s + (m.total_revenue ?? 0), 0);
    const totalCost = metrics.reduce((s, m) => s + (m.total_cost ?? 0), 0);
    const npm = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;
    const gpm = metrics.reduce((s, m) => s + (m.gpm ?? 0), 0) / metrics.length;
    const equityFirst = metrics[0].equity ?? 0;
    const equityLast = latest.equity ?? 0;
    const equityGrowth = equityFirst > 0 ? ((equityLast - equityFirst) / equityFirst) * 100 : 0;
    return {
      totalRevenue,
      npm,
      gpm,
      equityGrowth,
      health: latest.finance_health_index ?? 0,
      odScore: latest.finance_od_score ?? 0,
      globalRank: latest.global_ranking ?? 0,
      apRank: latest.ap_ranking ?? 0,
    };
  }, [metrics]);

  const trend = useMemo(() => {
    // Aggregate by month across whatever entities are in scope
    const byMonth = new Map<string, { period: string; revenue: number; cost: number; equity: number }>();
    metrics.forEach((m) => {
      const k = m.period_month;
      const cur = byMonth.get(k) ?? { period: k, revenue: 0, cost: 0, equity: 0 };
      cur.revenue += m.total_revenue ?? 0;
      cur.cost += m.total_cost ?? 0;
      cur.equity += m.equity ?? 0;
      byMonth.set(k, cur);
    });
    return Array.from(byMonth.values())
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((r) => ({ ...r, label: format(parseISO(r.period), "MMM yy") }));
  }, [metrics]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">National Overview</h2>
        <p className="text-sm text-muted-foreground">National finance KPIs and trends.</p>
      </div>
      <Filters value={filters} onChange={setFilters} />

      {loading && <div className="text-sm text-muted-foreground">Loading metrics…</div>}

      {!loading && totals && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            {/* <KpiCard label="Global Ranking" value={`#${totals.globalRank}`} icon={<Globe className="h-4 w-4" />} accent="primary" /> */}
            {/* <KpiCard label="Asia Pacific Rank" value={`#${totals.apRank}`} icon={<Trophy className="h-4 w-4" />} accent="purple" /> */}
            <KpiCard label="Total Revenue" value={fmtCurrency(totals.totalRevenue)} icon={<Banknote className="h-4 w-4" />} accent="green" />
            <KpiCard label="Equity Growth" value={fmtPct(totals.equityGrowth)} icon={totals.equityGrowth >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />} accent={totals.equityGrowth >= 0 ? "green" : "red"} />
            <KpiCard label="NPM" value={fmtPct(totals.npm)} icon={<Activity className="h-4 w-4" />} accent="teal" />
            <KpiCard label="GPM (avg)" value={fmtPct(totals.gpm)} icon={<Activity className="h-4 w-4" />} accent="orange" />
            <KpiCard label="Finance Health Index" value={totals.health.toFixed(0)} icon={<Heart className="h-4 w-4" />} accent="red" />
            <KpiCard label="Finance OD Score" value={totals.odScore.toFixed(0)} icon={<Award className="h-4 w-4" />} accent="purple" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Revenue vs Cost trend</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => fmtCurrency(Number(v))} />
                    <Line type="monotone" dataKey="revenue" stroke="var(--aiesec-blue)" strokeWidth={2} dot={false} name="Revenue" />
                    <Line type="monotone" dataKey="cost" stroke="var(--aiesec-red)" strokeWidth={2} dot={false} name="Cost" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Equity over time</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend}>
                    <defs>
                      <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--aiesec-purple)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="var(--aiesec-purple)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => fmtCurrency(Number(v))} />
                    <Area type="monotone" dataKey="equity" stroke="var(--aiesec-purple)" fill="url(#eq)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {!loading && !totals && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No data for the selected filters.</CardContent></Card>
      )}
    </div>
  );
}
