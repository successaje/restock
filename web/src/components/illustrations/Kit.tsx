import { motion } from "motion/react";
import { cn } from "@/lib/format";

/** A solar kit pictogram: tilted panel over a battery. */
export function KitGlyph({ variant = "solid", className }: { variant?: "solid" | "outline"; className?: string }) {
  const solid = variant === "solid";
  return (
    <svg viewBox="0 0 40 40" className={cn("size-10", className)} aria-hidden>
      <path
        d="M7 8.5h20.5l5.5 12H12.5z"
        fill={solid ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={solid ? 0 : 1.6}
        strokeDasharray={solid ? undefined : "3 2.5"}
        strokeLinejoin="round"
      />
      {solid && (
        <g stroke="var(--surface)" strokeWidth="1.1" opacity="0.9">
          <path d="M14.2 8.5l5.4 12M21.1 8.5l5.4 12M9.6 14.4h21" />
        </g>
      )}
      <rect
        x="12"
        y="25"
        width="16"
        height="9"
        rx="2.2"
        fill={solid ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={solid ? 0 : 1.6}
        strokeDasharray={solid ? undefined : "3 2.5"}
      />
      <rect x="17" y="23" width="6" height="2.2" rx="0.8" fill="currentColor" opacity={solid ? 1 : 0.5} />
      {solid && <path d="M19.4 27.2l-1.6 3h2.6l-1.2 2.6" stroke="var(--brand)" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

/**
 * Units the fund buys today (solid) and the extra the rest of the book will
 * cover if paid (outline), as a row of pictograms.
 */
export function UnitsRow({
  today,
  projected,
  max = 10,
  glyphClassName,
}: {
  today: number;
  projected: number;
  max?: number;
  glyphClassName?: string;
}) {
  const extra = Math.max(0, projected - today);
  const shownToday = Math.min(today, max);
  const shownExtra = Math.min(extra, Math.max(0, max - shownToday));
  const overflow = today + extra - shownToday - shownExtra;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-hidden>
      {Array.from({ length: shownToday }, (_, i) => (
        <motion.span
          key={`t${i}`}
          initial={{ opacity: 0, y: 10, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.25 + i * 0.06, type: "spring", stiffness: 420, damping: 24 }}
          className="text-ink"
        >
          <KitGlyph className={glyphClassName} />
        </motion.span>
      ))}
      {Array.from({ length: shownExtra }, (_, i) => (
        <motion.span
          key={`p${i}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 + (shownToday + i) * 0.06 }}
          className="text-faint"
        >
          <KitGlyph variant="outline" className={glyphClassName} />
        </motion.span>
      ))}
      {overflow > 0 && <span className="ml-1 text-sm font-medium text-muted">+{overflow}</span>}
    </div>
  );
}
