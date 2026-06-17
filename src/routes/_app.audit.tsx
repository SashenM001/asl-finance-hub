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
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchEntities, type Entity } from "@/lib/finance";
import { format, parseISO } from "date-fns";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_app/audit")({
  component: AuditPage,
});

interface AuditRow {
  entity_id: string;
  period_month: string;
  quarter: string | null;
  score: number | null;
  max_score: number | null;
  remarks: string | null;
}

function AuditPage() {
  const { profile, isLC, isMC, isEFB } = useAuth();
  const [filters, setFilters] = useState<FilterState>(defaultFilters());
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);

  useEffect(() => {
    fetchEntities().then(setEntities);
  }, []);

  useEffect(() => {
    const lock = isLC && !isMC && !isEFB;
    const eid = lock ? profile?.entity_id : filters.entityId !== "all" ? filters.entityId : null;
    (async () => {
      let q = supabase
        .from("audit_scores")
        .select("entity_id,period_month,quarter,score,max_score,remarks")
        .order("period_month", { ascending: false });
      if (eid) q = q.eq("entity_id", eid);
      if (filters.from) q = q.gte("period_month", filters.from);
      if (filters.to) q = q.lte("period_month", filters.to);
      const { data } = await q;
      setRows((data ?? []) as AuditRow[]);
    })();
  }, [filters, profile?.entity_id, isLC, isMC, isEFB]);

  const entityName = (id: string) => entities.find((e) => e.id === id)?.name ?? "—";

  const quarterly = useMemo(() => {
    const map = new Map<string, { quarter: string; total: number; max: number; count: number }>();
    rows.forEach((r) => {
      const k = `${r.period_month.slice(0, 4)}-${r.quarter ?? "—"}`;
      const cur = map.get(k) ?? { quarter: k, total: 0, max: 0, count: 0 };
      cur.total += Number(r.score ?? 0);
      cur.max += Number(r.max_score ?? 100);
      cur.count++;
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.quarter.localeCompare(a.quarter));
  }, [rows]);

  const exportCSV = () => {
    const header = "Entity,Period,Quarter,Score,Max,Remarks";
    const body = rows
      .map((r) =>
        [
          entityName(r.entity_id),
          r.period_month,
          r.quarter ?? "",
          r.score ?? "",
          r.max_score ?? "",
          `"${(r.remarks ?? "").replace(/"/g, '""')}"`,
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">EFB Audit &amp; Reports</h2>
          <p className="text-sm text-muted-foreground">Monthly &amp; quarterly audit scoring.</p>
        </div>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>
      <Filters value={filters} onChange={setFilters} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quarterly summary</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quarter</TableHead>
                <TableHead className="text-right">Avg score</TableHead>
                <TableHead className="text-right">Audits</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quarterly.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    No data
                  </TableCell>
                </TableRow>
              )}
              {quarterly.map((q) => {
                const pct = q.max > 0 ? (q.total / q.max) * 100 : 0;
                return (
                  <TableRow key={q.quarter}>
                    <TableCell className="font-medium">{q.quarter}</TableCell>
                    <TableCell className="text-right">{pct.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{q.count}</TableCell>
                    <TableCell>
                      <ScoreBadge pct={pct} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly audit breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Quarter</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    No data
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r, i) => {
                const pct =
                  r.max_score && r.max_score > 0 ? ((r.score ?? 0) / r.max_score) * 100 : 0;
                return (
                  <TableRow key={i}>
                    <TableCell>{entityName(r.entity_id)}</TableCell>
                    <TableCell>{format(parseISO(r.period_month), "MMM yyyy")}</TableCell>
                    <TableCell>{r.quarter}</TableCell>
                    <TableCell className="text-right">
                      {r.score?.toFixed(0)}/{r.max_score?.toFixed(0)}
                    </TableCell>
                    <TableCell>
                      <ScoreBadge pct={pct} />
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {r.remarks}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ScoreBadge({ pct }: { pct: number }) {
  if (pct >= 80)
    return (
      <Badge className="bg-aiesec-green/15 text-aiesec-green hover:bg-aiesec-green/15">
        Excellent
      </Badge>
    );
  if (pct >= 60)
    return (
      <Badge className="bg-aiesec-orange/15 text-aiesec-orange hover:bg-aiesec-orange/15">
        Acceptable
      </Badge>
    );
  return (
    <Badge className="bg-aiesec-red/15 text-aiesec-red hover:bg-aiesec-red/15">
      Needs attention
    </Badge>
  );
}
