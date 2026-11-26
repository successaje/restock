import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Ban, Check, CircleAlert, Minus, PackageCheck, Plus, ShieldCheck, Truck } from "lucide-react";
import { useAppState, useRestock } from "@/lib/queries";
import type { AppState, Order } from "@/lib/api";
import { celoscanTx, cn, dateTime, lagosDate, plural, usd } from "@/lib/format";
import { PageHeader } from "@/components/app/Stat";
import { Card, CardBody, CardHeader, Divider } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, Hash, Skeleton } from "@/components/ui/misc";
import { KitGlyph } from "@/components/illustrations/Kit";

const RELAY_FEE = 0.02; // shown as an estimate; the relay quotes the exact fee

export default function Restock() {
  const { data: s } = useAppState();
  const [units, setUnits] = useState(1);
  const [review, setReview] = useState(false);

  const canBuy = s?.stock?.unitsToday ?? 0;
  useEffect(() => {
    if (canBuy > 0 && units > Math.max(canBuy, 1)) setUnits(canBuy);
  }, [canBuy, units]);

  if (!s) return <Skeleton className="h-[520px] rounded-[20px]" />;

  const total = units * s.unit.usdCost;
  const cap = s.session.caps[0];
  const capLeft = cap ? cap.limit - cap.spent : 0;
  const checks = [
    { ok: s.session.status === "active", label: s.session.status === "active" ? `Agent's key active until ${lagosDate(s.session.expiry).split(",")[0]}` : `Agent's key is ${s.session.status}` },
    { ok: !!s.supplier.address, label: s.supplier.address ? `Pays only ${s.supplier.name}` : "No approved supplier set" },
    { ok: total + RELAY_FEE <= capLeft, label: cap ? `Within your spend cap (${usd(capLeft)} left)` : "No spend cap granted" },
    { ok: total + RELAY_FEE <= s.fund.usdt, label: `Fund covers it (${usd(s.fund.usdt)} available)` },
  ];

  return (
    <div>
      <PageHeader
        title="Reorder stock"
        description="Pay your importer in dollars from the restock fund. Your Altana wallet checks every payment against the limits you set."
      />
      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader
            title="New order"
            description="From your approved supplier"
            action={
              <Badge tone="forest" size="md">
                <ShieldCheck /> Approved
              </Badge>
            }
          />
          <CardBody className="space-y-6">
            <div className="flex items-center gap-4 rounded-[16px] bg-surface-2 p-4">
              <div className="grid size-12 place-items-center rounded-[14px] bg-ink text-bg">
                <Truck className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{s.supplier.name}</div>
                {s.supplier.address ? <Hash value={s.supplier.address} /> : <span className="text-sm text-bad">No supplier address</span>}
              </div>
              <span className="hidden text-xs text-muted sm:block">Paid in USD₮ on Celo</span>
            </div>

            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="text-ink">
                  <KitGlyph className="size-16" />
                </span>
                <div>
                  <div className="font-semibold">{s.unit.name}</div>
                  <div className="text-sm text-muted">{usd(s.unit.usdCost)} per unit</div>
                </div>
              </div>
              <Stepper value={units} onChange={setUnits} max={Math.max(1, Math.min(99, canBuy || 1))} />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setUnits(n)}
                  className={cn(
                    "h-8 rounded-full border px-3 text-[13px] font-medium transition",
                    units === n ? "border-ink bg-ink text-bg" : "border-line text-ink-2 hover:border-line-strong",
                  )}
                >
                  {n}
                </button>
              ))}
              {canBuy > 0 && (
                <button
                  onClick={() => setUnits(canBuy)}
                  className={cn(
                    "h-8 rounded-full border px-3 text-[13px] font-medium transition",
                    units === canBuy ? "border-ink bg-ink text-bg" : "border-line text-ink-2 hover:border-line-strong",
                  )}
                >
                  All the fund buys · {canBuy}
                </button>
              )}
            </div>

            <Divider />

            <dl className="space-y-2.5 text-sm">
              <Line label={`${plural(units, "unit")} × ${usd(s.unit.usdCost)}`} value={usd(total)} />
              <Line label="Network and relay fee (estimate)" value={`~${usd(RELAY_FEE)}`} muted />
              <Line label="Fund after this order" value={usd(Math.max(0, s.fund.usdt - total - RELAY_FEE))} muted />
              <div className="flex items-baseline justify-between pt-2">
                <dt className="font-semibold">Total</dt>
                <dd className="text-2xl font-semibold tracking-[-0.02em]">{usd(total)}</dd>
              </div>
            </dl>

            <ul className="grid gap-2 sm:grid-cols-2">
              {checks.map((c) => (
                <li key={c.label} className={cn("flex items-start gap-2 rounded-[12px] px-3 py-2.5 text-[13px]", c.ok ? "bg-good-soft text-good" : "bg-warn-soft text-warn")}>
                  {c.ok ? <Check className="mt-0.5 size-4 shrink-0" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" />}
                  <span className="text-ink-2">{c.label}</span>
                </li>
              ))}
            </ul>

            <Button variant="primary" size="lg" className="w-full" leading={<PackageCheck />} onClick={() => setReview(true)}>
              Review order
            </Button>
            {checks.some((c) => !c.ok) && (
              <p className="-mt-3 text-center text-xs text-muted">
                You can still try: the wallet will refuse anything outside your limits, and you'll see why.
              </p>
            )}
          </CardBody>
        </Card>

        <OrderHistory orders={s.orders} />
      </div>

      <ReviewDialog open={review} onOpenChange={setReview} s={s} units={units} total={total} />
    </div>
  );
}

