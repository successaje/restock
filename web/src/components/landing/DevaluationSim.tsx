import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { motion } from "motion/react";
import { Slider } from "../ui/form";
import { ngn, usd, usdWhole } from "@/lib/format";

const PRICE = 2_400_000;
const MONTHS = 12;
const UNIT = 650;

/**
 * A ₦2.4m system sold over 12 months while the naira weakens by X% over the
 * year (evenly compounded). Two lines: the dollar value of the installments
 * collected so far, (a) if kept in naira vs (b) if converted on arrival.
 */
export function DevaluationSim({ rate }: { rate: number }) {
  const [fall, setFall] = useState(30);
  const { rows, held, converted, lostNgn } = useMemo(() => {
    const monthly = Math.pow(1 + fall / 100, 1 / MONTHS);
    const inst = PRICE / MONTHS;
    let collected = 0;
    let usdConverted = 0;
    const rows = [{ m: 0, held: 0, converted: 0 }];
    for (let m = 1; m <= MONTHS; m++) {
      const r = rate * Math.pow(monthly, m);
      collected += inst;
      usdConverted += inst / r;
      rows.push({ m, held: collected / r, converted: usdConverted });
    }
    const last = rows.at(-1)!;
    const rEnd = rate * (1 + fall / 100);
    return { rows, held: last.held, converted: last.converted, lostNgn: (last.converted - last.held) * rEnd };
  }, [fall, rate]);

  return (
    <div className="rounded-[28px] border border-line bg-surface p-5 shadow-card sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-sm">
          <div className="text-sm text-muted">You sell a system for</div>
          <div className="text-3xl font-semibold tracking-[-0.03em]">{ngn(PRICE)} over 12 months</div>
          <div className="mt-6">
            <div className="mb-3 flex items-baseline justify-between text-sm">
              <span className="text-ink-2">
                The naira weakens by <b className="tnum text-ink">{fall}%</b> over the year
              </span>
            </div>
            <Slider label="Naira weakens over the year by" min={0} max={80} step={5} value={[fall]} onValueChange={([v]) => setFall(v!)} />
            <div className="mt-2 flex justify-between text-[11px] text-faint">
              <span>0%</span>
              <span>80%</span>
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 lg:w-[420px]">
          <Result label="Kept in naira, worth" kits={held / UNIT} usdValue={held} tone="b" />
          <Result label="With Restock, worth" kits={converted / UNIT} usdValue={converted} tone="a" />
          <div className="col-span-2 rounded-[16px] bg-brand-soft px-4 py-3 text-sm">
            {fall === 0 ? (
              <span className="text-ink-2">If the naira holds steady, both come out the same. Restock trades upside for certainty.</span>
            ) : (
              <span className="text-ink-2">
                Converting as it arrives keeps <b className="text-ink">{ngn(lostNgn)}</b> of your money that the exchange rate would otherwise take.
              </span>
            )}
          </div>
        </dl>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-2" aria-hidden>
          <span className="flex items-center gap-2">
            <span className="h-0.5 w-4 rounded-full bg-chart-a" /> Converted as it arrives (Restock)
          </span>
          <span className="flex items-center gap-2">
            <span className="h-0.5 w-4 rounded-full bg-chart-b" /> Kept in naira
          </span>
        </div>
        <div className="h-[260px]" role="img" aria-label={`Dollar value of installments collected: ${usd(converted)} with Restock vs ${usd(held)} kept in naira after 12 months`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 64, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                dataKey="m"
                tickFormatter={(m) => (m === 0 ? "Sale" : `M${m}`)}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval={1}
                tickMargin={10}
              />
              <YAxis tickFormatter={(v) => usdWhole(v)} tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} width={60} tickCount={4} />
              <Tooltip
                cursor={{ stroke: "var(--line-strong)" }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="rounded-[12px] border border-line bg-surface px-3 py-2 text-xs shadow-pop">
                      <div className="mb-1 text-muted">{label === 0 ? "At sale" : `After month ${label}`}</div>
                      <div className="flex items-center gap-2">
                        <span className="h-0.5 w-3 rounded-full bg-chart-a" /> Restock <b className="ml-auto pl-3">{usd(payload.find((p) => p.dataKey === "converted")?.value as number)}</b>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-0.5 w-3 rounded-full bg-chart-b" /> Kept in naira <b className="ml-auto pl-3">{usd(payload.find((p) => p.dataKey === "held")?.value as number)}</b>
                      </div>
                    </div>
                  ) : null
                }
              />
              <Line
                type="monotone"
                dataKey="held"
                stroke="var(--chart-b)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
                isAnimationActive={false}
                label={(p: any) =>
                  p.index === MONTHS ? (
                    <text x={p.x + 8} y={p.y + 4} fontSize={11} fill="var(--ink-2)">
                      Naira
                    </text>
                  ) : null
                }
              />
              <Line
                type="monotone"
                dataKey="converted"
                stroke="var(--chart-a)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
                isAnimationActive={false}
                label={(p: any) =>
                  p.index === MONTHS ? (
                    <text x={p.x + 8} y={p.y + 4} fontSize={11} fontWeight={600} fill="var(--ink)">
                      Restock
                    </text>
                  ) : null
                }
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-[11.5px] text-faint">
          Illustration: dollar value of installments collected to date, starting from today's live rate of ₦{Math.round(rate).toLocaleString()}/$ and a
          ${UNIT} kit. Not a forecast.
        </p>
      </div>
    </div>
  );
}

function Result({ label, kits, usdValue, tone }: { label: string; kits: number; usdValue: number; tone: "a" | "b" }) {
  return (
    <div className="rounded-[16px] border border-line p-4">
      <dt className="flex items-center gap-2 text-xs text-muted">
        <span className={`size-2 rounded-[3px] ${tone === "a" ? "bg-chart-a" : "bg-chart-b"}`} />
        {label}
      </dt>
      <dd className="mt-1">
        <motion.span
          key={Math.round(usdValue)}
          initial={{ y: 6, opacity: 0.4 }}
          animate={{ y: 0, opacity: 1 }}
          className="inline-block text-3xl font-semibold tracking-[-0.03em]"
        >
          {usdWhole(usdValue)}
        </motion.span>
        <div className="tnum text-xs text-muted">≈ {kits.toFixed(1)} kits of stock</div>
      </dd>
    </div>
  );
}
