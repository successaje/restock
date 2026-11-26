import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import * as D from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useInView, useScroll, useSpring, useTransform } from "motion/react";
import {
  ArrowLeftRight,
  ArrowRight,
  Ban,
  Banknote,
  Clock,
  FileCheck2,
  KeyRound,
  Laptop,
  Menu,
  PackageCheck,
  Plus,
  ShieldCheck,
  Smartphone,
  Sun,
  Undo2,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn, rate as fmtRate } from "@/lib/format";
import { BuiltOnCelo, Logo, LogoMark } from "@/components/brand/Logo";
import { Github } from "@/components/brand/GithubIcon";
import { buttonVariants } from "@/components/ui/button";
import { HeroFlow } from "@/components/landing/HeroFlow";
import { DevaluationSim } from "@/components/landing/DevaluationSim";
import { KitGlyph } from "@/components/illustrations/Kit";

const GITHUB = "https://github.com/successaje/restock";
const FALLBACK_RATE = 1440;
const ease = [0.16, 1, 0.3, 1] as const;

function useLiveRate() {
  const { data } = useQuery({ queryKey: ["state"], queryFn: api.state, retry: false, staleTime: 60_000 });
  return { rate: data?.ngnPerUsd ?? null, mode: data?.mode };
}

export default function Landing() {
  const { rate, mode } = useLiveRate();
  const r = rate ?? FALLBACK_RATE;
  useEffect(() => {
    document.title = "Restock — Naira in. Stock secured.";
  }, []);

  return (
    <div className="min-h-dvh overflow-x-clip bg-bg text-ink">
      <Nav />
      <Hero rate={rate} r={r} />
      <TrustStrip />
      <Problem r={r} />
      <HowItWorks />
      <OneNumber />
      <Guardrails />
      <Beyond />
      <Faq />
      <FinalCta mode={mode} />
      <Footer />
    </div>
  );
}

// ------------------------------------------------------------------ nav
const LINKS = [
  { href: "#problem", label: "The problem" },
  { href: "#how", label: "How it works" },
  { href: "#guardrails", label: "Guardrails" },
  { href: "#faq", label: "FAQ" },
];

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all duration-300",
        scrolled ? "border-b border-line bg-bg/80 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-5 sm:px-8">
        <Link to="/" aria-label="Restock home">
          <Logo />
        </Link>
        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Sections">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-3 py-1.5 text-sm text-ink-2 transition hover:bg-surface-2 hover:text-ink">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex-1" />
        <a href={GITHUB} target="_blank" rel="noopener" className="hidden size-9 place-items-center rounded-full text-ink-2 transition hover:bg-surface-2 hover:text-ink sm:grid" aria-label="Source on GitHub">
          <Github className="size-[18px]" />
        </a>
        <Link to="/app" className={buttonVariants({ variant: "ink", size: "sm", className: "hidden h-9 px-4 sm:inline-flex" })}>
          Open dashboard <ArrowRight />
        </Link>
        <D.Root open={open} onOpenChange={setOpen}>
          <D.Trigger className="grid size-9 place-items-center rounded-full hover:bg-surface-2 md:hidden" aria-label="Menu">
            <Menu className="size-5" />
          </D.Trigger>
          <D.Portal>
            <D.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm" />
            <D.Content className="fixed inset-x-3 top-3 z-50 rounded-[24px] border border-line bg-surface p-5 shadow-pop">
              <D.Title className="sr-only">Menu</D.Title>
              <D.Description className="sr-only">Site sections</D.Description>
              <div className="flex items-center justify-between">
                <Logo />
                <D.Close className="grid size-9 place-items-center rounded-full hover:bg-surface-2" aria-label="Close">
                  <X className="size-5" />
                </D.Close>
              </div>
              <nav className="mt-6 grid gap-1">
                {LINKS.map((l) => (
                  <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-[12px] px-3 py-3 text-lg font-medium hover:bg-surface-2">
                    {l.label}
                  </a>
                ))}
              </nav>
              <Link to="/app" className={buttonVariants({ variant: "primary", size: "lg", className: "mt-5 w-full" })}>
                Open dashboard <ArrowRight />
              </Link>
            </D.Content>
          </D.Portal>
        </D.Root>
      </div>
    </header>
  );
}

