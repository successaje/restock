import { motion } from "motion/react";
import { plural, usd } from "@/lib/format";

type Row = { key: "naira" | "restock"; label: string; usd: number; units: number };

/**
 * Two horizontal bars: what the same money buys kept in naira vs. with Restock.
 * Two series, so a legend-equivalent sits on each row (label + swatch) and
 * the value is printed at the bar tip. Bars are ≤24px thick with rounded data
 * ends, square at the baseline.
 */
export function CompareBars({ rows, unitName }: { rows: Row[]; unitName: string }) {
  const max = Math.max(...rows.map((r) => r.usd), 1);
  return (
    <div className="space-y-5" role="table" aria-label="Kept in naira compared with Restock">
      {rows.map((r) => {
        const pct = Math.max(2, (r.usd / max) * 100);
        const color = r.key === "restock" ? "bg-chart-a" : "bg-chart-b";
        return (
          <div key={r.key} role="row">
            <div className="mb-2 flex items-baseline justify-between gap-3" role="cell">
              <span className="flex items-center gap-2 text-[13px] text-ink-2">
                <span className={`size-2.5 rounded-[3px] ${color}`} aria-hidden />
                {r.label}
              </span>
              <span className="text-sm">
                <b className="font-semibold">{plural(r.units, "kit")}</b>
                <span className="tnum ml-2 text-muted">{usd(r.usd)}</span>
              </span>
            </div>
            <div className="h-6 w-full" role="cell" aria-label={`${r.label}: ${usd(r.usd)}, ${plural(r.units, unitName)}`}>
              <motion.div
                className={`h-full rounded-r-[6px] ${color}`}
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={{ type: "spring", stiffness: 160, damping: 26 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
