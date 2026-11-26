import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeftRight, Ban, Banknote, CircleAlert, Info, KeyRound, PackageCheck } from "lucide-react";
import type { ActivityEvent } from "@/lib/api";
import { celoscanTx, cn, timeAgo } from "@/lib/format";
import { Hash } from "../ui/misc";

const KIND: Record<ActivityEvent["kind"], { icon: typeof Info; tone: string; label: string }> = {
  payment: { icon: Banknote, tone: "bg-brand text-onyx", label: "Payment" },
  convert: { icon: ArrowLeftRight, tone: "bg-forest-soft text-forest", label: "Conversion" },
  restock: { icon: PackageCheck, tone: "bg-good-soft text-good", label: "Restock" },
  blocked: { icon: Ban, tone: "bg-bad-soft text-bad", label: "Blocked" },
  session: { icon: KeyRound, tone: "bg-surface-3 text-ink", label: "Wallet" },
  info: { icon: Info, tone: "bg-surface-2 text-muted", label: "Agent" },
  error: { icon: CircleAlert, tone: "bg-warn-soft text-warn", label: "Retry" },
};

/** Re-render relative times every 30s. */
function useNow(ms = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function ActivityFeed({ events, compact }: { events: ActivityEvent[]; compact?: boolean }) {
  const now = useNow();
  return (
    <ol className="relative">
      <AnimatePresence initial={false}>
        {events.map((e, i) => {
          const k = KIND[e.kind] ?? KIND.info;
          const Icon = k.icon;
          return (
            <motion.li
              key={e.id}
              layout
              initial={{ opacity: 0, y: -10, backgroundColor: "var(--brand-soft)" }}
              animate={{ opacity: 1, y: 0, backgroundColor: "rgba(0,0,0,0)" }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], backgroundColor: { duration: 2.4 } }}
              className="relative -mx-2 flex gap-3 rounded-[12px] px-2 py-3"
            >
              {/* timeline rail */}
              {i < events.length - 1 && <span className="absolute left-[23px] top-11 bottom-[-4px] w-px bg-line" aria-hidden />}
              <span className={cn("relative z-10 grid size-8 shrink-0 place-items-center rounded-[10px]", k.tone)}>
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-[13.5px] leading-snug text-ink", compact && "line-clamp-2")}>{e.message}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <span>{k.label}</span>
                  <span aria-hidden>·</span>
                  <time dateTime={e.at} title={new Date(e.at).toLocaleString()}>
                    {timeAgo(e.at, now)}
                  </time>
                  {e.txHash && (
                    <>
                      <span aria-hidden>·</span>
                      <Hash value={e.txHash} href={celoscanTx(e.txHash)} />
                    </>
                  )}
                </div>
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}
