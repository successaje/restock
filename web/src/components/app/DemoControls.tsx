import { useEffect, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "motion/react";
import { FlaskConical, KeyRound, TrendingDown, UserRound } from "lucide-react";
import { useAppState, useSim } from "@/lib/queries";
import { ngn } from "@/lib/format";
import { Button } from "../ui/button";
import { Slider } from "../ui/form";

/**
 * Simulation-only controls for demos: make a customer pay, move the naira,
 * revoke or re-grant the agent's key. Hidden entirely in live mode.
 */
export function DemoControls() {
  const [open, setOpen] = useState(false);
  const { data } = useAppState();
  const sim = useSim();
  const customers = data?.customers ?? [];
  const [who, setWho] = useState<string>("");
  const [shock, setShock] = useState(data?.sim?.shockPct ?? 0);

  useEffect(() => {
    if (!who && customers[0]) setWho(customers[0].wallet);
  }, [customers, who]);
  useEffect(() => setShock(data?.sim?.shockPct ?? 0), [data?.sim?.shockPct]);

  const customer = customers.find((c) => c.wallet === who);
  const active = data?.session.status === "active";

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-[12.5px] font-semibold text-bg transition hover:opacity-90 dark:bg-brand dark:text-onyx">
          <FlaskConical className="size-3.5" />
          <span className="hidden sm:inline">Demo controls</span>
          <span className="sm:hidden">Demo</span>
        </button>
      </Popover.Trigger>
      <AnimatePresence>
        {open && (
          <Popover.Portal forceMount>
            <Popover.Content asChild align="end" sideOffset={10} collisionPadding={12} forceMount>
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 500, damping: 36 }}
                className="z-50 w-[340px] origin-top-right overflow-hidden rounded-[20px] border border-line bg-surface shadow-pop"
              >
                <div className="border-b border-line px-5 py-4">
                  <div className="text-sm font-semibold">Demo controls</div>
                  <p className="mt-0.5 text-xs text-muted">Simulated chain. Every action runs the real agent logic.</p>
                </div>

                <Section icon={<UserRound />} title="A customer pays">
                  <select
                    value={who}
                    onChange={(e) => setWho(e.target.value)}
                    className="h-10 w-full rounded-[10px] border border-line bg-surface-2 px-3 text-sm outline-none focus:border-ink dark:focus:border-brand"
                    aria-label="Customer"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.wallet}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="primary"
                    className="w-full"
                    disabled={!customer}
                    loading={sim.pay.isPending}
                    onClick={() => customer && sim.pay.mutate({ from: customer.wallet, amountNgn: customer.installmentNgn })}
                  >
                    Pay {customer ? ngn(customer.installmentNgn) : "installment"} in cNGN
                  </Button>
                </Section>

                <Section icon={<TrendingDown />} title="Move the naira">
                  <div className="flex items-baseline justify-between text-xs text-muted">
                    <span>Against the dollar</span>
                    <span className="tnum text-sm font-semibold text-ink">
                      {shock === 0 ? "Live rate" : `${shock > 0 ? "−" : "+"}${Math.abs(shock)}%`}
                    </span>
                  </div>
                  <Slider label="Naira move" min={-20} max={60} step={5} value={[shock]} onValueChange={([v]) => setShock(v!)} />
                  <div className="flex gap-1.5">
                    {[0, 10, 25, 50].map((p) => (
                      <button
                        key={p}
                        onClick={() => setShock(p)}
                        className="h-7 flex-1 rounded-[8px] border border-line text-xs font-medium text-ink-2 transition hover:border-line-strong data-[on=true]:border-ink data-[on=true]:bg-ink data-[on=true]:text-bg"
                        data-on={shock === p}
                      >
                        {p === 0 ? "Live" : `−${p}%`}
                      </button>
                    ))}
                  </div>
                  <Button
                    className="w-full"
                    variant="ink"
                    loading={sim.shock.isPending}
                    disabled={shock === (data?.sim?.shockPct ?? 0)}
                    onClick={() => sim.shock.mutate(shock)}
                  >
                    Apply
                  </Button>
                </Section>

                <Section icon={<KeyRound />} title="The agent's key" last>
                  {active ? (
                    <Button variant="danger" className="w-full" loading={sim.revoke.isPending} onClick={() => sim.revoke.mutate()}>
                      Revoke the agent's key
                    </Button>
                  ) : (
                    <Button className="w-full" loading={sim.grant.isPending} onClick={() => sim.grant.mutate(undefined)}>
                      Grant a new key
                    </Button>
                  )}
                </Section>
              </motion.div>
            </Popover.Content>
          </Popover.Portal>
        )}
      </AnimatePresence>
    </Popover.Root>
  );
}

function Section({ icon, title, children, last }: { icon: React.ReactNode; title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={last ? "px-5 py-4" : "border-b border-line px-5 py-4"}>
      <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold [&_svg]:size-4 [&_svg]:text-muted">
        {icon}
        {title}
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}
