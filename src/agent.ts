// The Restock agent.
//
// Each tick:
//   1. picks up new cNGN installments paid to the agent's address,
//   2. splits each by the installer's rule (e.g. 70% restock / 30% cash),
//   3. converts the restock share to USD₮ on Textile FX (batched until it
//      clears Textile's ~$1 floor and our MIN_CONVERT_CNGN),
//   4. moves the USD₮ into the installer's Altana wallet and the cash share,
//      still in cNGN, to the installer.
// When the installer approves a reorder, it pays the supplier in USD₮ from the
// Altana wallet under the session key, which the chain caps and can revoke.
import { fileURLToPath } from "node:url";
import type { Address } from "viem";
import { loadConfig, type Config } from "./config.js";
import { Ledger, type RestockOrder } from "./ledger.js";
import { readSettings, writeSettings, type Settings } from "./settings.js";
import { LiveRails } from "./rails/live.js";
import { SimRails } from "./rails/sim.js";
import type { Rails, SessionState } from "./rails/types.js";
import { splitPayment, stockView, type StockView } from "./stock.js";
import { NoQuoteError, ngnPerUsd } from "./textile.js";

const RATE_TTL_MS = 60_000;
const SNAPSHOT_EVERY_MS = 5 * 60_000;
const RATE_PROBE_CNGN = 1_000_000n * 1_000_000n; // ₦1m, a typical installment batch

export class RestockAgent {
  private busy: Promise<unknown> = Promise.resolve();
  private rateCache: { at: number; value: number } | null = null;
  private waitingLogged = false;

  constructor(
    readonly cfg: Config,
    readonly ledger: Ledger,
    readonly rails: Rails,
  ) {}

