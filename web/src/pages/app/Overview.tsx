import { useMemo, useState } from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { ArrowRight, ArrowUpRight, PackageCheck, ShieldCheck, Sparkles } from "lucide-react";
import { useAppState, useHistory } from "@/lib/queries";
import { lagosDate, ngn, plural, rate, usd } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Meter, Segmented, Skeleton } from "@/components/ui/misc";
import { Slider } from "@/components/ui/form";
import { CountUp } from "@/hooks/useCountUp";
import { StatTile } from "@/components/app/Stat";
import { FundChart, Sparkline } from "@/components/charts/FundChart";
import { CompareBars } from "@/components/charts/CompareBars";
import { UnitsRow } from "@/components/illustrations/Kit";
import { ActivityFeed } from "@/components/app/ActivityFeed";
import type { AppState } from "@/lib/api";

const fade = (i: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.04 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
});

export default function Overview() {
  const { data: s, isLoading } = useAppState();
  const [days, setDays] = useState<"7" | "30">("30");
  const { data: history } = useHistory(Number(days));

  if (isLoading || !s) return <OverviewSkeleton />;
  const st = s.stock;

  return (
    <div className="space-y-5">
      <motion.div {...fade(0)}>
        <HeroCard s={s} />
      </motion.div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <motion.div {...fade(1)}>
          <StatTile
            label="Restock fund"
            value={st ? usd(st.fundUsd) : "—"}
            delta="Held in USD₮ in your Altana wallet"
            trend={<Sparkline values={(history?.fund ?? []).slice(-16).map((p) => p.usd)} />}
            help="Dollars set aside for restocking. Converted from your customers' naira installments as they arrived."
          />
        </motion.div>
        <motion.div {...fade(2)}>
          <StatTile
            label="Worth in naira today"
            value={st ? ngn(st.fundNgnToday) : "—"}
            delta={st && s.ngnPerUsd ? `at ${rate(s.ngnPerUsd)} per $` : undefined}
          />
        </motion.div>
        <motion.div {...fade(3)}>
          <ProtectedTile s={s} />
        </motion.div>
        <motion.div {...fade(4)}>
          <StatTile
            label="Naira rate"
            value={s.ngnPerUsd ? rate(s.ngnPerUsd) : "—"}
            delta="Live Textile FX quote, per $1"
            trend={<Sparkline values={(history?.rate ?? []).slice(-16).map((p) => p.ngnPerUsd)} />}
          />
        </motion.div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <motion.div {...fade(5)}>
          <Card className="h-full">
            <CardHeader
              title="Restock fund"
              description="USD₮ available to pay your supplier"
              action={
                <Segmented
                  id="range"
                  value={days}
                  onChange={setDays}
                  options={[
                    { value: "7", label: "7 days" },
                    { value: "30", label: "30 days" },
                  ]}
                />
              }
            />
            <CardBody>
              {history && history.fund.length > 1 ? (
                <FundChart data={history.fund} />
              ) : (
                <div className="grid h-[240px] place-items-center rounded-[14px] border border-dashed border-line text-center text-sm text-muted">
                  <div>
                    <Sparkles className="mx-auto mb-2 size-5 text-faint" />
                    The chart fills in as installments arrive.
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </motion.div>
        <motion.div {...fade(6)}>
          <WhatIf s={s} />
        </motion.div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.55fr]">
        <motion.div {...fade(7)}>
          <LimitsCard s={s} />
        </motion.div>
        <motion.div {...fade(8)}>
          <Card className="h-full">
            <CardHeader
              title="What the agent did"
              description="Every payment, conversion and reorder, as it happens"
              action={
                <Link to="/app/activity" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  View all <ArrowRight />
                </Link>
              }
            />
            <CardBody className="pt-2">
              {s.events.length ? (
                <ActivityFeed events={s.events.slice(0, 6)} compact />
              ) : (
                <p className="py-8 text-center text-sm text-muted">No activity yet.</p>
              )}
            </CardBody>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

function HeroCard({ s }: { s: AppState }) {
  const st = s.stock;
  const units = st?.unitsToday ?? 0;
  return (
    <Card className="overflow-hidden">
      <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-brand/40 blur-3xl dark:bg-brand/10" aria-hidden />
      <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-muted">Stock your customer book can buy today</span>
            {st && st.nairaBehindFund > 0 && st.unitsProtected > 0 && (
              <Badge tone="forest" size="sm">
                +{plural(st.unitsProtected, "kit")} vs naira
              </Badge>
            )}
          </div>
          <div className="mt-3 flex items-end gap-3">
            <CountUp value={units} className="text-[88px] font-semibold leading-[0.82] tracking-[-0.06em] sm:text-[120px]" />
            <span className="mb-2 text-xl font-medium text-muted sm:mb-3 sm:text-2xl">{units === 1 ? "kit" : "kits"}</span>
          </div>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-2">
            That's <b className="font-semibold text-ink">{units} × {s.unit.name}</b> at {usd(s.unit.usdCost)} each from{" "}
            {s.supplier.name}.{" "}
            {st && (
              <>
                If the rest of your book pays on time, it covers <b className="font-semibold text-ink">{st.projectedUnits}</b> in total.
              </>
            )}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/app/restock" className={buttonVariants({ variant: "primary" })}>
              <PackageCheck /> Reorder stock
            </Link>
            <Link to="/app/customers" className={buttonVariants({ variant: "secondary" })}>
              Customer book <ArrowUpRight />
            </Link>
          </div>
        </div>
        <div className="lg:max-w-[420px]">
          {st && <UnitsRow today={st.unitsToday} projected={st.projectedUnits} max={8} glyphClassName="size-14 sm:size-16" />}
          <div className="mt-3 flex items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[3px] bg-ink" /> Paid for today
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-[3px] border border-dashed border-faint" /> When the book is paid
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ProtectedTile({ s }: { s: AppState }) {
  const st = s.stock;
  if (!st || st.nairaBehindFund <= 0)
    return <StatTile label="Compared with keeping naira" value="—" delta="Shows up after the first conversion" />;
  const p = st.ngnProtected;
  const flat = Math.abs(p) < st.nairaBehindFund * 0.005;
  return (
    <StatTile
      label="Compared with keeping naira"
      value={flat ? "About even" : `${p >= 0 ? "+" : "−"}${ngn(Math.abs(p))}`}
      delta={
        flat
          ? "The rate hasn't moved since you converted"
          : p >= 0
            ? "Saved by converting when paid"
            : "The naira has strengthened since"
      }
      deltaTone={flat ? "neutral" : p >= 0 ? "good" : "bad"}
      help="What the money still in your fund is worth today, minus the naira it came from. Positive means converting protected you."
    />
  );
}

function WhatIf({ s }: { s: AppState }) {
  const [pctFall, setPctFall] = useState(20);
  const st = s.stock;
  const r = s.ngnPerUsd ?? 0;
  const cost = s.unit.usdCost;
  const { rows, naira, weaker } = useMemo(() => {
    const fund = st?.fundUsd ?? 0;
    const naira = st && st.nairaBehindFund > 0 ? st.nairaBehindFund : fund * r;
    const weaker = r * (1 + pctFall / 100);
    const heldUsd = weaker ? naira / weaker : 0;
    return {
      naira,
      weaker,
      rows: [
        { key: "naira" as const, label: "Kept in naira", usd: heldUsd, units: Math.floor(heldUsd / cost) },
        { key: "restock" as const, label: "With Restock", usd: fund, units: Math.floor(fund / cost) },
      ],
    };
  }, [st, r, pctFall, cost]);

  return (
    <Card className="h-full">
      <CardHeader title="What if the naira falls?" description="Your fund, against the same naira held as cash" />
      <CardBody className="space-y-6">
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm text-ink-2">
              Naira weakens by <b className="tnum text-ink">{pctFall}%</b>
            </span>
            <span className="tnum text-xs text-muted">{rate(weaker)} / $</span>
          </div>
          <Slider label="Naira weakens by" min={0} max={60} step={5} value={[pctFall]} onValueChange={([v]) => setPctFall(v!)} />
        </div>
        <CompareBars rows={rows} unitName={s.unit.name} />
        <p className="text-[13px] leading-relaxed text-muted">
          {ngn(naira)} kept as naira would be worth {usd(rows[0]!.usd)}. Converted when it arrived, it stays {usd(rows[1]!.usd)}.
        </p>
      </CardBody>
    </Card>
  );
}

function LimitsCard({ s }: { s: AppState }) {
  const se = s.session;
  const cap = se.caps[0];
  const left = cap ? cap.limit - cap.spent : 0;
  const status = {
    active: { tone: "good" as const, label: "Active" },
    revoked: { tone: "bad" as const, label: "Revoked" },
    expired: { tone: "warn" as const, label: "Expired" },
    missing: { tone: "neutral" as const, label: "Not granted" },
  }[se.status];
  return (
    <Card className="h-full">
      <CardHeader
        title="The agent's spending limits"
        description="Set by you, enforced by your Altana wallet"
        action={
          <Badge tone={status.tone} dot pulse={se.status === "active"}>
            {status.label}
          </Badge>
        }
      />
      <CardBody className="space-y-5">
        {cap ? (
          <div>
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="text-muted">Left to spend this quarter</span>
              <span className="tnum font-semibold">
                {usd(left)} <span className="font-normal text-muted">of {usd(cap.limit)}</span>
              </span>
            </div>
            <Meter value={cap.spent} max={cap.limit} label="Spend cap used" tone={left / cap.limit < 0.15 ? "warn" : "ink"} />
          </div>
        ) : (
          <p className="text-sm text-muted">No session key granted yet.</p>
        )}
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-[12px] bg-surface-2 p-3">
            <dt className="text-xs text-muted">Can only pay</dt>
            <dd className="mt-0.5 truncate font-medium">{s.supplier.name}</dd>
          </div>
          <div className="rounded-[12px] bg-surface-2 p-3">
            <dt className="text-xs text-muted">Stops working</dt>
            <dd className="mt-0.5 font-medium">{se.expiry ? lagosDate(se.expiry).split(",")[0] : "—"}</dd>
          </div>
        </dl>
        <Link to="/app/wallet" className={buttonVariants({ variant: "secondary", className: "w-full" })}>
          <ShieldCheck /> Manage limits
        </Link>
      </CardBody>
    </Card>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-[280px] rounded-[20px]" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[124px] rounded-[20px]" />
        ))}
      </div>
      <Skeleton className="h-[340px] rounded-[20px]" />
    </div>
  );
}