// ------------------------------------------------------------------ hero
function Hero({ rate, r }: { rate: number | null; r: number }) {
  const words = ["Naira", "in."];
  return (
    <section className="relative pt-28 sm:pt-32">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[720px] opacity-[0.5] dark:opacity-[0.25]"
        style={{
          backgroundImage: "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent 75%)",
        }}
        aria-hidden
      />
      <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-5 pb-16 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:pb-24">
        <div>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="flex flex-wrap items-center gap-2">
            <BuiltOnCelo />
            <span className="text-xs font-medium text-muted">For solar installers in Lagos</span>
          </motion.div>

          <h1 className="mt-7 font-display text-[clamp(3.4rem,9vw,6.6rem)] leading-[0.92] tracking-[-0.02em]">
            <span className="block">
              {words.map((w, i) => (
                <motion.span
                  key={w}
                  className="mr-[0.22em] inline-block"
                  initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.8, ease }}
                >
                  {w}
                </motion.span>
              ))}
            </span>
            <motion.span
              className="relative inline-block italic"
              initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.3, duration: 0.8, ease }}
            >
              <svg className="absolute -bottom-1 left-[-2%] -z-0 h-[0.42em] w-[104%]" viewBox="0 0 300 30" preserveAspectRatio="none" aria-hidden>
                <motion.path
                  d="M3 20 C 70 8, 150 6, 297 14"
                  stroke="#FCFF52"
                  strokeWidth="18"
                  strokeLinecap="round"
                  fill="none"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.9, duration: 0.9, ease: "easeInOut" }}
                />
              </svg>
              <span className="relative">Stock secured.</span>
            </motion.span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.7, ease }}
            className="mt-7 max-w-[34rem] text-lg leading-relaxed text-ink-2 sm:text-xl"
          >
            Your customers pay in naira. Your supplier wants dollars. Restock converts every installment the moment it lands, so the money for your
            next shipment of panels and batteries is already safe.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.62, duration: 0.7, ease }} className="mt-9 flex flex-wrap gap-3">
            <Link to="/app" className={buttonVariants({ variant: "primary", size: "xl" })}>
              Open the dashboard <ArrowRight />
            </Link>
            <a href="#problem" className={buttonVariants({ variant: "secondary", size: "xl" })}>
              See what you're losing
            </a>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="mt-8 flex items-center gap-2.5 text-sm text-muted">
            <span className={cn("size-2 rounded-full", rate ? "animate-pulse-dot bg-good text-good" : "bg-faint")} />
            {rate ? (
              <span>
                Live now: <b className="tnum font-semibold text-ink">{fmtRate(rate)}</b> per dollar on Textile FX
              </span>
            ) : (
              <span>Converted at live Textile FX rates, on Celo</span>
            )}
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 0.25, duration: 1, ease }}>
          <HeroFlow rate={r} />
        </motion.div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ trust strip
