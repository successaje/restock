import { test } from "node:test";
import assert from "node:assert/strict";
import { splitPayment, stockView } from "../src/stock.js";

test("splitPayment routes the rule's share and keeps the rest as cash", () => {
  const { toRestock, toCash } = splitPayment(166_666_670000n, 7000);
  assert.equal(toRestock + toCash, 166_666_670000n);
  assert.equal(toRestock, 116_666_669000n);
  assert.throws(() => splitPayment(1n, 10_001));
});

test("stockView shows units the fund buys and what naira would have bought", () => {
  const v = stockView({
    fundUsdt: 1_400_000000n, // $1,400
    usdtDecimals: 6,
    cngnDecimals: 6,
    ngnPerUsdNow: 1700,
    unit: { name: "kit", usdCost: 650 },
    restockBps: 7000,
    // ₦2,100,000 converted back when $1 = ₦1,500 → $1,400
    conversions: [
      { id: 1, paymentIds: [1], cngnIn: "2100000000000", usdtOut: "1400000000", ngnPerUsd: 1500, quoteId: null, txHash: null, at: "" },
    ],
    customers: [{ id: 1, name: "A", wallet: "0x1", system: "", priceNgn: 4_000_000, months: 12, startDate: "" }],
    payments: [
      { id: 1, customerId: 1, fromAddress: "0x1", txHash: "0x", cngnAmount: "3000000000000", receivedAt: "", restockBps: 7000, status: "converted", conversionId: 1, error: null },
    ],
  });
  assert.equal(v.unitsToday, 2); // 1400 / 650
  assert.equal(v.unitsIfHeldNaira, 1); // 2.1m / 1700 = $1,235 → 1 kit
  assert.equal(v.unitsProtected, 1);
  assert.equal(Math.round(v.ngnProtected), 280_000); // 1400*1700 - 2.1m
  assert.ok(Math.abs((v.nairaMoveSinceFirst ?? 0) - 0.1333) < 0.001);
  assert.equal(v.receivableNgn, 1_000_000);
  // 1400 + 1m*0.7/1700 = 1811.76 → 2 kits
  assert.equal(v.projectedUnits, 2);
});

test("money already spent on stock is not counted as a loss", () => {
  // ₦1.5m converted at ₦1,500/$ → $1,000; $650 later paid to the supplier.
  const v = stockView({
    fundUsdt: 350_000000n,
    usdtDecimals: 6,
    cngnDecimals: 6,
    ngnPerUsdNow: 1500,
    unit: { name: "kit", usdCost: 650 },
    restockBps: 7000,
    conversions: [
      { id: 1, paymentIds: [1], cngnIn: "1500000000000", usdtOut: "1000000000", ngnPerUsd: 1500, quoteId: null, txHash: null, at: "" },
    ],
    customers: [],
    payments: [],
  });
  assert.equal(Math.round(v.nairaBehindFund), 525_000); // 35% of the naira is still in the fund
  assert.equal(Math.round(v.ngnProtected), 0); // rate unchanged → no gain, no loss
});
