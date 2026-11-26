// The agent loop and its guardrails, run against the simulated chain with the
// naira pinned at a fixed rate so every number here is exact and no test
// touches the network.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Address } from "viem";
import { RestockAgent } from "../src/agent.js";
import { loadConfig } from "../src/config.js";
import { Ledger } from "../src/ledger.js";
import { SimRails } from "../src/rails/sim.js";

const CUSTOMER = "0xC0FFEE00000000000000000000000000000C0FEE" as Address;
const CASH = "0xCA5400000000000000000000000000000000CA54" as Address;
const STRANGER = "0xBAD0000000000000000000000000000000000BAD" as Address;

const NGN = (n: number) => BigInt(Math.round(n * 1e6)); // cNGN, 6 decimals
const USD = (n: number) => BigInt(Math.round(n * 1e6)); // USD₮, 6 decimals

/** Sim rails priced at a fixed ₦1,500/$ (plus any simulated shock). */
class FixedRateRails extends SimRails {
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

function setup(env: Record<string, string> = {}) {
  const cfg = loadConfig({ MODE: "sim", DB_PATH: ":memory:", CASH_ADDRESS: CASH, ...env });
  const ledger = new Ledger(cfg.DB_PATH);
  const rails = new FixedRateRails(cfg, ledger);
  const agent = new RestockAgent(cfg, ledger, rails);
  ledger.addCustomer({ name: "Adaeze", wallet: CUSTOMER, system: "3.5kVA kit", priceNgn: 2_400_000, months: 12, startDate: "2026-11-01" });
  const supplier = agent.settings.supplierAddress!;
  return { cfg, ledger, rails, agent, supplier };
}

const pay = async (s: ReturnType<typeof setup>, ngn: number) => {
  s.rails.customerPays(CUSTOMER, NGN(ngn));
  await s.agent.tick();
};

test("an installment is split by the rule, converted, and moved into the restock wallet", async () => {
  const s = setup();
  await pay(s, 300_000);

  // 70% of ₦300,000 = ₦210,000 sold at ₦1,500/$ = $140; the agent keeps $0.10 for gas.
  assert.equal(await s.rails.fundBalance(), USD(139.9));
  assert.equal(s.rails.balanceOf(s.rails.agentAddress, "usdt"), USD(0.1));
  // The other 30% reaches the installer in cNGN.
  assert.equal(s.rails.balanceOf(CASH, "cngn"), NGN(90_000));
  assert.equal(s.rails.balanceOf(s.rails.agentAddress, "cngn"), 0n);

  const [p] = s.ledger.payments();
  assert.equal(p!.status, "converted");
  assert.equal(p!.customerId, 1, "payment is attributed to the customer who sent it");
  const [c] = s.ledger.conversions();
  assert.equal(c!.cngnIn, NGN(210_000).toString());
  assert.equal(c!.usdtOut, USD(140).toString());
  assert.equal(c!.ngnPerUsd, 1500);

  const log = s.ledger.events(10).map((e) => e.message);
  assert.ok(log.some((m) => m.includes("₦300,000 received from Adaeze")));
  assert.ok(log.some((m) => m.startsWith("Converted ₦210,000 → $140.00 USD₮")));
});

test("installments below the batch floor wait and convert together", async () => {
  const s = setup({ MIN_CONVERT_CNGN: "5000" });
  await pay(s, 4_000); // restock share ₦2,800: below ₦5,000, held
  assert.equal(s.ledger.conversions().length, 0);
  assert.equal(s.ledger.payments()[0]!.status, "received");

  await pay(s, 4_000); // ₦5,600 together: converted in one swap
  const conversions = s.ledger.conversions();
  assert.equal(conversions.length, 1);
  assert.deepEqual(conversions[0]!.paymentIds, [1, 2]);
  assert.equal(conversions[0]!.cngnIn, NGN(5_600).toString());
  assert.ok(s.ledger.payments().every((p) => p.status === "converted"));
});

test("a failed conversion is retried after its backoff, not lost", async () => {
  const s = setup();
  s.rails.failNextConvert = true;
  await pay(s, 300_000);
  assert.equal(s.ledger.payments()[0]!.status, "failed");
  assert.equal(await s.rails.fundBalance(), 0n);

  await s.agent.tick(); // still inside the backoff window: nothing happens
  assert.equal(s.ledger.conversions().length, 0);

  s.ledger.set("convert.retryAt", "0"); // backoff elapsed
  await s.agent.tick();
  assert.equal(s.ledger.payments()[0]!.status, "converted");
  assert.equal(await s.rails.fundBalance(), USD(139.9));
});

test("the same onchain transfer is only counted once", () => {
  const s = setup();
  const t = { fromAddress: CUSTOMER, txHash: "0xabc", logIndex: 3, cngnAmount: NGN(1000), restockBps: 7000 };
  assert.ok(s.ledger.recordPayment(t));
  assert.equal(s.ledger.recordPayment(t), undefined);
  assert.equal(s.ledger.payments().length, 1);
});

test("a reorder pays the approved supplier from the restock wallet, relay fee included", async () => {
  const s = setup();
  await pay(s, 1_500_000); // ₦1.05m → $700 → $699.90 in the fund
  const order = await s.agent.restock(1); // 1 kit at $650

  assert.equal(order.status, "paid");
  assert.equal(s.rails.balanceOf(s.supplier, "usdt"), USD(650));
  assert.equal(await s.rails.fundBalance(), USD(699.9 - 650 - 0.02));
  const session = await s.rails.session();
  assert.equal(session.caps[0]!.spent, USD(650.02));
});

test("the spend cap stops a reorder before anything moves", async () => {
  const s = setup({ SESSION_CAP_USDT: "1000" });
  await pay(s, 3_000_000); // $1,399.90 in the fund: enough money, but not enough cap
  assert.equal((await s.agent.restock(1)).status, "paid"); // $650.02 of the $1,000 cap used
  const before = await s.rails.fundBalance();

  const blocked = await s.agent.restock(1);
  assert.equal(blocked.status, "blocked");
  assert.match(blocked.reason!, /^spend_limit_exceeded/);
  assert.equal(await s.rails.fundBalance(), before);
  assert.equal(s.rails.balanceOf(s.supplier, "usdt"), USD(650));
  assert.equal(s.ledger.events(1)[0]!.kind, "blocked");
});

test("only the approved supplier can be paid", async () => {
  const s = setup();
  await pay(s, 1_500_000);
  const before = await s.rails.fundBalance();
  const o = await s.agent.restock(1, STRANGER);
  assert.equal(o.status, "blocked");
  assert.match(o.reason!, /^recipient_not_allowlisted/);
  assert.equal(await s.rails.fundBalance(), before);
  assert.equal(s.rails.balanceOf(STRANGER, "usdt"), 0n);
});

test("revoking the key stops the agent, and a new grant restores it", async () => {
  const s = setup();
  await pay(s, 3_000_000);
  s.rails.revoke();
  assert.equal((await s.rails.session()).status, "revoked");
  const o = await s.agent.restock(1);
  assert.equal(o.status, "blocked");
  assert.match(o.reason!, /^session_revoked/);

  s.rails.grant();
  assert.equal((await s.agent.restock(1)).status, "paid");
});

test("an expired key is refused", async () => {
  const s = setup();
  await pay(s, 1_500_000);
  s.rails.grant(2000, Math.floor(Date.now() / 1000) - 60);
  assert.equal((await s.rails.session()).status, "expired");
  assert.match((await s.agent.restock(1)).reason!, /^session_expired/);
});

test("a reorder the fund cannot cover is refused", async () => {
  const s = setup();
  await pay(s, 300_000); // $139.90, less than one $650 kit
  assert.match((await s.agent.restock(1)).reason!, /^insufficient_funds/);
  await assert.rejects(s.agent.restock(0), /positive whole number/);
});

test("the one number follows the fund and the naira", async () => {
  const s = setup();
  await pay(s, 3_000_000); // $1,399.90 → 2 kits at $650
  let st = await s.agent.state();
  assert.equal(st.stock!.unitsToday, 2);
  assert.equal(Math.round(st.stock!.ngnProtected), 0); // same rate as converted: no gain, no loss

  s.rails.shock(25); // the naira weakens 25%
  s.agent.invalidateRate();
  st = await s.agent.state();
  assert.equal(st.ngnPerUsd, 1875);
  assert.equal(st.stock!.unitsToday, 2, "dollars held still buy the same stock");
  assert.ok(st.stock!.ngnProtected > 520_000, "the fund is worth more naira than went into it");
});

test("auto-restock reorders whole units as soon as the fund covers them", async () => {
  const s = setup({ AUTO_RESTOCK: "true" });
  await pay(s, 1_500_000);
  const [o] = s.ledger.orders();
  assert.equal(o?.status, "paid");
  assert.equal(o?.units, 1);
});