  /** Serialize work so a tick and a reorder never race on the same balances. */
  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.busy.then(fn, fn);
    this.busy = run.catch(() => {});
    return run;
  }

  /** Current business settings (env defaults + dashboard edits). */
  get settings(): Settings {
    return readSettings(this.cfg, this.ledger);
  }

  updateSettings(patch: unknown): Settings {
    const next = writeSettings(this.cfg, this.ledger, patch);
    this.ledger.log("info", "Settings updated");
    return next;
  }

  /** Forget the cached rate (e.g. after a simulated rate shock). */
  invalidateRate() {
    this.rateCache = null;
  }

  get cashAddress(): Address {
    return this.cfg.CASH_ADDRESS ?? this.rails.fundAddress;
  }

  async rate(): Promise<number> {
    if (this.rateCache && Date.now() - this.rateCache.at < RATE_TTL_MS) return this.rateCache.value;
    const value = await this.rails.quoteRate(RATE_PROBE_CNGN);
    this.rateCache = { at: Date.now(), value };
    if (Date.now() - this.ledger.lastSnapshotAt("rate") > SNAPSHOT_EVERY_MS) this.ledger.snapshot({ ngnPerUsd: value });
    return value;
  }

  tick() {
    return this.exclusive(async () => {
      await this.ingest();
      await this.convertPending();
      if (this.settings.autoRestock) await this.autoRestock();
      if (Date.now() - this.ledger.lastSnapshotAt("fund") > SNAPSHOT_EVERY_MS) await this.snapshotFund();
    });
  }

  private async snapshotFund() {
    this.ledger.snapshot({ fundUsdt: await this.rails.fundBalance(), ngnPerUsd: this.rateCache?.value ?? null });
  }

  private async ingest() {
    for (const t of await this.rails.scanIncoming()) {
      const p = this.ledger.recordPayment({
        fromAddress: t.from,
        txHash: t.txHash,
        logIndex: t.logIndex,
        cngnAmount: t.amount,
        restockBps: this.settings.restockBps,
      });
      if (!p) continue;
      const who = p.customerId ? this.ledger.customers().find((c) => c.id === p.customerId)?.name : null;
      this.ledger.log(
        "payment",
        `₦${fmt(this.ngn(t.amount))} received from ${who ?? short(t.from)}${who ? "" : " (unknown sender)"}`,
        this.rails.mode === "live" ? t.txHash : null,
      );
      this.waitingLogged = false;
    }
  }

  private async convertPending() {
    const retryAt = Number(this.ledger.get("convert.retryAt") ?? 0);
    if (Date.now() < retryAt) return;

    const pending = this.ledger.pendingPayments();
    if (!pending.length) return;
    let toRestock = 0n;
    let toCash = 0n;
    for (const p of pending) {
      const s = splitPayment(BigInt(p.cngnAmount), p.restockBps);
      toRestock += s.toRestock;
      toCash += s.toCash;
    }
    const min = BigInt(Math.round(this.settings.minConvertCngn * 10 ** this.rails.decimals.cngn));
    if (toRestock < min) {
      if (!this.waitingLogged)
        this.ledger.log(
          "info",
          `Holding ₦${fmt(this.ngn(toRestock))} for restock until it reaches ₦${fmt(this.settings.minConvertCngn)}, the smallest batch worth converting`,
        );
      this.waitingLogged = true;
      return;
    }

    const ids = pending.map((p) => p.id);
    for (const id of ids) this.ledger.setPaymentStatus(id, "converting");
    try {
      const c = await this.rails.convert(toRestock);
      const rate = ngnPerUsd(c.takerPays, c.usdtOut, this.rails.decimals.cngn, this.rails.decimals.usdt);
      this.ledger.recordConversion({
        paymentIds: ids,
        cngnIn: c.takerPays.toString(),
        usdtOut: c.usdtOut.toString(),
        ngnPerUsd: rate,
        quoteId: c.rfqId,
        txHash: this.rails.mode === "live" ? c.txHash : null,
      });
      this.ledger.log(
        "convert",
        `Converted ₦${fmt(this.ngn(c.takerPays))} → $${this.usd(c.usdtOut).toFixed(2)} USD₮ on Textile FX at ₦${rate.toFixed(2)}/$`,
        this.rails.mode === "live" ? c.txHash : null,
      );
      this.rateCache = { at: Date.now(), value: rate };
      this.ledger.set("convert.retryAt", "0");

      await this.sweep();
      if (toCash > 0n) {
        const h = await this.rails.sendCngn(this.cashAddress, toCash);
        this.ledger.log("info", `Sent ₦${fmt(this.ngn(toCash))} cash share to the installer`, this.liveHash(h));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const backoff = err instanceof NoQuoteError ? (err.retryAfterMs ?? 30_000) : 60_000;
      this.ledger.set("convert.retryAt", String(Date.now() + backoff));
      for (const id of ids) this.ledger.setPaymentStatus(id, "failed", msg);
      this.ledger.log("error", `Conversion failed, will retry: ${msg}`);
    }
  }

  /** Move the agent's USD₮ (minus its gas reserve) into the restock wallet. */
  private async sweep() {
    const { usdt } = await this.rails.agentBalances();
    const reserve = BigInt(Math.round(this.cfg.GAS_RESERVE_USDT * 10 ** this.rails.decimals.usdt));
    const amount = usdt - reserve;
    if (amount <= 0n) return;
    const h = await this.rails.sendUsdtToFund(amount);
    await this.snapshotFund();
    this.ledger.log("info", `Moved $${this.usd(amount).toFixed(2)} USD₮ into the restock wallet`, this.liveHash(h));
  }

  private async autoRestock() {
    const fund = this.usd(await this.rails.fundBalance());
    const units = Math.floor(fund / this.settings.unitUsdCost);
    const supplier = this.settings.supplierAddress;
    if (units >= 1 && supplier) await this.placeOrder(units, supplier);
  }

  /** Pay the supplier for `units` units of stock from the Altana wallet. */
  restock(units: number, supplier?: Address): Promise<RestockOrder> {
    return this.exclusive(() => this.placeOrder(units, supplier ?? this.settings.supplierAddress ?? undefined));
  }

  private async placeOrder(units: number, supplier: Address | undefined): Promise<RestockOrder> {
    if (!Number.isInteger(units) || units < 1) throw new Error("units must be a positive whole number");
    const amount = BigInt(Math.round(units * this.settings.unitUsdCost * 10 ** this.rails.decimals.usdt));
    const to = supplier ?? ("0x0000000000000000000000000000000000000000" as Address);
    const label = `${units} × ${this.settings.unitName} ($${this.usd(amount).toFixed(2)}) to ${this.settings.supplierName}`;

    const block = (code: string, reason: string) => {
      const o = this.ledger.recordOrder({ supplier: to, units, usdtAmount: amount.toString(), txHash: null, status: "blocked", reason: `${code}: ${reason}` });
      this.ledger.log("blocked", `Reorder blocked — ${label}. ${explain(code)} (${reason})`);
      return o;
    };

    // The Altana session key can only call USD₮.transfer; it cannot restrict
    // the recipient. The agent enforces the approved supplier itself.
    const approved = this.settings.supplierAddress;
    if (!approved || to.toLowerCase() !== approved.toLowerCase())
      return block("recipient_not_allowlisted", `${short(to)} is not the approved supplier`);

    const res = await this.rails.paySupplier(to, amount);
    if (!res.ok) return block(res.code, res.message);

    const o = this.ledger.recordOrder({ supplier: to, units, usdtAmount: amount.toString(), txHash: this.liveHash(res.txHash), status: "paid", reason: null });
    await this.snapshotFund();
    this.ledger.log("restock", `Paid ${label} from the Altana wallet`, this.liveHash(res.txHash));
    return o;
  }

  /** Rate and fund balance over time, for the dashboard charts. */
  history(days = 30) {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const snaps = this.ledger.snapshots(since);
    return {
      rate: snaps.filter((x) => x.ngnPerUsd != null).map((x) => ({ at: x.at, ngnPerUsd: x.ngnPerUsd! })),
      fund: snaps.filter((x) => x.fundUsdt != null).map((x) => ({ at: x.at, usd: this.usd(BigInt(x.fundUsdt!)) })),
    };
  }

  async state() {
    const settings = this.settings;
    const [rate, fund, agentBal, session] = await Promise.all([
      this.rate().catch(() => this.rateCache?.value ?? null),
      this.rails.fundBalance(),
      this.rails.agentBalances(),
      this.rails.session(),
    ]);
    const customers = this.ledger.customers();
    const payments = this.ledger.payments(500);
    const conversions = this.ledger.conversions();
    const stock: StockView | null = rate
      ? stockView({
          fundUsdt: fund,
          usdtDecimals: this.rails.decimals.usdt,
          cngnDecimals: this.rails.decimals.cngn,
          ngnPerUsdNow: rate,
          unit: { name: settings.unitName, usdCost: settings.unitUsdCost },
          restockBps: settings.restockBps,
          conversions,
          customers,
          payments,
        })
      : null;

    return {
      mode: this.rails.mode,
      installer: settings.installerName,
      settings,
      rule: { restockBps: settings.restockBps },
      unit: { name: settings.unitName, usdCost: settings.unitUsdCost },
      supplier: { name: settings.supplierName, address: settings.supplierAddress },
      attributionCode: this.cfg.ATTRIBUTION_CODE,
      ngnPerUsd: rate,
      stock,
      agent: { address: this.rails.agentAddress, cngn: this.ngn(agentBal.cngn), usdt: this.usd(agentBal.usdt) },
      fund: { address: this.rails.fundAddress, usdt: this.usd(fund) },
      session: serializeSessionState(session, this.rails.decimals.usdt),
      customers: customers.map((c) => {
        const theirs = payments.filter((p) => p.customerId === c.id);
        const paid = theirs.reduce((s, p) => s + this.ngn(BigInt(p.cngnAmount)), 0);
        const installment = c.priceNgn / c.months;
        const elapsed = Math.min(c.months, Math.max(1, monthsSince(c.startDate) + 1));
        const due = installment * elapsed;
        return {
          ...c,
          installmentNgn: installment,
          paidNgn: paid,
          dueNgn: due,
          behind: paid + 1 < due,
          paymentsCount: theirs.length,
          lastPaidAt: theirs[0]?.receivedAt ?? null,
        };
      }),
      payments: payments.slice(0, 50).map((p) => ({ ...p, amountNgn: this.ngn(BigInt(p.cngnAmount)) })),
      conversions: conversions
        .slice(-50)
        .reverse()
        .map((c) => ({ ...c, ngn: this.ngn(BigInt(c.cngnIn)), usd: this.usd(BigInt(c.usdtOut)) })),
      orders: this.ledger.orders().map((o) => ({ ...o, usd: this.usd(BigInt(o.usdtAmount)) })),
      events: this.ledger.events(60),
    };
  }

  private ngn = (v: bigint) => Number(v) / 10 ** this.rails.decimals.cngn;
  private usd = (v: bigint) => Number(v) / 10 ** this.rails.decimals.usdt;
  private liveHash = (h: `0x${string}`) => (this.rails.mode === "live" ? h : null);
}

