// In-memory rails for development and demos without funds. Balances and the
// session key live in the ledger's kv table; prices come from live Textile
// previews, so the numbers on screen are today's real naira rate. Session-key
// rules are enforced the way Altana's relay enforces them (cap includes the
// relay fee, expiry, revoke), returning the same error codes.
import { randomBytes } from "node:crypto";
import { type Address, type Hex, toHex } from "viem";
import { CELO, endOfQuarter, type Config } from "../config.js";
import type { Ledger } from "../ledger.js";
import { Textile, ngnPerUsd } from "../textile.js";
import type { Conversion, IncomingTransfer, PayResult, Rails, SessionState } from "./types.js";

const SIM_AGENT = "0xA6e17000000000000000000000000000000000A6" as Address;
const SIM_FUND = "0xF0dd000000000000000000000000000000000F0d" as Address;
const RELAY_FEE_USDT = 20_000n; // ~$0.02 per relayed call, metered against the cap
const FALLBACK_RATE = 1450; // used only if Textile is unreachable

type SimSession = {
  keyId: Hex;
  keyHash: Hex;
  expiry: number;
  capLimit: string;
  spent: string;
  revoked: boolean;
};

const fakeHash = (): Hex => toHex(randomBytes(32));

export class SimRails implements Rails {
  readonly mode = "sim" as const;
  readonly agentAddress = SIM_AGENT;
  readonly fundAddress = SIM_FUND;
  readonly decimals = { cngn: 6, usdt: 6 };
  private readonly textile: Textile;
  private inbox: IncomingTransfer[] = [];
  private lastRate: number | null = null;

  constructor(
    private readonly cfg: Config,
    private readonly ledger: Ledger,
  ) {
    // Preview needs no wallet; the rest of Textile is never called in sim mode.
    this.textile = new Textile({ chainId: CELO.chainId, tag: (d: Hex) => d } as any);
    if (!this.ledger.get("sim.session")) this.grant();
  }

  // ---- sim-only controls (used by the dashboard's demo buttons and tests)

  /** A customer pays an installment. */
  customerPays(from: Address, amount: bigint) {
    const txHash = fakeHash();
    this.inbox.push({ from, amount, txHash, logIndex: 0 });
    this.add(SIM_AGENT, "cngn", amount);
    return txHash;
  }

  /** Owner grants a fresh session key (replaces any previous one). */
  grant(capUsdt = this.cfg.SESSION_CAP_USDT, expiry?: number) {
    const s: SimSession = {
      keyId: fakeHash(),
      keyHash: fakeHash(),
      expiry: expiry ?? Math.floor((this.cfg.SESSION_EXPIRES_AT ? new Date(this.cfg.SESSION_EXPIRES_AT) : endOfQuarter()).getTime() / 1000),
      capLimit: BigInt(Math.round(capUsdt * 1e6)).toString(),
      spent: "0",
      revoked: false,
    };
    this.ledger.set("sim.session", JSON.stringify(s));
    return { txHash: fakeHash(), session: s };
  }

  /** Owner revokes the session key in one transaction. */
  revoke() {
    const s = this.sim();
    s.revoked = true;
    this.ledger.set("sim.session", JSON.stringify(s));
    return fakeHash();
  }

  // ---- balances
  private bal(addr: Address, token: "cngn" | "usdt"): bigint {
    return BigInt(this.ledger.get(`sim.bal.${addr}.${token}`) ?? "0");
  }
  private add(addr: Address, token: "cngn" | "usdt", delta: bigint) {
    const next = this.bal(addr, token) + delta;
    if (next < 0n) throw new Error(`sim: ${addr} has insufficient ${token}`);
    this.ledger.set(`sim.bal.${addr}.${token}`, next.toString());
  }
  private sim(): SimSession {
    return JSON.parse(this.ledger.get("sim.session")!);
  }

  // ---- Rails
  async scanIncoming() {
    const out = this.inbox;
    this.inbox = [];
    return out;
  }

  async quoteRate(sizeCngn: bigint) {
    try {
      const p = await this.textile.preview(CELO.CNGN, CELO.USDT, sizeCngn);
      this.lastRate = ngnPerUsd(p.takerPays, p.buyAmount);
    } catch {
      this.lastRate ??= FALLBACK_RATE;
    }
    return this.lastRate;
  }

  async convert(cngn: bigint): Promise<Conversion> {
    const rate = await this.quoteRate(cngn);
    const usdtOut = BigInt(Math.floor((Number(cngn) / rate) * 1)); // both 6 decimals
    this.add(SIM_AGENT, "cngn", -cngn);
    this.add(SIM_AGENT, "usdt", usdtOut);
    return { rfqId: `sim_${Date.now()}`, txHash: fakeHash(), takerPays: cngn, usdtOut };
  }

  async sendUsdtToFund(amount: bigint) {
    this.add(SIM_AGENT, "usdt", -amount);
    this.add(SIM_FUND, "usdt", amount);
    return fakeHash();
  }

  async sendCngn(to: Address, amount: bigint) {
    this.add(SIM_AGENT, "cngn", -amount);
    this.add(to, "cngn", amount);
    return fakeHash();
  }

  async agentBalances() {
    return { cngn: this.bal(SIM_AGENT, "cngn"), usdt: this.bal(SIM_AGENT, "usdt") };
  }

  async fundBalance() {
    return this.bal(SIM_FUND, "usdt");
  }

  async paySupplier(to: Address, amount: bigint): Promise<PayResult> {
    const s = this.sim();
    if (s.revoked) return { ok: false, code: "session_revoked", message: `key hash ${s.keyHash} is unknown` };
    if (Date.now() / 1000 >= s.expiry)
      return { ok: false, code: "session_expired", message: `This session expired at ${new Date(s.expiry * 1000).toISOString()}` };
    const spent = BigInt(s.spent);
    if (spent + amount + RELAY_FEE_USDT > BigInt(s.capLimit))
      return {
        ok: false,
        code: "spend_limit_exceeded",
        message: "This session key's spending limit does not cover this. Grant a new session key with a higher limit.",
      };
    if (this.bal(SIM_FUND, "usdt") < amount + RELAY_FEE_USDT)
      return { ok: false, code: "insufficient_funds", message: "Restock wallet cannot cover this payment and its fee" };
    this.add(SIM_FUND, "usdt", -(amount + RELAY_FEE_USDT));
    this.add(to, "usdt", amount);
    s.spent = (spent + amount + RELAY_FEE_USDT).toString();
    this.ledger.set("sim.session", JSON.stringify(s));
    return { ok: true, txHash: fakeHash() };
  }

  async session(): Promise<SessionState> {
    const s = this.sim();
    const status = s.revoked ? "revoked" : Date.now() / 1000 >= s.expiry ? "expired" : "active";
    return {
      wallet: SIM_FUND,
      keyId: s.keyId,
      keyHash: s.keyHash,
      status,
      expiry: s.expiry,
      allowlist: [{ to: CELO.USDT, selector: "transfer(address,uint256)" }],
      caps: [{ token: CELO.USDT, period: "year", limit: BigInt(s.capLimit), spent: BigInt(s.spent) }],
      explorerUrl: null,
    };
  }
}
