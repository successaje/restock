import type { ReactNode } from "react";
import { cn } from "@/lib/format";
import { Card } from "../ui/card";
import { Skeleton, Tooltip } from "../ui/misc";
import { Info } from "lucide-react";

/** Stat tile: label · value · optional delta and trend. */
export function StatTile({
  label,
  value,
  delta,
  deltaTone = "neutral",
  trend,
  help,
  loading,
  className,
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  deltaTone?: "good" | "bad" | "neutral";
  trend?: ReactNode;
  help?: ReactNode;
  loading?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col justify-between gap-4 p-5", className)}>
      {/* Label row carries the sparkline, so the value always has the full width. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[13px] text-muted">
          {label}
          {help && (
            <Tooltip content={help}>
              <button className="text-faint transition hover:text-ink" aria-label={`About ${label}`}>
                <Info className="size-3.5" />
              </button>
            </Tooltip>
          )}
        </div>
        {trend && <div className="-mt-1 hidden shrink-0 sm:block">{trend}</div>}
      </div>
      <div className="min-w-0">
        {loading ? (
          <Skeleton className="h-7 w-28" />
        ) : (
          <div className="truncate text-[21px] font-semibold leading-none tracking-[-0.03em] sm:text-[26px]">{value}</div>
        )}
        {delta && (
          <div
            className={cn(
              "mt-2 text-xs font-medium",
              deltaTone === "good" ? "text-good" : deltaTone === "bad" ? "text-bad" : "text-muted",
            )}
          >
            {delta}
          </div>
        )}
      </div>
    </Card>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-[26px] font-semibold tracking-[-0.035em] sm:text-[30px]">{title}</h2>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
