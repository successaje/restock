import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { ExternalLink, Link2, Plus, Search, Share2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useAddCustomer, useAppState, useSim } from "@/lib/queries";
import type { Customer } from "@/lib/api";
import { cn, ngn, ngnCompact, timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/app/Stat";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { CopyButton, EmptyState, Hash, Meter, Segmented, Skeleton } from "@/components/ui/misc";

type Filter = "all" | "on-track" | "behind";

export default function Customers() {
  const { data: s, isLoading } = useAppState();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [linkFor, setLinkFor] = useState<Customer | null>(null);
  const sim = useSim();

  const customers = s?.customers ?? [];
  const shown = useMemo(
    () =>
      customers.filter(
        (c) =>
          (filter === "all" || (filter === "behind" ? c.behind : !c.behind)) &&
          (!q || `${c.name} ${c.system} ${c.wallet}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [customers, filter, q],
  );
  const behind = customers.filter((c) => c.behind).length;
  const collected = customers.reduce((t, c) => t + c.paidNgn, 0);
  const receivable = s?.stock?.receivableNgn ?? 0;

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Everyone paying you in installments. Each pays in cNGN from their own wallet, and the agent protects your share the moment it lands."
        actions={
          <Button variant="primary" leading={<UserPlus />} onClick={() => setAdding(true)}>
            Add customer
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary label="Customers" value={customers.length.toLocaleString()} />
        <Summary label="On track" value={`${customers.length - behind}`} sub={behind ? `${behind} behind` : "Everyone's up to date"} tone={behind ? "warn" : "good"} />
        <Summary label="Collected" value={ngnCompact(collected)} />
        <Summary label="Still to collect" value={ngnCompact(receivable)} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <Segmented
            id="cust-filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: customers.length },
              { value: "on-track", label: "On track", count: customers.length - behind },
              { value: "behind", label: "Behind", count: behind },
            ]}
          />
          <Input
            className="h-10 sm:w-72"
            prefix={<Search className="size-4" />}
            placeholder="Search name, system or wallet"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search customers"
          />
        </div>

        {isLoading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : !customers.length ? (
          <EmptyState
            icon={<Users />}
            title="No customers yet"
            body="Add the people paying you in installments. Each gets a payment link they open in their wallet."
            action={
              <Button variant="primary" leading={<Plus />} onClick={() => setAdding(true)}>
                Add your first customer
              </Button>
            }
          />
        ) : !shown.length ? (
          <EmptyState icon={<Search />} title="No matches" body="Try another name or clear the filter." />
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-3 py-3 font-medium">System</th>
                  <th className="px-3 py-3 text-right font-medium">Monthly</th>
                  <th className="w-[240px] px-3 py-3 font-medium">Paid</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {shown.map((c) => (
                    <motion.tr
                      key={c.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="group border-t border-line transition-colors hover:bg-surface-2/60"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={c.name} />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{c.name}</div>
                            <Hash value={c.wallet} className="text-muted" />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <div className="max-w-[200px] truncate text-ink-2 xl:max-w-[260px]">{c.system}</div>
                        <div className="text-xs text-muted">
                          {ngn(c.priceNgn)} · {c.months} months
                        </div>
                      </td>
                      <td className="tnum px-3 py-4 text-right font-medium">{ngn(c.installmentNgn)}</td>
                      <td className="px-3 py-4">
                        <Progress c={c} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {s?.mode === "sim" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={sim.pay.isPending && sim.pay.variables?.from === c.wallet}
                              onClick={() => sim.pay.mutate({ from: c.wallet, amountNgn: c.installmentNgn })}
                            >
                              Simulate payment
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" leading={<Link2 />} onClick={() => setLinkFor(c)}>
                            Payment link
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>

            {/* Mobile cards */}
            <ul className="divide-y divide-line md:hidden">
              {shown.map((c) => (
                <li key={c.id} className="space-y-3 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={c.name} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{c.name}</div>
                      <div className="truncate text-xs text-muted">{c.system}</div>
                    </div>
                    <div className="tnum text-right text-sm font-medium">
                      {ngn(c.installmentNgn)}
                      <div className="text-[11px] font-normal text-muted">a month</div>
                    </div>
                  </div>
                  <Progress c={c} />
                  <div className="flex gap-2">
                    {s?.mode === "sim" && (
                      <Button
                        size="sm"
                        className="flex-1"
                        loading={sim.pay.isPending && sim.pay.variables?.from === c.wallet}
                        onClick={() => sim.pay.mutate({ from: c.wallet, amountNgn: c.installmentNgn })}
                      >
                        Simulate payment
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="flex-1" leading={<Link2 />} onClick={() => setLinkFor(c)}>
                      Payment link
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <AddCustomerDialog open={adding} onOpenChange={setAdding} requireWallet={s?.mode === "live"} />
      <PaymentLinkDialog customer={linkFor} onClose={() => setLinkFor(null)} />
    </div>
  );
}

function Summary({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "warn" }) {
  return (
    <div className="rounded-[16px] border border-line bg-surface px-4 py-3.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-[-0.02em]">{value}</div>
      {sub && <div className={cn("mt-0.5 text-xs", tone === "warn" ? "text-warn" : "text-good")}>{sub}</div>}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const clean = name.replace(/^Sample customer · /, "");
  const initials = clean
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  // A stable warm tint per name, from the Celo accent family.
  const tints = ["bg-[#FDFFC2] text-[#4a4a00]", "bg-[#E7EEDB] text-[#33461a]", "bg-[#EEE6FF] text-[#3f2a7a]", "bg-[#FFE6D3] text-[#7a3a10]", "bg-[#DDEFFF] text-[#1f4670]"];
  const h = [...name].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold", tints[h % tints.length])}>
      {initials || "?"}
    </span>
  );
}

function Progress({ c }: { c: Customer }) {
  return (
    <div>
      <Meter value={c.paidNgn} max={c.priceNgn} tone={c.behind ? "warn" : "good"} label={`${c.name} paid`} />
      <div className="mt-1.5 flex items-center justify-between gap-2 whitespace-nowrap text-xs">
        <span className="tnum text-muted">
          {ngnCompact(c.paidNgn)} of {ngnCompact(c.priceNgn)}
        </span>
        {c.paidNgn >= c.priceNgn ? (
          <Badge tone="good" size="sm">
            Paid off
          </Badge>
        ) : c.behind ? (
          <Badge tone="warn" size="sm">
            Behind
          </Badge>
        ) : (
          <span className="text-muted">{c.lastPaidAt ? timeAgo(c.lastPaidAt) : "On track"}</span>
        )}
      </div>
    </div>
  );
}

const TERMS = [3, 6, 9, 12, 18, 24];

function AddCustomerDialog({ open, onOpenChange, requireWallet }: { open: boolean; onOpenChange: (o: boolean) => void; requireWallet: boolean }) {
  const add = useAddCustomer();
  const [f, setF] = useState({ name: "", system: "", price: "", months: 12, wallet: "" });
  const [touched, setTouched] = useState(false);
  const price = Number(f.price.replace(/[^\d.]/g, ""));
  const walletOk = f.wallet ? /^0x[0-9a-fA-F]{40}$/.test(f.wallet.trim()) : !requireWallet;
  const valid = f.name.trim() && f.system.trim() && price > 0 && walletOk;

  const submit = async () => {
    setTouched(true);
    if (!valid) return;
    try {
      const c = await add.mutateAsync({
        name: f.name.trim(),
        system: f.system.trim(),
        priceNgn: price,
        months: f.months,
        wallet: f.wallet.trim() || undefined,
      });
      toast.success(`${c.name} added`, { description: `${ngn(c.priceNgn / c.months)} a month for ${c.months} months` });
      setF({ name: "", system: "", price: "", months: 12, wallet: "" });
      setTouched(false);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add a customer"
      description="Someone you sold a system to on installments."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={add.isPending} onClick={submit}>
            Add customer
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Name" error={touched && !f.name.trim() ? "Add their name" : undefined}>
          {(id) => <Input id={id} autoFocus placeholder="e.g. Mrs Adeyemi, Yaba" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}
        </Field>
        <Field label="What they bought" error={touched && !f.system.trim() ? "Describe the system" : undefined}>
          {(id) => <Input id={id} placeholder="3.5kVA inverter, 4 × 450W panels" value={f.system} onChange={(e) => setF({ ...f, system: e.target.value })} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Total price" error={touched && !(price > 0) ? "Enter the price" : undefined}>
            {(id) => (
              <Input
                id={id}
                inputMode="numeric"
                prefix="₦"
                placeholder="2,400,000"
                value={f.price}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^\d]/g, "");
                  setF({ ...f, price: digits ? Number(digits).toLocaleString("en-NG") : "" });
                }}
              />
            )}
          </Field>
          <Field label="Months">
            {(id) => (
              <div id={id} className="grid grid-cols-6 gap-1 rounded-[12px] bg-surface-2 p-1 ring-1 ring-inset ring-line">
                {TERMS.map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setF({ ...f, months: m })}
                    className={cn(
                      "h-9 rounded-[9px] text-[13px] font-medium transition",
                      f.months === m ? "bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-line" : "text-muted hover:text-ink",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </Field>
        </div>
        <Field
          label={requireWallet ? "Their Celo wallet" : "Their Celo wallet (optional in the demo)"}
          hint="They pay from this address, so the agent knows who paid."
          error={touched && !walletOk ? "Enter a valid 0x address" : undefined}
        >
          {(id) => <Input id={id} className="font-mono" placeholder="0x…" value={f.wallet} onChange={(e) => setF({ ...f, wallet: e.target.value })} />}
        </Field>
        <AnimatePresence>
          {price > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center justify-between rounded-[14px] bg-brand-soft px-4 py-3 text-sm">
                <span className="text-ink-2">They'll pay</span>
                <span className="tnum font-semibold">
                  {ngn(price / f.months)} <span className="font-normal text-muted">a month</span>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  );
}

function PaymentLinkDialog({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const url = customer ? `${window.location.origin}/pay/${customer.wallet}` : "";
  return (
    <Dialog open={!!customer} onOpenChange={(o) => !o && onClose()} title="Payment link" description={customer ? `For ${customer.name}` : undefined} size="sm">
      {customer && (
        <div className="space-y-5">
          <div className="mx-auto w-fit rounded-[20px] border border-line bg-white p-4">
            <QRCodeSVG value={url} size={196} level="M" fgColor="#0B0B0A" bgColor="#FFFFFF" />
          </div>
          <p className="text-center text-sm text-muted">
            They scan this with their phone and pay {ngn(customer.installmentNgn)} from their wallet.
          </p>
          <div className="flex items-center gap-1 rounded-[12px] border border-line bg-surface-2 py-1 pl-3 pr-1">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-2">{url}</span>
            <CopyButton value={url} label="Copy link" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a href={url} target="_blank" rel="noopener" className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-line bg-surface text-sm font-medium transition hover:bg-surface-2">
              <ExternalLink className="size-4" /> Open
            </a>
            <Button
              variant="ink"
              leading={<Share2 />}
              onClick={async () => {
                const text = `Pay your ${customer.system} installment`;
                if (navigator.share) await navigator.share({ title: "Restock payment", text, url }).catch(() => {});
                else {
                  await navigator.clipboard.writeText(url);
                  toast.success("Link copied");
                }
              }}
            >
              Share
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
