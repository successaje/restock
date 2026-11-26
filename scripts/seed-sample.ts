// Adds clearly-labelled sample customers so the simulation has a book to show.
// For the real submission, add the installer's actual customers instead
// (dashboard "Add a customer", or POST /api/customers).
import { privateKeyToAddress, generatePrivateKey } from "viem/accounts";
import { loadConfig } from "../src/config.js";
import { Ledger } from "../src/ledger.js";

const cfg = loadConfig();
if (cfg.MODE === "live") throw new Error("seed-sample is for MODE=sim only");
const ledger = new Ledger(cfg.DB_PATH);
const monthsAgo = (n: number) => {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
};
const rows = [
  { name: "Sample customer · Ikeja shop", system: "3.5kVA inverter, 4 × 450W panels", priceNgn: 2_400_000, months: 12, startDate: monthsAgo(3) },
  { name: "Sample customer · Yaba home", system: "1.5kVA inverter, 200Ah battery", priceNgn: 1_200_000, months: 10, startDate: monthsAgo(1) },
  { name: "Sample customer · Lekki clinic", system: "5kVA hybrid, 6 panels, 2 batteries", priceNgn: 4_800_000, months: 12, startDate: monthsAgo(0) },
];
for (const r of rows) ledger.addCustomer({ ...r, wallet: privateKeyToAddress(generatePrivateKey()) });
console.log(`Added ${rows.length} sample customers to ${cfg.DB_PATH}`);
