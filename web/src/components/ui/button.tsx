import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/format";
import { Spinner } from "./spinner";

export const buttonVariants = cva(
  [
    "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-[var(--ease-out-expo)]",
    "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:size-[1.1em] [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        // Celo pairing: Prosperity Yellow CTA with Onyx type.
        primary:
          "bg-brand text-brand-ink shadow-[inset_0_-1px_0_rgb(0_0_0/0.12),0_1px_2px_rgb(0_0_0/0.08)] hover:bg-[#f2f540] hover:shadow-glow",
        ink: "bg-ink text-bg hover:bg-ink-2 shadow-[0_1px_2px_rgb(0_0_0/0.12)]",
        secondary: "border border-line bg-surface text-ink shadow-xs hover:border-line-strong hover:bg-surface-2",
        ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
        danger: "border border-bad/25 bg-bad-soft text-bad hover:border-bad/50",
        link: "h-auto px-0 text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink active:scale-100",
      },
      size: {
        sm: "h-8 rounded-[10px] px-3 text-[13px]",
        md: "h-10 rounded-[12px] px-4 text-sm",
        lg: "h-12 rounded-[14px] px-6 text-[15px]",
        xl: "h-14 rounded-[16px] px-7 text-base",
        icon: "size-9 rounded-[10px]",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { loading?: boolean; leading?: ReactNode; trailing?: ReactNode };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading, leading, trailing, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : leading}
      {children}
      {!loading && trailing}
    </button>
  );
});
