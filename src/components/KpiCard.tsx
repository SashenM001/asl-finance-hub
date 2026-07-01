import { Card, CardContent } from "@/components/ui/card";
import type { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  hint,
  icon,
  accent = "primary",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  accent?: "primary" | "teal" | "orange" | "purple" | "green" | "red";
  className?: string;
}) {
  const accentMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    teal: "bg-aiesec-teal/15 text-aiesec-teal",
    orange: "bg-aiesec-orange/15 text-aiesec-orange",
    purple: "bg-aiesec-purple/15 text-aiesec-purple",
    green: "bg-aiesec-green/15 text-aiesec-green",
    red: "bg-aiesec-red/15 text-aiesec-red",
  };
  return (
    <Card className={`overflow-hidden ${className || ""}`}>
      <CardContent className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="text-sm font-bold leading-snug">{value}</div>
          {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
        </div>
        {icon && (
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${accentMap[accent]}`}
          >
            {icon}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
