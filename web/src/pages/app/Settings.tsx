import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Lock, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { useAppState, useSession, useSignOut, useUpdateSettings } from "@/lib/queries";
import type { Settings as S } from "@/lib/api";
import { cn, ngn } from "@/lib/format";
import { useTheme } from "@/hooks/useTheme";
import { PageHeader } from "@/components/app/Stat";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Slider, Switch } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/misc";

const EXAMPLE = 200_000;

export default function Settings() {
  const { data: s } = useAppState();
  const save = useUpdateSettings();
  const [draft, setDraft] = useState<S | null>(null);

  useEffect(() => {
    if (s && !draft) setDraft(s.settings);
  }, [s, draft]);

  const dirty = useMemo(() => !!(s && draft && JSON.stringify(s.settings) !== JSON.stringify(draft)), [s, draft]);
  if (!s || !draft) return <Skeleton className="h-[640px] rounded-[20px]" />;
  const live = s.mode === "live";
  const set = <K extends keyof S>(k: K, v: S[K]) => setDraft({ ...draft, [k]: v });

  const onSave = async () => {
    const patch: Partial<S> = {};
    (Object.keys(draft) as (keyof S)[]).forEach((k) => {
      if (draft[k] !== s.settings[k] && !(live && k === "supplierAddress")) (patch as any)[k] = draft[k];
    });
    try {
      const next = await save.mutateAsync(patch);
      setDraft(next);
      toast.success("Settings saved");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const restockPct = draft.restockBps / 100;
  return (
    <div className="pb-24">
      <PageHeader title="Settings" description="How the agent treats each installment, what you restock, and who it may pay." />
      <div className="mx-auto max-w-3xl space-y-5">
        <Card>
          <CardHeader title="Your rule" description="The share of every installment the agent turns into dollars, the moment it arrives." />
          <CardBody className="space-y-6">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-5xl font-semibold tracking-[-0.04em]">{restockPct}%</div>
                <div className="mt-1 text-sm text-muted">to the restock fund</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold tracking-[-0.02em] text-muted">{100 - restockPct}%</div>
                <div className="mt-1 text-sm text-muted">kept as naira cash</div>
              </div>
            </div>
            <Slider label="Share to restock" min={0} max={100} step={5} value={[restockPct]} onValueChange={([v]) => set("restockBps", v! * 100)} />
            <div className="overflow-hidden rounded-[14px] border border-line">
              <div className="flex h-10 text-xs font-medium">
                <motion.div layout className="flex items-center bg-forest px-3 text-white" style={{ width: `${restockPct}%` }} transition={{ type: "spring", stiffness: 300, damping: 30 }}>
                  {restockPct >= 18 && "Dollars"}
                </motion.div>
                <motion.div layout className="flex flex-1 items-center justify-end bg-surface-2 px-3 text-muted">
                  {100 - restockPct >= 18 && "Naira cash"}
                </motion.div>
              </div>
              <p className="border-t border-line px-4 py-3 text-[13px] text-muted">
                On a {ngn(EXAMPLE)} installment, <b className="font-semibold text-ink">{ngn((EXAMPLE * restockPct) / 100)}</b> becomes dollars and{" "}
                <b className="font-semibold text-ink">{ngn((EXAMPLE * (100 - restockPct)) / 100)}</b> stays as naira for running costs.
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Your business" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name">{(id) => <Input id={id} value={draft.installerName} onChange={(e) => set("installerName", e.target.value)} />}</Field>
            <div />
            <Field label="What you restock" hint="One unit of stock, as your supplier sells it.">
              {(id) => <Input id={id} value={draft.unitName} onChange={(e) => set("unitName", e.target.value)} />}
            </Field>
            <Field label="Supplier price per unit" hint="In US dollars (USD₮).">
              {(id) => (
                <Input
                  id={id}
                  inputMode="decimal"
                  prefix="$"
                  value={String(draft.unitUsdCost)}
                  onChange={(e) => set("unitUsdCost", Number(e.target.value.replace(/[^\d.]/g, "")) || 0)}
                />
              )}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Supplier" description="The only address the agent will ever pay." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Supplier name">{(id) => <Input id={id} value={draft.supplierName} onChange={(e) => set("supplierName", e.target.value)} />}</Field>
            <Field
              label="Supplier wallet"
              hint={live ? "Locked: set SUPPLIER_ADDRESS on the server. The dashboard can't change who gets paid." : "Celo address that receives USD₮."}
            >
              {(id) => (
                <Input
                  id={id}
                  className="font-mono"
                  value={draft.supplierAddress ?? ""}
                  disabled={live}
                  suffix={live ? <Lock className="size-4" /> : undefined}
                  onChange={(e) => set("supplierAddress", e.target.value as `0x${string}`)}
                />
              )}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Agent" />
          <CardBody className="space-y-5">
            <Field label="Smallest batch to convert" hint="Smaller installments wait and are converted together, to save fees. Textile's minimum is about $1.">
              {(id) => (
                <Input
                  id={id}
                  inputMode="numeric"
                  prefix="₦"
                  className="sm:w-64"
                  value={draft.minConvertCngn.toLocaleString("en-NG")}
                  onChange={(e) => set("minConvertCngn", Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
                />
              )}
            </Field>
            <label className="flex items-start justify-between gap-6 rounded-[14px] bg-surface-2 p-4">
              <span>
                <span className="block text-sm font-medium">Reorder automatically</span>
                <span className="mt-0.5 block text-[13px] text-muted">When the fund covers a whole unit, pay the supplier without asking. Your limits still apply.</span>
              </span>
              <Switch checked={draft.autoRestock} onCheckedChange={(v) => set("autoRestock", v)} />
            </label>
          </CardBody>
        </Card>

        <Appearance />
        <Access />
      </div>

      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="fixed inset-x-0 bottom-20 z-40 px-4 lg:bottom-6 lg:pl-[248px]"
          >
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-[16px] bg-ink py-2.5 pl-5 pr-2.5 text-bg shadow-pop">
              <span className="text-sm font-medium">You have unsaved changes</span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" className="text-bg/70 hover:bg-white/10 hover:text-bg" onClick={() => setDraft(s.settings)}>
                  Discard
                </Button>
                <Button size="sm" variant="primary" loading={save.isPending} onClick={onSave}>
                  Save changes
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Access() {
  const session = useSession();
  const signOut = useSignOut();
  if (!session.data?.required) return null;
  return (
    <Card>
      <CardHeader
        title="Access"
        description="This browser is signed in with your access key. Changing DASHBOARD_TOKEN on the server signs every browser out."
        action={
          <Button size="sm" leading={<LogOut />} loading={signOut.isPending} onClick={() => signOut.mutate()}>
            Sign out
          </Button>
        }
        className="pb-5 sm:pb-6"
      />
    </Card>
  );
}

function Appearance() {
  const { theme, setTheme } = useTheme();
  const [system, setSystem] = useState(() => !localStorage.getItem("restock-theme"));
  const opts = [
    { v: "light", label: "Light", icon: Sun },
    { v: "dark", label: "Dark", icon: Moon },
    { v: "system", label: "System", icon: Monitor },
  ] as const;
  const current = system ? "system" : theme;
  return (
    <Card>
      <CardHeader title="Appearance" />
      <CardBody>
        <div className="grid grid-cols-3 gap-2">
          {opts.map(({ v, label, icon: Icon }) => (
            <button
              key={v}
              onClick={() => {
                if (v === "system") {
                  localStorage.removeItem("restock-theme");
                  setSystem(true);
                  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                  document.documentElement.classList.toggle("dark", dark);
                } else {
                  setSystem(false);
                  setTheme(v);
                }
              }}
              className={cn(
                "flex flex-col items-center gap-2 rounded-[14px] border p-4 text-sm font-medium transition",
                current === v ? "border-ink bg-surface-2 dark:border-brand" : "border-line hover:border-line-strong",
              )}
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
