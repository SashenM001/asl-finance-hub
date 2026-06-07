import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Filters, defaultFilters, type FilterState } from "@/components/Filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fmtCurrency, fmtPct, type FunctionCode } from "@/lib/finance";

// export const Route = createFileRoute("/_app/budget")({
//   component: BudgetPage,
// });

interface BARow {
  entity_id: string;
  period_month: string;
  function_code: FunctionCode | null;
  category: string;
  budget: number;
  actual: number;
}

function BudgetPage() {
  const { profile, isLC, isMC, isEFB } = useAuth();
  const [filters, setFilters] = useState<FilterState>(defaultFilters());
  const [rows, setRows] = useState<BARow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const lock = isLC && !isMC && !isEFB;
    const eid = lock ? profile?.entity_id : filters.entityId !== "all" ? filters.entityId : null;
    setLoading(true);
    (async () => {
      let q = supabase
        .from("budget_actual")
        .select("entity_id,period_month,function_code,category,budget,actual");
      if (eid) q = q.eq("entity_id", eid);
      if (filters.from) q = q.gte("period_month", filters.from);
      if (filters.to) q = q.lte("period_month", filters.to);
      if (filters.functionCode !== "all") q = q.eq("function_code", filters.functionCode);
      const { data } = await q;
      setRows((data ?? []) as BARow[]);
      setLoading(false);
    })();
  }, [filters, profile?.entity_id, isLC, isMC, isEFB]);

  const grouped = useMemo(() => {
    const map = new Map<string, { fn: string; category: string; budget: number; actual: number }>();
    rows.forEach((r) => {
      const k = `${r.function_code ?? "—"}|${r.category}`;
      const cur = map.get(k) ?? {
        fn: r.function_code ?? "—",
        category: r.category,
        budget: 0,
        actual: 0,
      };
      cur.budget += Number(r.budget);
      cur.actual += Number(r.actual);
      map.set(k, cur);
    });
    return Array.from(map.values())
      .map((r) => {
        const variance = r.budget > 0 ? ((r.actual - r.budget) / r.budget) * 100 : 0;
        return { ...r, variance, status: status(variance) };
      })
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
  }, [rows]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Budget vs Actual</h2>
        <p className="text-sm text-muted-foreground">
          Variance analysis with color-coded performance.
        </p>
      </div>
      <Filters value={filters} onChange={setFilters} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Variance by category &amp; function</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Function</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                      No data
                    </TableCell>
                  </TableRow>
                )}
                {grouped.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.fn}</TableCell>
                    <TableCell>{r.category}</TableCell>
                    <TableCell className="text-right">{fmtCurrency(r.budget)}</TableCell>
                    <TableCell className="text-right">{fmtCurrency(r.actual)}</TableCell>
                    <TableCell
                      className={`text-right font-medium ${r.variance > 10 ? "text-aiesec-red" : r.variance < -5 ? "text-aiesec-green" : "text-aiesec-orange"}`}
                    >
                      {fmtPct(r.variance)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge s={r.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function status(v: number): "good" | "warn" | "bad" {
  if (v > 10) return "bad";
  if (Math.abs(v) <= 10) return "good";
  return "warn";
}

function StatusBadge({ s }: { s: "good" | "warn" | "bad" }) {
  if (s === "good")
    return (
      <Badge className="bg-aiesec-green/15 text-aiesec-green hover:bg-aiesec-green/15">
        On track
      </Badge>
    );
  if (s === "warn")
    return (
      <Badge className="bg-aiesec-orange/15 text-aiesec-orange hover:bg-aiesec-orange/15">
        Watch
      </Badge>
    );
  return (
    <Badge className="bg-aiesec-red/15 text-aiesec-red hover:bg-aiesec-red/15">Over budget</Badge>
  );
}
