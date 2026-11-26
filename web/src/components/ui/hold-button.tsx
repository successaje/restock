import { useRef, useState, type ReactNode } from "react";
import { motion, useAnimationControls } from "motion/react";
import { cn } from "@/lib/format";

/**
 * Press-and-hold to confirm a consequential action (revoking the agent).
 * Keyboard users hold Space/Enter. Releasing early cancels.
 */
export function HoldButton({
  onConfirm,
  children,
  holdMs = 1200,
  className,
  disabled,
}: {
  onConfirm: () => void;
  children: ReactNode;
  holdMs?: number;
  className?: string;
  disabled?: boolean;
}) {
  const controls = useAnimationControls();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);

  const start = () => {
    if (disabled || timer.current) return;
    setHolding(true);
    controls.start({ scaleX: 1, transition: { duration: holdMs / 1000, ease: "linear" } });
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      controls.set({ scaleX: 0 });
      navigator.vibrate?.(30);
      onConfirm();
    }, holdMs);
  };
  const cancel = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
    controls.start({ scaleX: 0, transition: { duration: 0.25, ease: "easeOut" } });
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onKeyDown={(e) => (e.key === " " || e.key === "Enter") && !e.repeat && (e.preventDefault(), start())}
      onKeyUp={(e) => (e.key === " " || e.key === "Enter") && cancel()}
      className={cn(
        "relative h-12 w-full select-none overflow-hidden rounded-[14px] border border-bad/30 bg-bad-soft px-5 text-[15px] font-semibold text-bad transition active:scale-[0.99] disabled:opacity-40",
        className,
      )}
      aria-label={typeof children === "string" ? `${children} (press and hold)` : undefined}
    >
      <motion.span className="absolute inset-0 origin-left bg-bad/20" initial={{ scaleX: 0 }} animate={controls} aria-hidden />
      <span className="relative">{holding ? "Keep holding…" : children}</span>
    </button>
  );
}