function serializeSessionState(s: SessionState, usdtDecimals: number) {
  return {
    ...s,
    caps: s.caps.map((c) => ({
      ...c,
      limit: Number(c.limit) / 10 ** usdtDecimals,
      spent: Number(c.spent) / 10 ** usdtDecimals,
    })),
  };
}

function explain(code: string): string {
  switch (code) {
    case "spend_limit_exceeded":
      return "The session key's spend cap does not cover it; the relay refused before anything reached the chain.";
    case "session_expired":
      return "The session key has expired for this quarter; the installer needs to grant a new one.";
    case "session_revoked":
      return "The installer revoked the agent's session key, so the wallet no longer accepts its payments.";
    case "call_not_permitted":
      return "The session key is not allowed to make that call.";
    case "recipient_not_allowlisted":
      return "Only the approved supplier can be paid.";
    case "insufficient_funds":
      return "The restock wallet does not hold enough USD₮.";
    default:
      return "The wallet refused the payment.";
  }
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-NG");
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
function monthsSince(iso: string) {
  const a = new Date(iso);
  const b = new Date();
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

export function buildAgent(cfg: Config = loadConfig()) {
  const ledger = new Ledger(cfg.DB_PATH);
  const rails: Rails = cfg.MODE === "live" ? new LiveRails(cfg, ledger) : new SimRails(cfg, ledger);
  return new RestockAgent(cfg, ledger, rails);
}

// `npm run agent`: run the loop headless, without the dashboard.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const agent = buildAgent();
  console.log(`Restock agent (${agent.rails.mode}) watching ${agent.rails.agentAddress}`);
  const loop = async () => {
    await agent.tick().catch((e) => console.error(e));
    setTimeout(loop, agent.cfg.POLL_MS);
  };
  loop();
}