function TrustStrip() {
  const items = [
    { k: "Built on", v: "Celo" },
    { k: "FX by", v: "Textile" },
    { k: "Wallets by", v: "Altana" },
    { k: "Agent identity", v: "ERC-8004" },
    { k: "Paid in", v: "cNGN" },
    { k: "Saved in", v: "USD₮" },
  ];
  const row = (
    <div className="flex shrink-0 items-center gap-12 pr-12">
      {items.map((i) => (
        <div key={i.v} className="flex items-baseline gap-2 whitespace-nowrap">
          <span className="text-xs text-muted">{i.k}</span>
          <span className="text-xl font-semibold tracking-[-0.03em]">{i.v}</span>
        </div>
      ))}
    </div>
  );
  return (
    <div className="border-y border-line bg-surface/50">
      <div className="relative mx-auto max-w-[1200px] overflow-hidden py-6 [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
        <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
          {row}
          {row}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ section scaffolding
function Section({ id, eyebrow, title, intro, children, className, dark }: { id?: string; eyebrow?: string; title: ReactNode; intro?: ReactNode; children?: ReactNode; className?: string; dark?: boolean }) {
  return (
    <section id={id} className={cn("scroll-mt-20 py-24 sm:py-32", dark && "bg-onyx text-gypsum", className)}>
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <Reveal>
          {eyebrow && <div className={cn("mb-4 text-sm font-medium", dark ? "text-celo-yellow" : "text-muted")}>{eyebrow}</div>}
          <h2 className="max-w-3xl font-display text-[clamp(2.4rem,5.5vw,4.25rem)] leading-[1] tracking-[-0.015em]">{title}</h2>
          {intro && <p className={cn("mt-6 max-w-2xl text-lg leading-relaxed", dark ? "text-gypsum/70" : "text-ink-2")}>{intro}</p>}
        </Reveal>
        {children && <div className="mt-14">{children}</div>}
      </div>
    </section>
  );
}

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

// ------------------------------------------------------------------ problem
function Problem({ r }: { r: number }) {
  return (
    <Section
      id="problem"
      eyebrow="The problem"
      title={
        <>
          Installments are paid in naira. <em className="text-muted">Stock is bought in dollars.</em>
        </>
      }
      intro={
        <>
          Nigeria imports roughly 90–95% of its solar components, so panel and battery prices follow the dollar. A system sold over twelve months is
          repaid in naira that can buy less every month. Large pay-as-you-go companies hedge this in-house. Small installers just absorb it.
        </>
      }
    >
      <Reveal>
        <DevaluationSim rate={r} />
      </Reveal>
      <Reveal delay={0.1}>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Fact big="90–95%" body="of solar components used in Nigeria are imported, so restock prices move with the dollar." source="BusinessDay" />
          <Fact big="12 months" body="is a typical installment plan, a long time to hold naira while supplier prices move." />
          <Fact big="2 bps" body="Textile FX's fee on each conversion, about ₦40 on every ₦200,000. Gas is paid in USD₮." />
        </div>
      </Reveal>
    </Section>
  );
}

function Fact({ big, body, source }: { big: string; body: string; source?: string }) {
  return (
    <div className="rounded-[20px] border border-line bg-surface p-6">
      <div className="font-display text-5xl tracking-[-0.01em]">{big}</div>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{body}</p>
      {source && <p className="mt-3 text-xs text-faint">Source: {source}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ how it works
const STEPS = [
  { icon: Banknote, title: "Customers pay in cNGN", body: "The same naira amount as always, from their own wallet. A payment link or QR code is all they need." },
  { icon: ArrowLeftRight, title: "The agent converts on arrival", body: "Your rule, say 70%, is sold for dollars on Textile FX within seconds. The rest stays naira for running costs." },
  { icon: Wallet, title: "Dollars wait in your wallet", body: "USD₮ sits in your own Altana smart wallet on Celo. Restock never holds your keys." },
  { icon: PackageCheck, title: "Reorder inside your limits", body: "The agent pays your importer from that wallet, only up to the cap you set and only until the quarter ends." },
];

function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 55%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  return (
    <Section
      id="how"
      eyebrow="How it works"
      title={
        <>
          The conversion <em>is</em> the product.
        </>
      }
      intro="Not a swap button bolted onto a payments app. Every installment is split by your rule and protected the moment it lands, with nothing for you to remember."
      className="border-t border-line bg-surface/40"
    >
      <div ref={ref} className="relative">
        <div className="absolute left-[27px] top-8 bottom-8 w-px bg-line lg:left-0 lg:right-0 lg:top-[27px] lg:bottom-auto lg:h-px lg:w-auto" aria-hidden />
        <motion.div
          className="absolute left-[27px] top-8 w-px origin-top bg-ink lg:hidden"
          style={{ height: "calc(100% - 4rem)", scaleY: progress }}
          aria-hidden
        />
        <motion.div className="absolute left-0 right-0 top-[27px] hidden h-px origin-left bg-ink lg:block" style={{ scaleX: progress }} aria-hidden />
        <ol className="relative grid gap-10 lg:grid-cols-4 lg:gap-8">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08}>
              <li className="flex gap-5 lg:block">
                <span className="relative z-10 grid size-14 shrink-0 place-items-center rounded-[18px] border border-line bg-surface shadow-card">
                  <s.icon className="size-6" />
                  <span className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-brand text-[11px] font-bold text-onyx">{i + 1}</span>
                </span>
                <div className="lg:mt-6">
                  <h3 className="text-lg font-semibold tracking-[-0.02em]">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{s.body}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ the one number
function OneNumber() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [14, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let k = 0;
    const t = setInterval(() => {
      k += 1;
      setN(k);
      if (k >= 6) clearInterval(t);
    }, 160);
    return () => clearInterval(t);
  }, [inView]);

  return (
    <Section
      eyebrow="The one number"
      title={
        <>
          Can I afford my next shipment? <em className="text-muted">Now you know.</em>
        </>
      }
      intro="No exchange-rate maths, no spreadsheets. The dashboard leads with how many units of stock your customer book can buy today, and what the rest of the book will cover when it's paid."
    >
      <div ref={ref} className="[perspective:1600px]">
        <motion.div style={{ rotateX, scale }} className="mx-auto max-w-5xl origin-bottom rounded-[32px] border border-line bg-surface p-2 shadow-pop">
          <div className="rounded-[26px] border border-line bg-bg p-6 sm:p-10">
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="flex items-center gap-2">
                <LogoMark className="size-5" /> Sunrise Solar · Overview
              </span>
              <span className="hidden items-center gap-1.5 sm:flex">
                <span className="size-1.5 rounded-full bg-good" /> Live
              </span>
            </div>
            <div className="mt-8 grid items-end gap-8 md:grid-cols-[1fr_auto]">
              <div>
                <div className="text-sm text-muted">Stock your customer book can buy today</div>
                <div className="mt-2 flex items-end gap-3">
                  <span className="text-[96px] font-semibold leading-[0.85] tracking-[-0.06em] sm:text-[140px]">{n}</span>
                  <span className="mb-3 text-2xl text-muted">kits</span>
                </div>
                <p className="mt-5 max-w-md text-ink-2">
                  That's 6 × 3.5kVA hybrid kit at $650 each. If the rest of your book pays on time, it covers <b className="text-ink">14</b> in total.
                </p>
              </div>
              <div className="flex max-w-[360px] flex-wrap gap-1.5">
                {Array.from({ length: 14 }, (_, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    className={i < 6 ? "text-ink" : "text-faint"}
                  >
                    <KitGlyph variant={i < 6 ? "solid" : "outline"} className="size-11" />
                  </motion.span>
                ))}
              </div>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["Restock fund", "$4,212.80"],
                ["Worth in naira today", "₦6,066,432"],
                ["Compared with keeping naira", "+₦412,560"],
                ["Customers on track", "18 of 21"],
              ].map(([k, v], i) => (
                <div key={k} className="rounded-[16px] border border-line bg-surface p-4">
                  <div className="text-xs text-muted">{k}</div>
                  <div className={cn("mt-1 text-lg font-semibold tracking-[-0.02em]", i === 2 && "text-good")}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
        <p className="mt-4 text-center text-xs text-faint">Illustrative figures.</p>
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ guardrails
function Guardrails() {
  const [revoked, setRevoked] = useState(false);
  const rules = [
    { icon: Zap, t: "A spend cap", b: "The agent can spend at most what you allow this quarter. Network fees count too." },
    { icon: FileCheck2, t: "USD₮ transfers only", b: "Its key can call one thing: a USD₮ transfer. No swaps, no approvals, nothing else." },
    { icon: ShieldCheck, t: "Your supplier only", b: "The agent pays the importer you approved and refuses any other address." },
    { icon: Clock, t: "Ends with the quarter", b: "Every key expires at quarter end, Lagos time. You grant a fresh one when you're ready." },
  ];
  return (
    <Section
      id="guardrails"
      dark
      eyebrow="Guardrails"
      title={
        <>
          An agent on a leash <em className="text-celo-yellow">you</em> hold.
        </>
      }
      intro="Your restock fund lives in your own Altana smart wallet. The agent gets a limited session key, enforced by the wallet itself and recorded publicly on Celo. Anything outside the limits is refused before it reaches the chain."
    >
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
        <ul className="grid gap-4 sm:grid-cols-2">
          {rules.map((r, i) => (
            <Reveal key={r.t} delay={i * 0.06}>
              <li className="h-full rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
                <r.icon className="size-5 text-celo-yellow" />
                <h3 className="mt-4 font-semibold">{r.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gypsum/65">{r.b}</p>
              </li>
            </Reveal>
          ))}
        </ul>

        <Reveal delay={0.1}>
          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#1b1b17] to-[#0b0b0a] p-7 sm:p-9">
            <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-celo-yellow/20 blur-3xl" aria-hidden />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-gypsum/55">
                  <KeyRound className="size-3.5" /> Agent session key
                </div>
                <div className="mt-2 font-display text-4xl italic">Restock agent</div>
              </div>
              <span className={cn("rounded-full px-3 py-1 text-xs font-semibold transition-colors", revoked ? "bg-[#ff5a74]/15 text-[#ff8a9c]" : "bg-celo-yellow text-onyx")}>
                {revoked ? "Revoked" : "Active"}
              </span>
            </div>
            <div className={cn("relative mt-8 space-y-3 text-sm transition-opacity", revoked && "opacity-40")}>
              {[
                ["Spend cap", "$2,000 this quarter"],
                ["Can call", "USD₮ transfer"],
                ["Can pay", "Your importer"],
                ["Expires", "31 Dec, 23:59 WAT"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-white/10 pb-3">
                  <span className="text-gypsum/55">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
            <AnimatePresence>
              {revoked && (
                <motion.div
                  initial={{ scale: 1.6, opacity: 0, rotate: -18 }}
                  animate={{ scale: 1, opacity: 1, rotate: -10 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 14 }}
                  className="pointer-events-none absolute right-8 top-1/2 rounded-[10px] border-[3px] border-[#ff5a74] px-4 py-1.5 font-mono text-2xl font-bold uppercase tracking-[0.2em] text-[#ff5a74]"
                >
                  Revoked
                </motion.div>
              )}
            </AnimatePresence>
            <div className="relative mt-7 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setRevoked((v) => !v)}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-[12px] px-5 text-sm font-semibold transition active:scale-[0.97]",
                  revoked ? "bg-gypsum text-onyx hover:bg-white" : "bg-[#ff5a74] text-onyx hover:bg-[#ff7087]",
                )}
              >
                {revoked ? <Undo2 className="size-4" /> : <Ban className="size-4" />}
                {revoked ? "Grant a new key" : "Revoke the agent"}
              </button>
              <span className="text-xs text-gypsum/55">{revoked ? "Its next payment is refused." : "One transaction. Try it."}</span>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ beyond solar
function Beyond() {
  const goods = [
    { icon: Sun, label: "Solar kits" },
    { icon: Zap, label: "Generators" },
    { icon: Smartphone, label: "Phones" },
    { icon: Laptop, label: "Laptops" },
  ];
  return (
    <Section
      eyebrow="Beyond solar"
      title={
        <>
          Anything imported, <em className="text-muted">sold on installments.</em>
        </>
      }
      intro="Phones, generators and laptops are priced in dollars at the port and paid off in naira at the counter. The same agent protects every one of those businesses."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {goods.map((g, i) => (
          <Reveal key={g.label} delay={i * 0.06}>
            <div className="group flex aspect-[4/3] flex-col justify-between rounded-[24px] border border-line bg-surface p-6 transition hover:-translate-y-1 hover:shadow-pop">
              <g.icon className="size-7 transition-transform duration-500 group-hover:rotate-[-8deg] group-hover:scale-110" />
              <span className="text-lg font-semibold tracking-[-0.02em]">{g.label}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ faq
const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "Who holds the money?",
    a: "You do. Installments arrive at your agent's address and the dollars go straight into your own Altana smart wallet on Celo. Restock never holds your keys, and the agent's key can only do what you allowed.",
  },
  {
    q: "What is cNGN, and is it regulated?",
    a: "cNGN is a naira stablecoin: one cNGN is meant to equal one naira. Its issuer, WrappedCBDC, holds Approval-in-Principle from Nigeria's SEC under its regulatory incubation programme, not a final licence. That status is still early, and you should weigh it.",
  },
  {
    q: "What does it cost?",
    a: "Textile FX charges 2 basis points (0.02%) on each conversion, and network fees are paid in USD₮, usually a fraction of a cent. Small installments are batched so fees stay negligible.",
  },
  {
    q: "What if the naira gets stronger?",
    a: "Then keeping naira would have done slightly better. Restock trades that upside for certainty: the money for your next shipment holds its dollar value. You choose the share it converts, from 0% to 100%.",
  },
  {
    q: "Can the agent run off with my funds?",
    a: "No. Its session key can only send USD₮ transfers, only up to your spend cap, only until the quarter ends, and it only pays your approved supplier. You can revoke it in one transaction.",
  },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section id="faq" eyebrow="Questions" title="Straight answers." className="border-t border-line">
      <div className="mx-auto max-w-3xl divide-y divide-line border-y border-line">
        {FAQ.map((f, i) => (
          <div key={f.q}>
            <button
              className="flex w-full items-center justify-between gap-6 py-6 text-left text-lg font-medium tracking-[-0.01em]"
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
            >
              {f.q}
              <motion.span animate={{ rotate: open === i ? 45 : 0 }} className="grid size-8 shrink-0 place-items-center rounded-full border border-line">
                <Plus className="size-4" />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease }} className="overflow-hidden">
                  <p className="max-w-2xl pb-6 text-[15px] leading-relaxed text-ink-2">{f.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ final CTA + footer
function FinalCta({ mode }: { mode?: "sim" | "live" }) {
  return (
    <section className="px-5 pb-24 sm:px-8">
      <Reveal>
        <div className="grain relative mx-auto max-w-[1200px] overflow-hidden rounded-[36px] bg-celo-yellow px-6 py-16 text-center text-onyx sm:px-16 sm:py-24">
          <LogoMark className="mx-auto size-14 shadow-[0_0_0_6px_rgb(11_11_10/0.06)]" />
          <h2 className="mx-auto mt-8 max-w-3xl font-display text-[clamp(2.6rem,6vw,4.8rem)] leading-[0.98] tracking-[-0.015em]">
            Stop losing stock to the <em>exchange rate.</em>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-onyx/70">
            {mode === "live" ? "Running on Celo mainnet." : "Try the full flow in the demo workspace: live naira rates, simulated money."}
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link to="/app" className="inline-flex h-14 items-center gap-2 rounded-[16px] bg-onyx px-7 text-base font-semibold text-gypsum transition hover:bg-[#222] active:scale-[0.97]">
              Open the dashboard <ArrowRight className="size-5" />
            </Link>
            <a href={GITHUB} target="_blank" rel="noopener" className="inline-flex h-14 items-center gap-2 rounded-[16px] border border-onyx/15 px-7 text-base font-semibold transition hover:bg-onyx/5">
              <Github className="size-5" /> Read the code
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">Protecting installers' naira installments from devaluation, one conversion at a time.</p>
          <BuiltOnCelo className="mt-5" />
        </div>
        <FooterCol title="Product" links={[["Dashboard", "/app"], ["Customer payments", "/app/customers"], ["Wallet & limits", "/app/wallet"]]} />
        <FooterCol
          title="Built with"
          links={[
            ["Celo", "https://celo.org"],
            ["Textile FX", "https://app.textilecredit.com"],
            ["Altana", "https://altana.network"],
            ["cNGN", "https://cngn.co"],
          ]}
        />
        <FooterCol title="Project" links={[["Source code", GITHUB], ["Agents Open for Business", "https://www.loops.house/agents-open-for-business"]]} />
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-5 py-6 text-xs text-faint sm:flex-row sm:justify-between sm:px-8">
          <span>© 2026 Restock. Not a bank, and not financial advice.</span>
          <span>Every agent transaction carries an ERC-8021 attribution tag.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="text-sm font-semibold">{title}</div>
      <ul className="mt-4 space-y-2.5 text-sm text-muted">
        {links.map(([label, href]) => (
          <li key={label}>
            {href.startsWith("/") ? (
              <Link to={href} className="transition hover:text-ink">
                {label}
              </Link>
            ) : (
              <a href={href} target="_blank" rel="noopener" className="transition hover:text-ink">
                {label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