function Line({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className={cn("tnum", muted ? "text-muted" : "font-medium")}>{value}</dd>
    </div>
  );
}

function Stepper({ value, onChange, max }: { value: number; onChange: (n: number) => void; max: number }) {
  return (
    <div className="flex items-center rounded-[14px] border border-line bg-surface p-1 shadow-xs">
      <button
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        className="grid size-10 place-items-center rounded-[10px] transition hover:bg-surface-2 disabled:opacity-30"
        aria-label="One fewer"
      >
        <Minus className="size-4" />
      </button>
      <div className="relative w-14 overflow-hidden text-center text-xl font-semibold tnum" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
            className="block"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </div>
      <button
        onClick={() => onChange(value + 1)}
        disabled={value >= max + 20}
        className="grid size-10 place-items-center rounded-[10px] transition hover:bg-surface-2 disabled:opacity-30"
        aria-label="One more"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

const STEPS = ["Asking your Altana wallet", "Relay checking your limits", "Sending USD₮ to the supplier"];

function ReviewDialog({ open, onOpenChange, s, units, total }: { open: boolean; onOpenChange: (o: boolean) => void; s: AppState; units: number; total: number }) {
  const restock = useRestock();
  const [step, setStep] = useState(-1);
  const result = restock.data;

  useEffect(() => {
    if (!open) {
      restock.reset();
      setStep(-1);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = async () => {
    setStep(0);
    const t1 = setTimeout(() => setStep(1), 550);
    const t2 = setTimeout(() => setStep(2), 1100);
    try {
      await Promise.all([restock.mutateAsync(units), new Promise((r) => setTimeout(r, 1500))]);
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setStep(3);
    }
  };

  const phase = step === -1 ? "confirm" : step < 3 ? "working" : result?.status === "paid" ? "paid" : "blocked";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => phase !== "working" && onOpenChange(o)}
      title={phase === "paid" ? "Supplier paid" : phase === "blocked" ? "Payment refused" : "Confirm the order"}
      hideClose={phase === "working"}
      footer={
        phase === "confirm" ? (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={go}>
              Pay {usd(total)}
            </Button>
          </>
        ) : phase === "working" ? undefined : (
          <Button variant="ink" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        )
      }
    >
      <AnimatePresence mode="wait">
        {phase === "confirm" && (
          <motion.div key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="rounded-[16px] bg-surface-2 p-5 text-center">
              <div className="text-sm text-muted">You're paying</div>
              <div className="mt-1 text-4xl font-semibold tracking-[-0.03em]">{usd(total)}</div>
              <div className="mt-1 text-sm text-ink-2">
                to {s.supplier.name} for {units} × {s.unit.name}
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted">
              The agent sends this from your Altana wallet using the session key you granted. If it's outside your limits, the wallet refuses
              it before anything reaches the chain.
            </p>
          </motion.div>
        )}
        {phase === "working" && (
          <motion.ol key="w" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3 py-2">
            {STEPS.map((label, i) => (
              <li key={label} className="flex items-center gap-3 text-sm">
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-full transition-colors",
                    i < step ? "bg-good text-white" : i === step ? "bg-brand text-onyx" : "bg-surface-3 text-faint",
                  )}
                >
                  {i < step ? <Check className="size-4" /> : i === step ? <span className="size-2 animate-pulse rounded-full bg-onyx" /> : i + 1}
                </span>
                <span className={i <= step ? "text-ink" : "text-muted"}>{label}</span>
              </li>
            ))}
          </motion.ol>
        )}
        {(phase === "paid" || phase === "blocked") && result && <Outcome key="o" order={result} unitName={s.unit.name} supplier={s.supplier.name} />}
      </AnimatePresence>
    </Dialog>
  );
}

function Outcome({ order, unitName, supplier }: { order: Order; unitName: string; supplier: string }) {
  const paid = order.status === "paid";
  const [code, ...rest] = (order.reason ?? "").split(": ");
  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5 text-center">
      <motion.div
        initial={{ scale: 0.4, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 16 }}
        className={cn("mx-auto grid size-16 place-items-center rounded-full", paid ? "bg-good text-white" : "bg-bad-soft text-bad")}
      >
        {paid ? <CheckDraw /> : <Ban className="size-7" />}
      </motion.div>
      <div>
        <div className="text-lg font-semibold">
          {paid ? `${order.units} × ${unitName} paid for` : REASON[code ?? ""]?.title ?? "The wallet refused this payment"}
        </div>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
          {paid ? `${supplier} has the USD₮. Your fund and limits are updated.` : REASON[code ?? ""]?.body ?? rest.join(": ")}
        </p>
      </div>
      {paid && order.txHash && (
        <a href={celoscanTx(order.txHash)} target="_blank" rel="noopener" className="text-sm font-medium underline underline-offset-4">
          View on Celoscan
        </a>
      )}
      {!paid && <div className="rounded-[12px] bg-surface-2 px-3 py-2 font-mono text-[11.5px] text-muted">{order.reason}</div>}
    </motion.div>
  );
}

