import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/format";

const badge = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium leading-none [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        neutral: "bg-surface-2 text-ink-2 ring-1 ring-inset ring-line",
        good: "bg-good-soft text-good",
        bad: "bg-bad-soft text-bad",
        warn: "bg-warn-soft text-warn",
        brand: "bg-brand text-brand-ink",
        forest: "bg-forest-soft text-forest",
        outline: "text-ink-2 ring-1 ring-inset ring-line-strong",
      },
      size: { sm: "h-5 px-2 text-[11px]", md: "h-6 px-2.5 text-xs", lg: "h-7 px-3 text-[13px]" },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export function Badge({
  className,
  tone,
  size,
  dot,
  pulse,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge> & { dot?: boolean; pulse?: boolean }) {
  return (
    <span className={cn(badge({ tone, size }), className)} {...props}>
      {dot && <span className={cn("size-1.5 rounded-full bg-current", pulse && "animate-pulse-dot")} aria-hidden />}
      {children}
    </span>
  );
}
