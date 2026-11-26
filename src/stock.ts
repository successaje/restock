// The one number the installer sees: how many units of stock their customer
// book can buy today. Everything here is pure arithmetic so it can be tested
// without a chain.
import type { Conversion, Customer, Payment } from "./ledger.js";

export type StockUnit = {
  name: string; // e.g. "3.5kVA hybrid kit"
  usdCost: number; // supplier price per unit in USD₮
};

export type StockInputs = {
  fundUsdt: bigint; // USD₮ sitting in the restock wallet, base units
  usdtDecimals: number;
  cngnDecimals: number;
  ngnPerUsdNow: number; // today's rate, from a live Textile quote
  unit: StockUnit;
  restockBps: number; // the installer's rule, e.g. 7000 = 70%
  conversions: Conversion[];
  customers: Customer[];
  payments: Payment[];
};

export type StockView = {
  unitsToday: number;
  fundUsd: number;
  fundNgnToday: number;

  // The devaluation story: what the money still in the fund would buy if the
  // installer had kept those installments in naira instead.
  nairaBehindFund: number; // naira that became the USD₮ still in the fund
  unitsIfHeldNaira: number;
  ngnProtected: number; // fund value today in naira minus naira routed
  unitsProtected: number;
  firstNgnPerUsd: number | null;
  nairaMoveSinceFirst: number | null; // e.g. 0.12 = naira is 12% weaker vs first conversion

  // The rest of the book, if it's collected and converted at today's rate.
  receivableNgn: number;
  projectedUnits: number;
};

export const toUnits = (amount: bigint, decimals: number) => Number(amount) / 10 ** decimals;

export function stockView(i: StockInputs): StockView {
  const fundUsd = toUnits(i.fundUsdt, i.usdtDecimals);
  const unitsToday = Math.floor(fundUsd / i.unit.usdCost);

  // Money already paid to suppliers became stock; compare only what is still
  // in the fund. Spending is attributed pro rata across conversions.
  const nairaConverted = i.conversions.reduce((s, c) => s + toUnits(BigInt(c.cngnIn), i.cngnDecimals), 0);
  const usdConverted = i.conversions.reduce((s, c) => s + toUnits(BigInt(c.usdtOut), i.usdtDecimals), 0);
  const stillHeld = usdConverted > 0 ? Math.min(1, fundUsd / usdConverted) : 0;
  const nairaBehindFund = nairaConverted * stillHeld;
  const unitsIfHeldNaira = Math.floor(nairaBehindFund / i.ngnPerUsdNow / i.unit.usdCost);
  const fundNgnToday = fundUsd * i.ngnPerUsdNow;

  const first = i.conversions[0];
  const firstNgnPerUsd = first ? first.ngnPerUsd : null;
  const nairaMoveSinceFirst = firstNgnPerUsd ? i.ngnPerUsdNow / firstNgnPerUsd - 1 : null;

  const paidByCustomer = new Map<number, number>();
  for (const p of i.payments) {
    if (p.customerId == null) continue;
    paidByCustomer.set(
      p.customerId,
      (paidByCustomer.get(p.customerId) ?? 0) + toUnits(BigInt(p.cngnAmount), i.cngnDecimals),
    );
  }
  const receivableNgn = i.customers.reduce(
    (s, c) => s + Math.max(0, c.priceNgn - (paidByCustomer.get(c.id) ?? 0)),
    0,
  );
  const projectedUsd = fundUsd + (receivableNgn * (i.restockBps / 10_000)) / i.ngnPerUsdNow;
  const projectedUnits = Math.floor(projectedUsd / i.unit.usdCost);

  return {
    unitsToday,
    fundUsd,
    fundNgnToday,
    nairaBehindFund,
    unitsIfHeldNaira,
    ngnProtected: usdConverted > 0 ? fundNgnToday - nairaBehindFund : 0,
    unitsProtected: unitsToday - unitsIfHeldNaira,
    firstNgnPerUsd,
    nairaMoveSinceFirst,
    receivableNgn,
    projectedUnits,
  };
}

/** Split an incoming cNGN payment by the installer's rule. */
export function splitPayment(amount: bigint, restockBps: number): { toRestock: bigint; toCash: bigint } {
  if (restockBps < 0 || restockBps > 10_000) throw new Error(`restockBps out of range: ${restockBps}`);
  const toRestock = (amount * BigInt(restockBps)) / 10_000n;
  return { toRestock, toCash: amount - toRestock };
}
