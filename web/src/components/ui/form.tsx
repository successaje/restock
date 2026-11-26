import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/format";

export const Input = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> & { prefix?: ReactNode; suffix?: ReactNode; invalid?: boolean }
>(function Input({ className, prefix, suffix, invalid, ...props }, ref) {
  return (
    <div
      className={cn(
        "group flex h-11 items-center gap-2 rounded-[12px] border bg-surface px-3.5 transition",
        "border-line hover:border-line-strong focus-within:border-ink focus-within:ring-4 focus-within:ring-ink/5",
        "dark:focus-within:border-brand dark:focus-within:ring-brand/10",
        invalid &&
          "border-bad hover:border-bad focus-within:border-bad focus-within:ring-bad/10 dark:focus-within:border-bad dark:focus-within:ring-bad/15",
        className,
      )}
    >
      {prefix && <span className="shrink-0 text-sm text-muted">{prefix}</span>}
      <input
        ref={ref}
        className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
        aria-invalid={invalid || undefined}
        {...props}
      />
      {suffix && <span className="shrink-0 text-sm text-muted">{suffix}</span>}
    </div>
  );
});

export function Field({
  label,
  hint,
  error,
  children,
  id,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: (id: string) => ReactNode;
  id?: string;
}) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className="space-y-1.5">
      <label htmlFor={fid} className="block text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children(fid)}
      {error ? (
        <p role="alert" className="text-xs text-bad">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Slider({
  className,
  label,
  ...props
}: SliderPrimitive.SliderProps & { label: string }) {
  return (
    <SliderPrimitive.Root
      className={cn("relative flex h-6 w-full touch-none select-none items-center", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-surface-3">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-ink dark:bg-brand" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={label}
        className={cn(
          "block size-5 rounded-full border-2 border-ink bg-brand shadow-[0_2px_8px_rgb(0_0_0/0.18)]",
          "transition-transform duration-150 hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink/15",
          "dark:border-brand dark:focus-visible:ring-brand/25",
        )}
      />
    </SliderPrimitive.Root>
  );
}

export function Switch({ className, ...props }: SwitchPrimitive.SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-line-strong bg-surface-3 transition-colors",
        "data-[state=checked]:border-ink data-[state=checked]:bg-ink dark:data-[state=checked]:border-brand dark:data-[state=checked]:bg-brand",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block size-[18px] translate-x-[2px] rounded-full bg-surface shadow transition-transform duration-200 ease-[var(--ease-spring)]",
          "data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-brand dark:data-[state=checked]:bg-onyx",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
