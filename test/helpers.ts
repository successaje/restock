// Shared test setup: the simulated chain with the naira pinned at a fixed
// rate, so every figure is exact and no test touches the network.
import type { Address } from "viem";
import { RestockAgent } from "../src/agent.js";
import { loadConfig } from "../src/config.js";
import { Ledger } from "../src/ledger.js";
import { SimRails } from "../src/rails/sim.js";

export const CUSTOMER = "0xC0FFEE00000000000000000000000000000C0FEE" as Address;
export const CASH = "0xCA5400000000000000000000000000000000CA54" as Address;
export const STRANGER = "0xBAD0000000000000000000000000000000000BAD" as Address;

export const NGN = (n: number) => BigInt(Math.round(n * 1e6)); // cNGN, 6 decimals
export const USD = (n: number) => BigInt(Math.round(n * 1e6)); // USD₮, 6 decimals

/** Sim rails priced at a fixed ₦1,500/$ (plus any simulated shock). */
export class FixedRateRails extends SimRails {
  rate = 1500;
  failNextConvert = false;
  override async quoteRate() {
    return this.rate * (1 + this.shockPct / 100);
  }
  override async convert(cngn: bigint) {
    if (this.failNextConvert) {
      this.failNextConvert = false;
      throw new Error("maker went quiet");
    }
    return super.convert(cngn);
  }
}

export function setup(env: Record<string, string> = {}) {
  const cfg = loadConfig({ MODE: "sim", DB_PATH: ":memory:", CASH_ADDRESS: CASH, ...env });
  const ledger = new Ledger(cfg.DB_PATH);
  const rails = new FixedRateRails(cfg, ledger);
  const agent = new RestockAgent(cfg, ledger, rails);
  ledger.addCustomer({ name: "Adaeze", wallet: CUSTOMER, system: "3.5kVA kit", priceNgn: 2_400_000, months: 12, startDate: "2026-11-01" });
  const supplier = agent.settings.supplierAddress!;
  return { cfg, ledger, rails, agent, supplier };
}

export type Setup = ReturnType<typeof setup>;

/** A customer pays an installment and the agent runs one tick. */
export async function pay(s: Setup, ngn: number) {
  s.rails.customerPays(CUSTOMER, NGN(ngn));
  await s.agent.tick();
}
