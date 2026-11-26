import { test } from "node:test";
import assert from "node:assert/strict";
import { endOfQuarter, loadConfig } from "../src/config.js";
import { Ledger } from "../src/ledger.js";
import { readSettings, writeSettings } from "../src/settings.js";

const KEY = `0x${"11".repeat(32)}`;
const SUPPLIER = "0x5150000000000000000000000000000000005150";

test("session keys expire at the last second of the quarter, Lagos time", () => {
  assert.equal(endOfQuarter(new Date("2026-11-26T12:00:00Z")).toISOString(), "2026-12-31T22:59:59.000Z");
  // 23:30 UTC on 31 Dec is already 1 January in Lagos: next quarter.
  assert.equal(endOfQuarter(new Date("2026-12-31T23:30:00Z")).toISOString(), "2027-03-31T22:59:59.000Z");
  assert.equal(endOfQuarter(new Date("2027-04-01T00:00:00Z")).toISOString(), "2027-06-30T22:59:59.000Z");
});

test("live mode refuses to start without its keys", () => {
  assert.throws(() => loadConfig({ MODE: "live" }), /AGENT_PRIVATE_KEY, ALTANA_WALLET, ALTANA_SESSION_KEY, SUPPLIER_ADDRESS/);
  assert.throws(() => loadConfig({ MODE: "sim", RESTOCK_BPS: "12000" }), /RESTOCK_BPS/);
  assert.equal(loadConfig({ MODE: "live" }, true).MODE, "live"); // setup scripts run before the keys exist
});

test("in live mode only the server's environment can change who gets paid", () => {
  const cfg = loadConfig({
    MODE: "live",
    DB_PATH: ":memory:",
    AGENT_PRIVATE_KEY: KEY,
    ALTANA_WALLET: SUPPLIER,
    ALTANA_SESSION_KEY: KEY,
    SUPPLIER_ADDRESS: SUPPLIER,
    ATTRIBUTION_CODE: "celo_abc123",
  });
  const ledger = new Ledger(":memory:");
  assert.throws(() => writeSettings(cfg, ledger, { supplierAddress: `0x${"de".repeat(20)}` }), /SUPPLIER_ADDRESS/);

  // Even a value planted straight in the ledger is ignored.
  ledger.set("settings", JSON.stringify({ supplierAddress: `0x${"de".repeat(20)}` }));
  assert.equal(readSettings(cfg, ledger).supplierAddress, SUPPLIER);

  // Everything else is the installer's to change.
  assert.equal(writeSettings(cfg, ledger, { restockBps: 6000 }).restockBps, 6000);
  assert.throws(() => writeSettings(cfg, ledger, { restockBps: 6000, extra: 1 }));
});
