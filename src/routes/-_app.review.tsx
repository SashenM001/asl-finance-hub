import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { fetchEntities, type Entity } from "@/lib/finance";
import { format, parseISO } from "date-fns";

// export const Route = createFileRoute("/_app/review")({
//   component: ReviewPage,
// });

interface ReviewRow {
  entity_id: string;
  period_month: string;
  status: string;
  remarks: string | null;
}

function ReviewPage() {
  const { profile, isLC, isMC, isEFB } = useAuth();
  const [filters, setFilters] = useState<FilterState>(defaultFilters());
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);

  useEffect(() => {
    fetchEntities().then(setEntities);
  }, []);

  useEffect(() => {
    const lock = isLC && !isMC && !isEFB;
    const eid = lock ? profile?.entity_id : filters.entityId !== "all" ? filters.entityId : null;
    (async () => {
      let q = supabase
        .from("monthly_review")
        .select("entity_id,period_month,status,remarks")
        .order("period_month", { ascending: false });
      if (eid) q = q.eq("entity_id", eid);
      if (filters.from) q = q.gte("period_month", filters.from);
      if (filters.to) q = q.lte("period_month", filters.to);
      const { data } = await q;
      setRows((data ?? []) as ReviewRow[]);
    })();
  }, [filters, profile?.entity_id, isLC, isMC, isEFB]);

  const entityName = (id: string) => entities.find((e) => e.id === id)?.name ?? "—";
  const passes = rows.filter((r) => r.status === "pass").length;
  const fails = rows.filter((r) => r.status === "fail").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Finance Monthly Review</h2>
        <p className="text-sm text-muted-foreground">Pass/fail tracker and remarks history.</p>
      </div>
      <Filters value={filters} onChange={setFilters} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Total reviews</div>
            <div className="text-2xl font-semibold">{rows.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Passes</div>
            <div className="text-2xl font-semibold text-aiesec-green">{passes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Fails</div>
            <div className="text-2xl font-semibold text-aiesec-red">{fails}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Review history</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    No data
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{entityName(r.entity_id)}</TableCell>
                  <TableCell>{format(parseISO(r.period_month), "MMM yyyy")}</TableCell>
                  <TableCell>
                    {r.status === "pass" ? (
                      <Badge className="bg-aiesec-green/15 text-aiesec-green hover:bg-aiesec-green/15">
                        Pass
                      </Badge>
                    ) : r.status === "fail" ? (
                      <Badge className="bg-aiesec-red/15 text-aiesec-red hover:bg-aiesec-red/15">
                        Fail
                      </Badge>
                    ) : (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-md text-muted-foreground">{r.remarks}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
