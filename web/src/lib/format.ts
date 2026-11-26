// Formatting in one place, so every number on screen reads the same way.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

const ngnFmt = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });
const usdFmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export const ngn = (n: number) => `₦${ngnFmt.format(Math.round(n))}`;
export const ngnCompact = (n: number) => `₦${compactFmt.format(n)}`;
export const usd = (n: number) => `$${usdFmt.format(n)}`;
export const usdWhole = (n: number) => `$${ngnFmt.format(Math.round(n))}`;
export const usdCompact = (n: number) => `$${compactFmt.format(n)}`;
export const rate = (n: number) => `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const pct = (bps: number) => `${(bps / 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
export const shortAddr = (a?: string | null, n = 4) => (a ? `${a.slice(0, 2 + n)}…${a.slice(-n)}` : "");

export function timeAgo(iso: string | number, now = Date.now()): string {
  const t = typeof iso === "number" ? iso : Date.parse(iso);
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Dates that matter legally (session expiry) are shown in Lagos time. */
export const lagosDate = (unixSeconds: number) =>
  new Date(unixSeconds * 1000).toLocaleString("en-GB", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const celoscanTx = (hash: string) => `https://celoscan.io/tx/${hash}`;
export const celoscanAddress = (a: string) => `https://celoscan.io/address/${a}`;
