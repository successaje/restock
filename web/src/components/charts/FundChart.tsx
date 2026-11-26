import { useId, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usd, usdCompact } from "@/lib/format";

type Point = { at: string; usd: number };

/**
 * Restock fund over time. One series, so no legend (the card title names it).
 * Marks per the chart spec: 2px line, ~10% area wash, hairline solid grid,
 * crosshair + tooltip on hover, end value labelled.
 */
export function FundChart({ data, height = 240 }: { data: Point[]; height?: number }) {
  const id = useId().replace(/:/g, "");
  const rows = useMemo(() => data.map((d) => ({ t: Date.parse(d.at), usd: d.usd })), [data]);
  const spanDays = rows.length > 1 ? (rows.at(-1)!.t - rows[0]!.t) / 86_400_000 : 0;
  const tickFmt = (t: number) =>
    new Date(t).toLocaleString(undefined, spanDays > 2 ? { day: "numeric", month: "short" } : { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ height }} className="w-full" role="img" aria-label={`Restock fund over time, latest ${usd(rows.at(-1)?.usd ?? 0)}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-a)" stopOpacity={0.16} />
              <stop offset="100%" stopColor="var(--chart-a)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeWidth={1} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={tickFmt}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={48}
            tickMargin={10}
          />
          <YAxis
            tickFormatter={(v) => (v >= 10_000 ? usdCompact(v) : `$${Math.round(v).toLocaleString()}`)}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickCount={4}
            className="tnum"
          />
          <Tooltip
            cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0]!.payload as { t: number; usd: number };
              return (
                <div className="rounded-[12px] border border-line bg-surface px-3 py-2 shadow-pop">
                  <div className="text-[11px] text-muted">{new Date(p.t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-sm font-semibold">
                    <span className="h-0.5 w-3 rounded-full bg-chart-a" aria-hidden />
                    {usd(p.usd)}
                  </div>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="usd"
            stroke="var(--chart-a)"
            strokeWidth={2}
            fill={`url(#fill-${id})`}
            strokeLinecap="round"
            strokeLinejoin="round"
            activeDot={{ r: 5, fill: "var(--chart-a)", stroke: "var(--surface)", strokeWidth: 2 }}
            dot={false}
            animationDuration={900}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 12-ish point trend line for stat tiles. Decorative: the tile states the value. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const w = 72;
  const h = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 6)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts.at(-1)!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} width={w} height={h} aria-hidden>
      <path d={d} fill="none" stroke="var(--faint)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={2.5} fill="var(--ink)" stroke="var(--surface)" strokeWidth={1.5} />
    </svg>
  );
}
