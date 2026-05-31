import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Filters, defaultFilters, type FilterState } from "@/components/Filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchEntities, fetchMetrics, fmtCurrency, fmtPct, type Entity, type MonthlyMetric } from "@/lib/finance";
import { useAuth } from "@/lib/auth";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { format, parseISO } from "date-fns";

// export const Route = createFileRoute("/_app/performance")({
//   component: PerformancePage,
// });

function PerformancePage() {
  const { profile, isLC, isMC, isEFB } = useAuth();
  const [filters, setFilters] = useState<FilterState>(defaultFilters());
  const [metrics, setMetrics] = useState<MonthlyMetric[]>([]);
  const [allMetrics, setAllMetrics] = useState<MonthlyMetric[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);

  useEffect(() => { fetchEntities().then(setEntities); }, []);

  useEffect(() => {
    const lock = isLC && !isMC && !isEFB;
    const eid = lock ? profile?.entity_id : filters.entityId !== "all" ? filters.entityId : null;
    const ids = eid ? [eid] : undefined;
    Promise.all([
      fetchMetrics(ids, filters.from, filters.to),
      fetchMetrics(undefined, filters.from, filters.to),
    ]).then(([m, all]) => {
      const f = (rows: MonthlyMetric[]) => filters.term === "all" ? rows : rows.filter((r) => r.term === filters.term);
      setMetrics(f(m));
      setAllMetrics(f(all));
    });
  }, [filters, profile?.entity_id, isLC, isMC, isEFB]);

  // Period vs period: split current range in half
  const periodVsPeriod = useMemo(() => {
    if (metrics.length === 0) return [];
    const sorted = [...metrics].sort((a, b) => a.period_month.localeCompare(b.period_month));
    const mid = Math.floor(sorted.length / 2);
    const sum = (rows: MonthlyMetric[], k: keyof MonthlyMetric) =>
      rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    const a = sorted.slice(0, mid);
    const b = sorted.slice(mid);
    return [
      { metric: "Revenue", first: sum(a, "total_revenue"), second: sum(b, "total_revenue") },
      { metric: "Cost", first: sum(a, "total_cost"), second: sum(b, "total_cost") },
      { metric: "Inflow", first: sum(a, "inflow"), second: sum(b, "inflow") },
      { metric: "Outflow", first: sum(a, "outflow"), second: sum(b, "outflow") },
    ];
  }, [metrics]);

  // Entity vs national (only for MC/EFB)
  const entityVsNational = useMemo(() => {
    if (!isMC && !isEFB) return [];
    const byEntity = new Map<string, { revenue: number; cost: number; count: number }>();
    allMetrics.forEach((m) => {
      const cur = byEntity.get(m.entity_id) ?? { revenue: 0, cost: 0, count: 0 };
      cur.revenue += m.total_revenue ?? 0;
      cur.cost += m.total_cost ?? 0;
      cur.count++;
      byEntity.set(m.entity_id, cur);
    });
    const all = Array.from(byEntity.values());
    const natAvgRev = all.reduce((s, x) => s + x.revenue, 0) / Math.max(all.length, 1);
    return Array.from(byEntity.entries()).map(([eid, v]) => ({
      entity: entities.find((e) => e.id === eid)?.code ?? "—",
      revenue: v.revenue,
      nationalAvg: natAvgRev,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [allMetrics, entities, isMC, isEFB]);

  const cumulative = useMemo(() => {
    let running = 0;
    return [...metrics].sort((a, b) => a.period_month.localeCompare(b.period_month)).map((m) => {
      running += m.total_revenue ?? 0;
      return { label: format(parseISO(m.period_month), "MMM yy"), cumRevenue: running };
    });
  }, [metrics]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Performance Analysis</h2>
        <p className="text-sm text-muted-foreground">Period comparisons and benchmarking.</p>
      </div>
      <Filters value={filters} onChange={setFilters} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Period vs Period (1st half vs 2nd half of range)</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={periodVsPeriod}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmtCurrency(Number(v))} />
                <Legend />
                <Bar dataKey="first" fill="var(--aiesec-teal)" name="Period 1" />
                <Bar dataKey="second" fill="var(--aiesec-blue)" name="Period 2" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Cumulative revenue (to-date)</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cumulative}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmtCurrency(Number(v))} />
                <Bar dataKey="cumRevenue" fill="var(--aiesec-purple)" name="Cumulative revenue" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {(isMC || isEFB) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entity vs National Average — Revenue</CardTitle>
          </CardHeader>
          <CardContent className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={entityVsNational}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="entity" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmtCurrency(Number(v))} />
                <Legend />
                <Bar dataKey="revenue" fill="var(--aiesec-blue)" name="Entity revenue" />
                <Bar dataKey="nationalAvg" fill="var(--aiesec-orange)" name="National average" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 text-xs text-muted-foreground">
          Showing {metrics.length} data points. Avg NPM: {fmtPct(metrics.reduce((s, m) => s + (m.npm ?? 0), 0) / Math.max(metrics.length, 1))}.
        </CardContent>
      </Card>
    </div>
  );
}