const REASON: Record<string, { title: string; body: string }> = {
  spend_limit_exceeded: {
    title: "Over your spend cap",
    body: "This would go past the limit you gave the agent for this quarter. The relay refused it before it reached the chain. Grant a higher cap if you meant to.",
  },
  session_revoked: {
    title: "You revoked the agent's key",
    body: "The wallet no longer accepts the agent's payments. Grant a new key to let it reorder again.",
  },
  session_expired: { title: "The agent's key has expired", body: "Keys end with the quarter. Grant a new one for this quarter." },
  recipient_not_allowlisted: { title: "Not your approved supplier", body: "The agent only pays the supplier you approved." },
  insufficient_funds: { title: "Not enough in the fund", body: "Wait for more installments to come in, or order fewer units." },
  call_not_permitted: { title: "Not allowed by your key", body: "The agent's key can only send USD₮ transfers." },
};

function CheckDraw() {
  return (
    <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.15, duration: 0.45, ease: "easeOut" }} />
    </svg>
  );
}

function OrderHistory({ orders }: { orders: AppState["orders"] }) {
  return (
    <Card className="h-fit">
      <CardHeader title="Order history" description="Every reorder the agent attempted" />
      <CardBody className="pt-2">
        {!orders.length ? (
          <EmptyState icon={<PackageCheck />} title="No orders yet" body="Your first reorder will show up here." />
        ) : (
          <ul className="divide-y divide-line">
            {orders.slice(0, 12).map((o) => (
              <li key={o.id} className="flex items-center gap-3 py-3">
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-[10px]", o.status === "paid" ? "bg-good-soft text-good" : "bg-bad-soft text-bad")}>
                  {o.status === "paid" ? <Check className="size-4" /> : <Ban className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{plural(o.units, "unit")}</div>
                  <div className="truncate text-xs text-muted">
                    {dateTime(o.at)}
                    {o.status !== "paid" && ` · ${REASON[(o.reason ?? "").split(":")[0]!]?.title ?? "Refused"}`}
                  </div>
                </div>
                <div className="tnum text-right text-sm font-medium">
                  {usd(o.usd)}
                  <div className="text-[11px] font-normal">
                    {o.status === "paid" ? <span className="text-good">Paid</span> : <span className="text-bad">Blocked</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
