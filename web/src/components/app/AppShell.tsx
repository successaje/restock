import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useOutlet } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  Gauge,
  KeyRound,
  Moon,
  PackageCheck,
  Settings2,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Logo, LogoMark } from "../brand/Logo";
import { Badge } from "../ui/badge";
import { Tooltip } from "../ui/misc";
import { useAppState, useLiveStatus, useLiveUpdates } from "@/lib/queries";
import { useTheme } from "@/hooks/useTheme";
import { cn, rate } from "@/lib/format";
import { DemoControls } from "./DemoControls";

type NavItem = { to: string; label: string; short?: string; icon: LucideIcon; end?: boolean };
const NAV: NavItem[] = [
  { to: "/app", label: "Overview", icon: Gauge, end: true },
  { to: "/app/customers", label: "Customers", icon: Users },
  { to: "/app/restock", label: "Restock", icon: PackageCheck },
  { to: "/app/wallet", label: "Wallet & limits", short: "Wallet", icon: KeyRound },
  { to: "/app/activity", label: "Activity", icon: Activity },
  { to: "/app/settings", label: "Settings", icon: Settings2 },
];

export default function AppShell() {
  useLiveUpdates();
  const { data } = useAppState();
  const location = useLocation();
  const outlet = useOutlet();
  const current = [...NAV].reverse().find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)));

  useEffect(() => {
    document.title = `${current?.label ?? "Restock"} · Restock`;
    window.scrollTo({ top: 0 });
  }, [current?.label]);

  return (
    <div className="min-h-dvh bg-bg">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-line bg-bg/80 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link to="/" aria-label="Restock home">
            <Logo />
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-2" aria-label="Main">
          {NAV.map((n) => (
            <SideLink key={n.to} item={n} />
          ))}
        </nav>
        <div className="p-3">
          <InstallerCard name={data?.installer} mode={data?.mode} />
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <Topbar title={current?.label ?? ""} />
        {data?.mode === "sim" && <SimBanner />}
        <main className="mx-auto w-full max-w-[1240px] px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}

function SideLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "group relative flex h-10 items-center gap-3 rounded-[12px] px-3 text-sm font-medium transition-colors",
          isActive ? "text-ink" : "text-muted hover:bg-surface-2/70 hover:text-ink",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="side-active"
              className="absolute inset-0 rounded-[12px] bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.06)] ring-1 ring-line"
              transition={{ type: "spring", stiffness: 520, damping: 40 }}
            />
          )}
          {isActive && (
            <motion.span
              layoutId="side-bar"
              className="absolute left-0 top-2.5 h-5 w-[3px] rounded-r-full bg-ink dark:bg-brand"
              transition={{ type: "spring", stiffness: 520, damping: 40 }}
            />
          )}
          <Icon className="relative size-[18px]" strokeWidth={isActive ? 2.1 : 1.8} />
          <span className="relative">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

function InstallerCard({ name, mode }: { name?: string; mode?: "sim" | "live" }) {
  const initials = (name ?? "")
    .replace(/\(.*\)/, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-line bg-surface p-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-ink text-[13px] font-semibold text-bg">
        {initials || "·"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold">{name ?? "—"}</div>
        <div className="text-xs text-muted">{mode === "live" ? "Celo mainnet" : "Demo workspace"}</div>
      </div>
    </div>
  );
}

function Topbar({ title }: { title: string }) {
  const { data } = useAppState();
  const { theme, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-20 border-b bg-bg/80 backdrop-blur-xl transition-colors",
        scrolled ? "border-line" : "border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center gap-3 px-4 sm:px-6 lg:px-10">
        <Link to="/" className="lg:hidden" aria-label="Restock home">
          <LogoMark className="size-7" />
        </Link>
        <h1 className="text-[15px] font-semibold tracking-[-0.01em] lg:text-base">{title}</h1>
        <div className="flex-1" />
        {data?.ngnPerUsd != null && <RateChip value={data.ngnPerUsd} shock={data.sim?.shockPct ?? 0} />}
        <LiveDot />
        {data?.mode === "sim" && <DemoControls />}
        <Tooltip content={theme === "dark" ? "Light mode" : "Dark mode"}>
          <button
            onClick={toggle}
            className="grid size-9 place-items-center rounded-[10px] text-muted transition hover:bg-surface-2 hover:text-ink"
            aria-label="Toggle theme"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={theme}
                initial={{ rotate: -60, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 60, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </Tooltip>
        <NavLink
          to="/app/settings"
          className="grid size-9 place-items-center rounded-[10px] text-muted transition hover:bg-surface-2 hover:text-ink lg:hidden"
          aria-label="Settings"
        >
          <Settings2 className="size-[18px]" />
        </NavLink>
      </div>
    </header>
  );
}

function RateChip({ value, shock }: { value: number; shock: number }) {
  return (
    <Tooltip
      content={
        <>
          Live cNGN → USD₮ price from a Textile FX quote, refreshed every minute.
          {shock !== 0 && (
            <>
              <br />
              Demo shock applied: naira {shock > 0 ? "−" : "+"}
              {Math.abs(shock)}%.
            </>
          )}
        </>
      }
    >
      <div className="hidden h-8 items-center gap-2 rounded-full border border-line bg-surface px-3 text-[13px] sm:flex">
        <span className="text-muted">USD</span>
        <motion.span key={value.toFixed(2)} initial={{ opacity: 0.4, y: 3 }} animate={{ opacity: 1, y: 0 }} className="tnum font-semibold">
          {rate(value)}
        </motion.span>
        {shock !== 0 && (
          <Badge tone="warn" size="sm">
            demo {shock > 0 ? "−" : "+"}
            {Math.abs(shock)}%
          </Badge>
        )}
      </div>
    </Tooltip>
  );
}

function LiveDot() {
  const status = useLiveStatus();
  const label = { live: "Live", connecting: "Connecting…", offline: "Reconnecting…" }[status];
  return (
    <Tooltip content={status === "live" ? "Connected: new payments appear instantly" : label}>
      <div className="flex h-8 items-center gap-2 rounded-full px-2 text-xs font-medium text-muted" aria-live="polite">
        <span
          className={cn(
            "size-2 rounded-full",
            status === "live" ? "animate-pulse-dot bg-good text-good" : status === "connecting" ? "bg-faint" : "bg-warn",
          )}
        />
        <span className="hidden md:inline">{label}</span>
      </div>
    </Tooltip>
  );
}

function SimBanner() {
  return (
    <div className="border-b border-line bg-brand-soft/60">
      <div className="mx-auto flex max-w-[1240px] items-center gap-2 px-4 py-2 text-[12.5px] text-ink-2 sm:px-6 lg:px-10">
        <span className="size-1.5 shrink-0 rounded-full bg-ink" />
        <span>
          <b className="font-semibold">Demo workspace.</b> Money moves on a simulated chain, but the naira rate is today's live
          Textile FX quote.
        </span>
      </div>
    </div>
  );
}

function MobileNav() {
  const items = NAV.filter((n) => n.to !== "/app/settings");
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      aria-label="Main"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {items.map((n) => {
          const Icon = n.icon;
          return (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn("relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", isActive ? "text-ink" : "text-muted")
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span layoutId="mob-active" className="absolute top-0 h-0.5 w-8 rounded-full bg-ink dark:bg-brand" />
                  )}
                  <Icon className="size-5" strokeWidth={isActive ? 2.1 : 1.7} />
                  {n.short ?? n.label}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
