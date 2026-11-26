import { useState, type ReactNode } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { cn, shortAddr } from "@/lib/format";

export function Tooltip({ content, children, side = "top" }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <TooltipPrimitive.Root delayDuration={250}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={8}
          className="z-[60] max-w-xs rounded-[10px] bg-ink px-3 py-2 text-xs leading-relaxed text-bg shadow-pop"
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-ink" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      className={cn("relative grid size-7 place-items-center rounded-[8px] text-muted transition hover:bg-surface-2 hover:text-ink", className)}
      aria-label={done ? "Copied" : label}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={done ? "y" : "n"}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ duration: 0.14 }}
        >
          {done ? <Check className="size-3.5 text-good" /> : <Copy className="size-3.5" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/** An address or hash: monospace, shortened, copyable, optionally linked. */
export function Hash({ value, href, chars = 4, className }: { value: string; href?: string; chars?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-mono text-[12.5px] text-ink-2", className)}>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded hover:text-ink hover:underline">
          {shortAddr(value, chars)}
          <ExternalLink className="size-3 opacity-60" />
        </a>
      ) : (
        <span title={value}>{shortAddr(value, chars)}</span>
      )}
      <CopyButton value={value} />
    </span>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted ring-1 ring-line [&_svg]:size-5">{icon}</div>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Segmented control with a sliding indicator. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  id,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  id: string;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("inline-flex rounded-[12px] bg-surface-2 p-1 ring-1 ring-inset ring-line", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative h-8 rounded-[9px] px-3 text-[13px] font-medium transition-colors",
              active ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[9px] bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-line"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {o.label}
              {o.count != null && <span className="tnum text-[11px] text-faint">{o.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A thin meter: the fill carries the state, the track is a lighter step. */
export function Meter({ value, max, tone = "ink", className, label }: { value: number; max: number; tone?: "ink" | "good" | "warn" | "bad"; className?: string; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fill = { ink: "bg-ink dark:bg-brand", good: "bg-forest", warn: "bg-warn", bad: "bg-bad" }[tone];
  return (
    <div
      className={cn("h-2 overflow-hidden rounded-full bg-surface-3", className)}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <motion.div
        className={cn("h-full rounded-full", fill)}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted">{children}</kbd>;
}
