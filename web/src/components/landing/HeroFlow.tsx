import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeftRight, Banknote, KeyRound } from "lucide-react";
import { KitGlyph } from "../illustrations/Kit";
import { ngn, usd } from "@/lib/format";

// Illustrative payments for the hero loop (not real customers).
const PAYMENTS = [
  { who: "Adaeze, Yaba", amount: 120_000 },
  { who: "Kunle's barbershop", amount: 200_000 },
  { who: "Grace Clinic, Lekki", amount: 400_000 },
  { who: "Musa, Ikeja", amount: 150_000 },
  { who: "Bisi's salon", amount: 250_000 },
];
const UNIT = 650;
const W = 560;
const H = 572;

/**
 * The product in one loop: a customer pays in naira, the agent converts the
 * restock share on Textile FX, and the number of kits the book can buy ticks
 * up. Dots travel along the path between the cards.
 */
export function HeroFlow({ rate }: { rate: number }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [fund, setFund] = useState(3_420);

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((n) => n + 1), 3_400);
    return () => clearInterval(t);
  }, [reduce]);

  const p = PAYMENTS[i % PAYMENTS.length]!;
  const converted = (p.amount * 0.7) / rate;
  useEffect(() => {
    if (i > 0) setFund((f) => f + converted);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  const kits = Math.floor(fund / UNIT);

  // Lay the scene out at its design size and scale it to fit, so phones get
  // the same composition instead of squeezed cards.
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e!.contentRect.width / W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outer} className="relative mx-auto w-full min-w-0 max-w-[560px]" style={{ height: H * scale }} aria-hidden>
    <div className="absolute left-0 top-0 origin-top-left select-none" style={{ width: W, height: H, transform: `scale(${scale})` }}>
      {/* soft sun */}
      <div className="absolute left-1/2 top-[44%] size-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(252_255_82/0.7),rgb(252_255_82/0)_68%)] dark:bg-[radial-gradient(circle,rgb(252_255_82/0.18),transparent_68%)]" />

      {/* travel path */}
      <svg viewBox="0 0 560 572" className="absolute inset-0 size-full">
        <path id="flow" d="M150 128 C 150 230, 410 210, 410 312 S 220 400, 230 470" fill="none" stroke="var(--line-strong)" strokeWidth="1.5" strokeDasharray="4 6" />
        {!reduce &&
          [0, 0.35, 0.7].map((d, k) => (
            <circle key={`${i}-${k}`} r="5" fill={k === 0 ? "#FCFF52" : "var(--chart-a)"} stroke="var(--surface)" strokeWidth="2">
              <animateMotion dur="1.6s" begin={`${d}s`} fill="freeze" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.4 0 0.2 1">
                <mpath href="#flow" />
              </animateMotion>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.85;1" dur="1.6s" begin={`${d}s`} fill="freeze" />
            </circle>
          ))}
      </svg>

      {/* 1 · payment arrives */}
      <div className="absolute left-0 top-[6%] w-[58%]">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={i}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="flex items-center gap-3 rounded-[18px] border border-line bg-surface p-3.5 shadow-pop"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-brand text-onyx">
              <Banknote className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{ngn(p.amount)} installment</div>
              <div className="truncate text-xs text-muted">from {p.who} · just now</div>
            </div>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted">cNGN</span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 2 · converted on Textile FX */}
      <div className="absolute right-0 top-[44%] w-[54%]">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ delay: reduce ? 0 : 0.7, type: "spring", stiffness: 300, damping: 26 }}
            className="rounded-[18px] border border-line bg-surface p-3.5 shadow-pop"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-muted">
              <ArrowLeftRight className="size-3.5" /> Converted on Textile FX
            </div>
            <div className="mt-1.5 text-[15px] font-semibold">
              {ngn(p.amount * 0.7)} <span className="text-faint">→</span> <span className="text-forest">{usd(converted)}</span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted">70% to restock · 30% kept as cash</div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 3 · the one number */}
      <motion.div
        layout
        className="absolute bottom-0 left-[4%] w-[70%] rounded-[24px] border border-line bg-surface p-5 shadow-pop"
      >
        <div className="text-xs font-medium text-muted">Stock your book can buy today</div>
        <div className="mt-2 flex items-end gap-2">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={kits}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -24, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
              className="text-6xl font-semibold leading-none tracking-[-0.05em]"
            >
              {kits}
            </motion.span>
          </AnimatePresence>
          <span className="mb-1 text-lg text-muted">kits</span>
        </div>
        <div className="mt-4 flex gap-1 text-ink">
          {Array.from({ length: Math.min(kits, 7) }, (_, k) => (
            <motion.span key={k} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
              <KitGlyph className="size-9" />
            </motion.span>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
          <span>Restock fund</span>
          <span className="tnum font-semibold text-ink">{usd(fund)}</span>
        </div>
      </motion.div>

      {/* agent key chip */}
      <div className="absolute right-[1%] top-[23%] animate-float rounded-[16px] bg-onyx px-3.5 py-2.5 text-gypsum shadow-pop">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-gypsum/60">
          <KeyRound className="size-3" /> Agent key
        </div>
        <div className="mt-1 flex items-center gap-2 text-[13px] font-semibold">
          <span className="size-1.5 animate-pulse-dot rounded-full bg-celo-yellow text-celo-yellow" /> Cap $2,000 · Active
        </div>
      </div>
    </div>
    </div>
  );
}
