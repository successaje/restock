import { useMemo, useState } from "react";
import { Activity as ActivityIcon, ArrowLeftRight, Tag } from "lucide-react";
import { useAppState } from "@/lib/queries";
import type { ActivityEvent } from "@/lib/api";
import { celoscanTx, dateTime, ngn, rate, usd } from "@/lib/format";
import { PageHeader } from "@/components/app/Stat";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Hash, Segmented, Skeleton } from "@/components/ui/misc";
import { ActivityFeed } from "@/components/app/ActivityFeed";

type F = "all" | "payment" | "convert" | "restock" | "blocked" | "session";
const FILTERS: { value: F; label: string; kinds?: ActivityEvent["kind"][] }[] = [
  { value: "all", label: "All" },
  { value: "payment", label: "Payments", kinds: ["payment"] },
  { value: "convert", label: "Conversions", kinds: ["convert"] },
  { value: "restock", label: "Reorders", kinds: ["restock"] },
  { value: "blocked", label: "Refused", kinds: ["blocked", "error"] },
  { value: "session", label: "Wallet", kinds: ["session"] },
];

export default function Activity() {
  const { data: s } = useAppState();
  const [f, setF] = useState<F>("all");
  const events = s?.events ?? [];
  const shown = useMemo(() => {
    const kinds = FILTERS.find((x) => x.value === f)?.kinds;
    return kinds ? events.filter((e) => kinds.includes(e.kind)) : events;
  }, [events, f]);

  if (!s) return <Skeleton className="h-[560px] rounded-[20px]" />;
  const tagged = s.conversions.filter((c) => c.txHash).length;

  return (
    <div>
      <PageHeader title="Activity" description="Everything the agent did for you, newest first. Onchain actions link to Celoscan." />
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="scrollbar-none overflow-x-auto border-b border-line p-4">
            <Segmented
              id="act"
              value={f}
              onChange={setF}
              options={FILTERS.map((x) => ({
                value: x.value,
                label: x.label,
                count: x.kinds ? events.filter((e) => x.kinds!.includes(e.kind)).length : events.length,
              }))}
            />
          </div>
          <CardBody className="pt-2">
            {shown.length ? (
              <ActivityFeed events={shown} />
            ) : (
              <EmptyState icon={<ActivityIcon />} title="Nothing here yet" body="Events show up the moment the agent acts." />
            )}
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Conversions on Textile FX"
              description="cNGN sold for USD₮, quote by quote"
              action={<Badge tone="neutral">{s.conversions.length}</Badge>}
            />
            <CardBody className="pt-2">
              {!s.conversions.length ? (
                <EmptyState icon={<ArrowLeftRight />} title="No conversions yet" />
              ) : (
                <ul className="divide-y divide-line">
                  {s.conversions.slice(0, 10).map((c) => (
                    <li key={c.id} className="flex items-center gap-3 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="tnum font-medium">
                          {ngn(c.ngn)} <span className="text-muted">→</span> {usd(c.usd)}
                        </div>
                        <div className="text-xs text-muted">
                          {dateTime(c.at)} · {rate(c.ngnPerUsd)}/$ · {c.paymentIds.length} installment{c.paymentIds.length === 1 ? "" : "s"}
                        </div>
                      </div>
                      {c.txHash ? <Hash value={c.txHash} href={celoscanTx(c.txHash)} /> : <Badge size="sm">Simulated</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Onchain attribution" description="Every transaction the agent sends carries this ERC-8021 tag" />
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-[12px] bg-surface-2 px-3.5 py-3">
                <span className="flex items-center gap-2 text-muted">
                  <Tag className="size-4" /> Builder code
                </span>
                <span className="font-mono text-[13px] font-medium">{s.attributionCode}</span>
              </div>
              <div className="flex items-center justify-between px-1">
                <span className="text-muted">Tagged conversions</span>
                <span className="tnum font-medium">{s.mode === "live" ? tagged : "— (simulation)"}</span>
              </div>
              <div className="flex items-center justify-between px-1">
                <span className="text-muted">Network</span>
                <span className="font-medium">{s.mode === "live" ? "Celo mainnet" : "Simulated"}</span>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
