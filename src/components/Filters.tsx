import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { fetchEntities, type Entity, FUNCTION_CODES, type FunctionCode } from "@/lib/finance";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export interface FilterState {
  entityId: string | "all";
  from: string;
  to: string;
  functionCode: FunctionCode | "all";
  term: string | "all";
}

export function defaultFilters(): FilterState {
  const now = new Date();
  return {
    entityId: "all",
    from: "2024-02-01",
    to: now.toISOString().slice(0, 10),
    functionCode: "all",
    term: "all",
  };
}


export function Filters({ value, onChange, showFunctionFilter = true }: { value: FilterState; onChange: (v: FilterState) => void; showFunctionFilter?: boolean }) {
  const { isLC, isMC, isEFB, profile } = useAuth();
  const [entities, setEntities] = useState<Entity[]>([]);

  useEffect(() => {
    fetchEntities().then(setEntities);
  }, []);

  // Lock entity for LC users
  useEffect(() => {
    if (isLC && !isMC && !isEFB && profile?.entity_id && value.entityId !== profile.entity_id) {
      onChange({ ...value, entityId: profile.entity_id });
    }
  }, [isLC, isMC, isEFB, profile?.entity_id]);

  const lockEntity = isLC && !isMC && !isEFB;

  return (
    <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-5">
      {!lockEntity && (
        <div className="space-y-1">
          <Label className="text-xs">Entity</Label>
          <Select value={value.entityId} onValueChange={(v) => onChange({ ...value, entityId: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              {entities.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-xs">From</Label>
        <Input type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">To</Label>
        <Input type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} />
      </div>
      {showFunctionFilter && (
        <div className="space-y-1">
          <Label className="text-xs">Function</Label>
          <Select value={value.functionCode} onValueChange={(v) => onChange({ ...value, functionCode: v as FunctionCode | "all" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All functions</SelectItem>
              {FUNCTION_CODES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-xs">Term</Label>
        <Select value={value.term} onValueChange={(v) => onChange({ ...value, term: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All terms</SelectItem>
            <SelectItem value="24-25">24-25</SelectItem>
            <SelectItem value="25-26">25-26</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
