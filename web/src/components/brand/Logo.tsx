import { cn } from "@/lib/format";

/**
 * The Restock mark: a sun (solar stock) inside an orbit arrow (the restock
 * cycle), on Prosperity Yellow. Reads as a refresh glyph at 16px.
 */
export function LogoMark({ className, animated }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} role="img" aria-label="Restock">
      <rect width="32" height="32" rx="9" fill="#FCFF52" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="none" stroke="#0B0B0A" strokeOpacity="0.06" />
      <g className={animated ? "animate-spin [animation-duration:1.4s] [transform-box:view-box] [transform-origin:16px_16px]" : undefined}>
        <g
          transform="translate(4.4 4.4) scale(0.967)"
          fill="none"
          stroke="#0B0B0A"
          strokeWidth="2.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
        </g>
      </g>
      <circle cx="16" cy="16" r="3.4" fill="#0B0B0A" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="text-[19px] font-[650] tracking-[-0.04em] text-ink">restock</span>
    </span>
  );
}

/** Affiliation chip. Text only: Celo's marks are not modified or redrawn. */
export function BuiltOnCelo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-celo-yellow px-3 py-1 text-xs font-semibold text-onyx",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-onyx" aria-hidden />
      Built on Celo
    </span>
  );
}
