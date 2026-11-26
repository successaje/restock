import { motion } from "motion/react";
import { ArrowUpRight, Ban, Clock, FileCheck2, KeyRound, Landmark, ShieldCheck, Terminal, Undo2, Wallet as WalletIcon } from "lucide-react";
import { toast } from "sonner";
import { useAppState, useSim } from "@/lib/queries";
import type { AppState } from "@/lib/api";
import { celoscanAddress, cn, lagosDate, ngn, usd } from "@/lib/format";
import { PageHeader } from "@/components/app/Stat";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton, Hash, Meter, Skeleton } from "@/components/ui/misc";
import { HoldButton } from "@/components/ui/hold-button";

export default function Wallet() {
  const { data: s } = useAppState();
  if (!s) return <Skeleton className="h-[560px] rounded-[20px]" />;
  return (
    <div>
      <PageHeader
        title="Wallet & limits"
        description="Your restock fund sits in your own Altana smart wallet. The agent can spend it only inside the limits you granted, and you can switch it off in one transaction."
      />
      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <div className="space-y-5">
          <SessionPass s={s} />
          <HowItsEnforced />
        </div>
        <div className="space-y-5">
          <FundWallet s={s} />
          <AgentWallet s={s} />
        </div>
      </div>
    </div>
  );
}

function SessionPass({ s }: { s: AppState }) {
  const se = s.session;
  const sim = useSim();
  const cap = se.caps[0];
  const daysLeft = se.expiry ? Math.max(0, Math.ceil((se.expiry * 1000 - Date.now()) / 86_400_000)) : 0;
  const active = se.status === "active";

  return (
    <Card className="overflow-hidden">
      {/* The pass */}
      <div className="relative m-2 overflow-hidden rounded-[18px] bg-onyx p-6 text-gypsum sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-celo-yellow/25 blur-3xl" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(#fcf6f1 1px, transparent 1px)", backgroundSize: "14px 14px" }}
          aria-hidden
        />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-gypsum/60">
              <KeyRound className="size-3.5" /> Agent session key
            </div>
            <div className="mt-2 font-display text-3xl italic leading-none sm:text-4xl">Restock agent</div>
          </div>
          <motion.span
            key={se.status}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              active ? "bg-celo-yellow text-onyx" : "bg-[#ff5a74]/15 text-[#ff8a9c]",
            )}
          >
            <span className={cn("size-1.5 rounded-full bg-current", active && "animate-pulse-dot")} />
            {{ active: "Active", revoked: "Revoked", expired: "Expired", missing: "Not granted" }[se.status]}
          </motion.span>
        </div>

        <div className={cn("relative mt-8 transition-opacity", !active && "opacity-45")}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-gypsum/60">Spend cap this quarter</span>
            <span className="tnum font-semibold">
              {cap ? `${usd(cap.spent)} of ${usd(cap.limit)}` : "—"}
            </span>
          </div>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-celo-yellow"
              initial={{ width: 0 }}
              animate={{ width: cap ? `${Math.min(100, (cap.spent / cap.limit) * 100)}%` : "0%" }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <PassItem icon={<FileCheck2 />} label="Can only call" value="USD₮ transfers" />
            <PassItem icon={<ShieldCheck />} label="Can only pay" value={s.supplier.name} />
            <PassItem icon={<Clock />} label="Stops working" value={se.expiry ? lagosDate(se.expiry).split(",")[0]! : "—"} sub={active ? `${daysLeft} days left` : undefined} />
            <PassItem icon={<Landmark />} label="Wallet" value={<span className="font-mono text-[13px]">{se.wallet.slice(0, 8)}…{se.wallet.slice(-4)}</span>} />
          </dl>
        </div>

        {se.status === "revoked" && (
          <motion.div
            initial={{ scale: 1.4, opacity: 0, rotate: -14 }}
            animate={{ scale: 1, opacity: 1, rotate: -10 }}
            transition={{ type: "spring", stiffness: 260, damping: 14 }}
            className="pointer-events-none absolute right-6 top-1/2 rounded-[10px] border-[3px] border-[#ff5a74] px-4 py-1.5 font-mono text-xl font-bold uppercase tracking-[0.2em] text-[#ff5a74]"
          >
            Revoked
          </motion.div>
        )}
      </div>

      <CardBody className="space-y-4 pt-4">
        {s.mode === "sim" ? (
          active ? (
            <>
              <HoldButton
                onConfirm={() =>
                  sim.revoke.mutate(undefined, { onSuccess: () => toast.success("Agent's key revoked", { description: "Its next payment will be refused." }) })
                }
              >
                Hold to revoke the agent's key
              </HoldButton>
              <p className="text-center text-xs text-muted">One owner transaction. The next payment the agent tries is refused.</p>
            </>
          ) : (
            <Button variant="ink" size="lg" className="w-full" leading={<Undo2 />} loading={sim.grant.isPending} onClick={() => sim.grant.mutate(undefined)}>
              Grant a new key for this quarter
            </Button>
          )
        ) : (
          <div className="rounded-[14px] border border-line bg-surface-2 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Terminal className="size-4" /> Revoke from your own wallet
            </div>
            <p className="mb-3 text-[13px] text-muted">Your owner key never touches this server. Run this where your owner key lives:</p>
            <div className="flex items-center justify-between rounded-[10px] bg-onyx px-3 py-2 font-mono text-[13px] text-gypsum">
              npm run revoke
              <CopyButton value="npm run revoke" className="text-gypsum/60 hover:bg-white/10 hover:text-gypsum" />
            </div>
          </div>
        )}
        {se.explorerUrl && (
          <a href={se.explorerUrl} target="_blank" rel="noopener" className="flex items-center justify-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
            View the grant on Altana Explorer <ArrowUpRight className="size-4" />
          </a>
        )}
      </CardBody>
    </Card>
  );
}

