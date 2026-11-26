import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { WagmiProvider, useAccount, useChainId, useConnect, useConnectors, useDisconnect, useReadContract, useSendTransaction, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { concat, encodeFunctionData, erc20Abi, type Hex } from "viem";
import { celo } from "viem/chains";
import { ArrowRight, Check, ChevronLeft, ExternalLink, Lock, ShieldCheck, Wallet as WalletIcon } from "lucide-react";
import { api, type PayInfo } from "@/lib/api";
import { wagmiConfig } from "@/lib/wagmi";
import { celoscanTx, ngn, shortAddr } from "@/lib/format";
import { useSim } from "@/lib/queries";
import { BuiltOnCelo, Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Meter, Skeleton } from "@/components/ui/misc";

export default function Pay() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <PayPage />
    </WagmiProvider>
  );
}

type Phase = "review" | "connect" | "sending" | "done";

function PayPage() {
  const { wallet } = useParams();
  const { data: info, isLoading, error } = useQuery({ queryKey: ["pay-info", wallet], queryFn: () => api.payInfo(wallet) });
  const [amount, setAmount] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("review");
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (info?.customer && amount == null) setAmount(Math.round(info.customer.installmentNgn));
  }, [info, amount]);
  useEffect(() => {
    document.title = info ? `Pay ${info.installer} · Restock` : "Pay · Restock";
  }, [info]);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-brand/35 blur-[100px] dark:bg-brand/10" aria-hidden />
      <div className="relative mx-auto flex min-h-dvh max-w-[440px] flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
        <header className="flex items-center justify-between">
          <Logo markClassName="size-7" />
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <Lock className="size-3.5" /> Secure payment
          </span>
        </header>

        <main className="mt-8 flex-1">
          {isLoading ? (
            <Skeleton className="h-[460px] rounded-[28px]" />
          ) : error || !info ? (
            <div className="rounded-[28px] border border-line bg-surface p-8 text-center shadow-card">
              <p className="font-semibold">This payment link isn't working</p>
              <p className="mt-1 text-sm text-muted">Ask your installer to send it again.</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {phase === "done" ? (
                <Receipt key="done" info={info} amount={amount ?? 0} txHash={txHash} />
              ) : (
                <motion.div
                  key="pay"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden rounded-[28px] border border-line bg-surface shadow-pop"
                >
                  <Summary info={info} amount={amount} setAmount={setAmount} locked={phase !== "review"} />
                  <div className="border-t border-line bg-surface-2/50 p-5">
                    {info.mode === "sim" ? (
                      <SimPay info={info} amount={amount ?? 0} onDone={(h) => (setTxHash(h), setPhase("done"))} />
                    ) : (
                      <LivePay info={info} amount={amount ?? 0} phase={phase} setPhase={setPhase} onDone={(h) => (setTxHash(h), setPhase("done"))} />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </main>

        <footer className="mt-8 flex flex-col items-center gap-3 text-center">
          <BuiltOnCelo />
          <p className="max-w-xs text-[11.5px] leading-relaxed text-faint">
            Paid in cNGN, a naira stablecoin (1 cNGN = ₦1). Your installer receives it instantly; Restock protects their restock money from
            exchange-rate swings.
          </p>
        </footer>
      </div>
    </div>
  );
}

function Summary({ info, amount, setAmount, locked }: { info: PayInfo; amount: number | null; setAmount: (n: number) => void; locked: boolean }) {
  const c = info.customer;
  const [editing, setEditing] = useState(false);
  return (
    <div className="p-6">
      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-[14px] bg-ink text-[15px] font-semibold text-bg">
          {info.installer.replace(/\(.*\)/, "").trim().slice(0, 1)}
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted">Paying</div>
          <div className="truncate font-semibold">{info.installer}</div>
        </div>
      </div>

      <div className="mt-7 text-center">
        <div className="text-[13px] text-muted">{c ? "Your installment" : "Amount"}</div>
        {editing && !locked ? (
          <div className="mx-auto mt-2 flex max-w-[260px] items-center justify-center gap-1 border-b-2 border-ink pb-1 dark:border-brand">
            <span className="text-3xl font-semibold text-muted">₦</span>
            <input
              autoFocus
              inputMode="numeric"
              className="w-full bg-transparent text-center text-[44px] font-semibold tracking-[-0.04em] outline-none"
              value={amount ? amount.toLocaleString("en-NG") : ""}
              onChange={(e) => setAmount(Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
              onBlur={() => setEditing(false)}
              aria-label="Amount in naira"
            />
          </div>
        ) : (
          <button
            className="mt-1 text-[52px] font-semibold leading-tight tracking-[-0.045em] disabled:cursor-default"
            onClick={() => setEditing(true)}
            disabled={locked}
            aria-label="Change amount"
          >
            {amount != null ? ngn(amount) : "—"}
          </button>
        )}
        {!locked && !editing && (
          <button className="mt-1 text-xs font-medium text-muted underline decoration-line-strong underline-offset-4 hover:text-ink" onClick={() => setEditing(true)}>
            Pay a different amount
          </button>
        )}
      </div>

      {c && (
        <div className="mt-7 rounded-[16px] bg-surface-2 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate font-medium">{c.system}</span>
            <span className="shrink-0 pl-3 text-xs text-muted">{c.months}-month plan</span>
          </div>
          <Meter value={c.paidNgn} max={c.priceNgn} tone="good" className="mt-3" label="Paid so far" />
          <div className="mt-2 flex justify-between text-xs text-muted">
            <span>{ngn(c.paidNgn)} paid</span>
            <span>{ngn(Math.max(0, c.priceNgn - c.paidNgn))} to go</span>
          </div>
        </div>
      )}
    </div>
  );
}

function SimPay({ info, amount, onDone }: { info: PayInfo; amount: number; onDone: (hash: string) => void }) {
  const sim = useSim();
  const from = info.customer?.wallet;
  return (
    <div className="space-y-3">
      <Button
        variant="primary"
        size="xl"
        className="w-full"
        disabled={!from || amount <= 0}
        loading={sim.pay.isPending}
        trailing={<ArrowRight />}
        onClick={() => from && sim.pay.mutate({ from, amountNgn: amount }, { onSuccess: (r) => onDone(r.txHash) })}
      >
        Pay {ngn(amount)}
      </Button>
      <p className="text-center text-xs text-muted">
        {from ? "Demo payment: no wallet needed, nothing real moves." : "Open this from a customer's payment link to try a demo payment."}
      </p>
    </div>
  );
}

function LivePay({
  info,
  amount,
  phase,
  setPhase,
  onDone,
}: {
  info: PayInfo;
  amount: number;
  phase: Phase;
  setPhase: (p: Phase) => void;
  onDone: (hash: string) => void;
}) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { disconnect } = useDisconnect();
  const send = useSendTransaction();
  const receipt = useWaitForTransactionReceipt({ hash: send.data, chainId: celo.id });
  const units = BigInt(Math.round(amount)) * 10n ** BigInt(info.cngnDecimals);
  const { data: balance } = useReadContract({
    address: info.cngn,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: celo.id,
    query: { enabled: !!address },
  });
  const wrongWallet = info.customer && address && address.toLowerCase() !== info.customer.wallet.toLowerCase();
  const short = balance != null && balance < units;

  useEffect(() => {
    if (receipt.isSuccess && send.data) onDone(send.data);
  }, [receipt.isSuccess, send.data, onDone]);

  const data = useMemo(
    () => concat([encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [info.payTo, units] }), info.attributionSuffix]) as Hex,
    [info.payTo, units, info.attributionSuffix],
  );

  if (!isConnected) {
    return phase === "connect" ? (
      <WalletPicker onBack={() => setPhase("review")} />
    ) : (
      <Button variant="primary" size="xl" className="w-full" leading={<WalletIcon />} disabled={amount <= 0} onClick={() => setPhase("connect")}>
        Connect wallet to pay
      </Button>
    );
  }

  const confirming = send.isPending;
  const waiting = !!send.data && !receipt.isSuccess;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-[14px] bg-surface px-3.5 py-2.5 ring-1 ring-line">
        <span className="flex items-center gap-2 text-sm">
          <span className="size-2 rounded-full bg-good" />
          <span className="font-mono text-[13px]">{shortAddr(address)}</span>
        </span>
        <button className="text-xs font-medium text-muted hover:text-ink" onClick={() => disconnect()}>
          Change
        </button>
      </div>
      {wrongWallet && <Notice>This link is for a different wallet. The payment will still reach your installer, but may not be matched to your plan.</Notice>}
      {short && <Notice>Your wallet has {ngn(Number(balance) / 10 ** info.cngnDecimals)} cNGN, less than this payment.</Notice>}
      {send.error && <Notice>{(send.error as any).shortMessage ?? send.error.message}</Notice>}

      {chainId !== celo.id ? (
        <Button variant="ink" size="xl" className="w-full" loading={switching} onClick={() => switchChain({ chainId: celo.id })}>
          Switch to Celo
        </Button>
      ) : (
        <Button
          variant="primary"
          size="xl"
          className="w-full"
          disabled={amount <= 0 || confirming || waiting}
          loading={confirming || waiting}
          onClick={() => {
            setPhase("sending");
            send.sendTransaction({ to: info.cngn, data, chainId: celo.id });
          }}
        >
          {confirming ? "Confirm in your wallet" : waiting ? "Confirming on Celo…" : `Pay ${ngn(amount)}`}
        </Button>
      )}
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
        <ShieldCheck className="size-3.5" /> You'll need a little CELO or USD₮ for the network fee.
      </p>
    </div>
  );
}

function WalletPicker({ onBack }: { onBack: () => void }) {
  const connectors = useConnectors();
  const { connect, isPending, variables, error } = useConnect();
  const list = connectors.filter((c, i, arr) => arr.findIndex((x) => x.name === c.name) === i);
  const hasInjected = typeof window !== "undefined" && "ethereum" in window;
  return (
    <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
      <button onClick={onBack} className="flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
        <ChevronLeft className="size-3.5" /> Back
      </button>
      <div className="text-sm font-semibold">Choose your wallet</div>
      {hasInjected || list.length > 1 ? (
        <ul className="space-y-2">
          {list.map((c) => (
            <li key={c.uid}>
              <button
                onClick={() => connect({ connector: c, chainId: celo.id })}
                className="flex w-full items-center gap-3 rounded-[14px] border border-line bg-surface px-4 py-3 text-left text-sm font-medium transition hover:border-line-strong hover:bg-surface-2"
              >
                {c.icon ? <img src={c.icon} alt="" className="size-7 rounded-[8px]" /> : <span className="grid size-7 place-items-center rounded-[8px] bg-surface-3"><WalletIcon className="size-4" /></span>}
                <span className="flex-1">{c.name === "Injected" ? "Browser wallet" : c.name}</span>
                {isPending && variables?.connector === c ? <span className="text-xs text-muted">Opening…</span> : <ArrowRight className="size-4 text-faint" />}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-[14px] border border-dashed border-line-strong p-4 text-sm text-muted">
          No wallet found in this browser. Open this link inside your wallet app's browser (for example Valora or MetaMask), or copy it there.
        </div>
      )}
      {error && <Notice>{error.message}</Notice>}
    </motion.div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[12px] bg-warn-soft px-3.5 py-2.5 text-[13px] leading-snug text-warn">{children}</div>;
}

function Receipt({ info, amount, txHash }: { info: PayInfo; amount: number; txHash: string | null }) {
  const restock = (amount * info.restockBps) / 10_000;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-[28px] border border-line bg-surface p-7 text-center shadow-pop"
    >
      <SunBurst />
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
        className="relative mx-auto grid size-20 place-items-center rounded-full bg-brand text-onyx shadow-glow"
      >
        <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
          <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.35, duration: 0.45 }} />
        </svg>
      </motion.div>
      <h1 className="relative mt-6 text-2xl font-semibold tracking-[-0.03em]">Payment sent</h1>
      <p className="relative mt-1 text-muted">
        {ngn(amount)} to {info.installer}
      </p>

      <dl className="relative mt-7 space-y-2.5 rounded-[16px] bg-surface-2 p-4 text-left text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Amount</dt>
          <dd className="font-medium">{ngn(amount)} cNGN</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Network</dt>
          <dd className="font-medium">{info.mode === "live" ? "Celo" : "Demo"}</dd>
        </div>
        {txHash && info.mode === "live" && (
          <div className="flex justify-between">
            <dt className="text-muted">Transaction</dt>
            <dd>
              <a href={celoscanTx(txHash)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-mono text-[13px] hover:underline">
                {shortAddr(txHash)} <ExternalLink className="size-3" />
              </a>
            </dd>
          </div>
        )}
      </dl>

      <div className="relative mt-5 flex items-start gap-3 rounded-[16px] border border-line p-4 text-left">
        <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-forest-soft text-forest">
          <Check className="size-4" />
        </span>
        <p className="text-[13px] leading-relaxed text-ink-2">
          {ngn(restock)} of this was turned into dollars for your installer's next shipment of panels and batteries, so the parts you depend on
          stay in stock.
        </p>
      </div>
    </motion.div>
  );
}

/** Rays that radiate once behind the success check. */
function SunBurst() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-[68px] -translate-x-1/2 -translate-y-1/2" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => (
        // Rotate the wrapper, translate the ray along it: every ray leaves the centre.
        <span key={i} className="absolute left-0 top-0 h-0 w-0" style={{ transform: `rotate(${i * 30}deg)` }}>
          <motion.span
            className="absolute -top-[1.5px] left-0 h-[3px] w-6 origin-left rounded-full bg-brand"
            initial={{ x: 34, opacity: 0, scaleX: 0.3 }}
            animate={{ x: [34, 60, 82], opacity: [0, 1, 0], scaleX: [0.3, 1, 0.4] }}
            transition={{ duration: 0.9, delay: 0.25, ease: "easeOut" }}
          />
        </span>
      ))}
    </div>
  );
}

