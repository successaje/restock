import type { ReactNode } from "react";
import * as D from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/format";

/**
 * Accessible dialog (Radix) with spring motion. On phones it rises as a bottom
 * sheet; on larger screens it scales in centred.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  hideClose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  hideClose?: boolean;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-overlay backdrop-blur-[3px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </D.Overlay>
            <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
              <D.Content asChild forceMount>
                <motion.div
                  className={cn(
                    "pointer-events-auto relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-surface shadow-pop",
                    "rounded-t-[24px] border-t border-line sm:rounded-[24px] sm:border",
                    size === "sm" && "sm:max-w-sm",
                    size === "md" && "sm:max-w-md",
                    size === "lg" && "sm:max-w-xl",
                  )}
                  initial={{ opacity: 0, y: 32, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 24, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                >
                  <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden />
                  <div className="flex items-start justify-between gap-4 px-6 pt-5 sm:pt-6">
                    <div>
                      <D.Title className="text-lg font-semibold tracking-[-0.015em]">{title}</D.Title>
                      {description ? (
                        <D.Description className="mt-1 text-sm text-muted">{description}</D.Description>
                      ) : (
                        <D.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</D.Description>
                      )}
                    </div>
                    {!hideClose && (
                      <D.Close
                        className="-mr-2 -mt-1 grid size-9 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink"
                        aria-label="Close"
                      >
                        <X className="size-4.5" />
                      </D.Close>
                    )}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">{children}</div>
                  {footer && (
                    <div className="flex flex-col-reverse gap-2 border-t border-line bg-surface-2/60 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
                      {footer}
                    </div>
                  )}
                </motion.div>
              </D.Content>
            </div>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}