function PassItem({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-gypsum/55 [&_svg]:size-3.5">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 truncate font-medium">{value}</dd>
      {sub && <dd className="text-xs text-gypsum/55">{sub}</dd>}
    </div>
  );
}

function HowItsEnforced() {
  const items = [
    { icon: <Ban />, title: "Refused before it reaches the chain", body: "A payment over the cap, after expiry or to a contract the key can't call is rejected by the wallet's relay. Nothing is spent." },
    { icon: <FileCheck2 />, title: "Recorded publicly", body: "The grant is written to Altana's KeyStore on Celo, so anyone can check what the agent is allowed to do." },
    { icon: <Undo2 />, title: "Off in one transaction", body: "Revoking is permanent and takes effect on the next payment. Grant a fresh key whenever you're ready." },
  ];
  return (
    <Card>
      <CardHeader title="How your limits are enforced" />
      <CardBody>
        <ul className="space-y-4">
          {items.map((it) => (
            <li key={it.title} className="flex gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-ink ring-1 ring-line [&_svg]:size-4">{it.icon}</span>
              <div>
                <div className="text-sm font-semibold">{it.title}</div>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{it.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-5 rounded-[12px] bg-surface-2 px-3.5 py-3 text-xs leading-relaxed text-muted">
          The supplier restriction is checked by the agent before it asks the wallet; the spend cap, the USD₮-only rule and the expiry are
          enforced by the wallet itself.
        </p>
      </CardBody>
    </Card>
  );
}

function FundWallet({ s }: { s: AppState }) {
  return (
    <Card>
      <CardHeader
        eyebrow="Restock fund"
        title="Your Altana wallet"
        action={
          <Badge tone="forest">
            <WalletIcon /> Non-custodial
          </Badge>
        }
      />
      <CardBody className="space-y-4">
        <div>
          <div className="text-4xl font-semibold tracking-[-0.035em]">{usd(s.fund.usdt)}</div>
          <div className="mt-1 text-sm text-muted">USD₮ on Celo{s.ngnPerUsd ? ` · ${ngn(s.fund.usdt * s.ngnPerUsd)} today` : ""}</div>
        </div>
        <div className="flex items-center justify-between rounded-[12px] bg-surface-2 px-3.5 py-2.5">
          <span className="text-xs text-muted">Address</span>
          <Hash value={s.fund.address} href={s.mode === "live" ? celoscanAddress(s.fund.address) : undefined} chars={6} />
        </div>
        <p className="text-[13px] leading-relaxed text-muted">
          This is your own address, upgraded to a smart wallet. Restock never holds your keys; the agent only has the limited key above.
        </p>
      </CardBody>
    </Card>
  );
}

function AgentWallet({ s }: { s: AppState }) {
  return (
    <Card>
      <CardHeader eyebrow="Agent" title="Where customers pay" description="Installments arrive here, get split by your rule, and the restock share is converted on Textile FX." />
      <CardBody className="space-y-3 text-sm">
        <Row label="Agent address">
          <Hash value={s.agent.address} href={s.mode === "live" ? celoscanAddress(s.agent.address) : undefined} chars={6} />
        </Row>
        <Row label="Waiting to convert">
          <span className="tnum font-medium">{ngn(s.agent.cngn)} cNGN</span>
        </Row>
        <Row label="Gas reserve">
          <span className="tnum font-medium">{usd(s.agent.usdt)} USD₮</span>
        </Row>
        <Row label="Your rule">
          <span className="font-medium">{s.rule.restockBps / 100}% to restock</span>
        </Row>
        <div className="pt-2">
          <Meter value={s.rule.restockBps} max={10_000} label="Share of each installment sent to restock" />
          <div className="mt-1.5 flex justify-between text-xs text-muted">
            <span>{s.rule.restockBps / 100}% converted to USD₮</span>
            <span>{100 - s.rule.restockBps / 100}% kept as naira cash</span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
      <span className="text-muted">{label}</span>
      {children}
    </div>
  );
}
