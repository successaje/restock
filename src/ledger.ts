// The agent's local record of what happened. The chain is the source of truth
// for balances; this ledger remembers *why* each transaction happened (which
// customer paid, which rule split it, which reorder spent it) so the installer
// can see their book, not just a wallet balance.
import { EventEmitter } from "node:events";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type Customer = {
  id: number;
  name: string;
  wallet: string; // address the customer pays cNGN from
  system: string; // what they bought, e.g. "3.5kVA inverter + 4 panels"
  priceNgn: number;
  months: number;
  startDate: string; // ISO date of first installment
};

export type Payment = {
  id: number;
  customerId: number | null; // null when the sender isn't a known customer
  fromAddress: string;
  txHash: string;
  cngnAmount: string; // base units (bigint as string)
  receivedAt: string;
  restockBps: number; // share of this payment routed to the restock fund
  status: "received" | "converting" | "converted" | "failed" | "skipped";
  conversionId: number | null;
  error: string | null;
};

// One Textile swap. Small installments are batched until they clear Textile's
// ~$1 floor, so a conversion can cover several payments.
export type Conversion = {
  id: number;
  paymentIds: number[];
  cngnIn: string; // cNGN sold, fee included
  usdtOut: string;
  ngnPerUsd: number; // effective rate the maker filled at
  quoteId: string | null;
  txHash: string | null;
  at: string;
};

export type RestockOrder = {
  id: number;
  supplier: string;
  units: number;
  usdtAmount: string;
  txHash: string | null;
  status: "pending" | "paid" | "blocked" | "failed";
  reason: string | null; // why it was blocked (cap, expiry, revoked, allowlist)
  at: string;
};

export type AgentEvent = {
  id: number;
  at: string;
  kind: "payment" | "convert" | "restock" | "blocked" | "session" | "info" | "error";
  message: string;
  txHash: string | null;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  wallet TEXT NOT NULL UNIQUE COLLATE NOCASE,
  system TEXT NOT NULL,
  price_ngn INTEGER NOT NULL,
  months INTEGER NOT NULL,
  start_date TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  from_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  cngn_amount TEXT NOT NULL,
  received_at TEXT NOT NULL,
  restock_bps INTEGER NOT NULL,
  status TEXT NOT NULL,
  conversion_id INTEGER,
  error TEXT,
  UNIQUE (tx_hash, log_index)
);
CREATE TABLE IF NOT EXISTS conversions (
  id INTEGER PRIMARY KEY,
  cngn_in TEXT NOT NULL,
  usdt_out TEXT NOT NULL,
  ngn_per_usd REAL NOT NULL,
  quote_id TEXT,
  tx_hash TEXT,
  at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS restock_orders (
  id INTEGER PRIMARY KEY,
  supplier TEXT NOT NULL,
  units INTEGER NOT NULL,
  usdt_amount TEXT NOT NULL,
  tx_hash TEXT,
  status TEXT NOT NULL,
  reason TEXT,
  at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  tx_hash TEXT
);
CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL,
  ngn_per_usd REAL,
  fund_usdt TEXT
);
CREATE INDEX IF NOT EXISTS snapshots_at ON snapshots(at);
CREATE TABLE IF NOT EXISTS kv (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
`;

const now = () => new Date().toISOString();

export type Snapshot = { at: string; ngnPerUsd: number | null; fundUsdt: string | null };

/** Emits "change" whenever something the dashboard shows has changed. */
export class Ledger extends EventEmitter {
  readonly db: DatabaseSync;

  constructor(path: string) {
    super();
    this.setMaxListeners(100);
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(SCHEMA);
  }

  // ---- key/value (cursor of last scanned block, cached rate, etc.)
  get(k: string): string | undefined {
    const row = this.db.prepare("SELECT v FROM kv WHERE k = ?").get(k) as { v: string } | undefined;
    return row?.v;
  }
  set(k: string, v: string) {
    this.db.prepare("INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(k, v);
  }

  // ---- time series for charts: the naira rate and the fund balance
  snapshot(s: { ngnPerUsd?: number | null; fundUsdt?: bigint | null }) {
    this.db
      .prepare("INSERT INTO snapshots (at, ngn_per_usd, fund_usdt) VALUES (?, ?, ?)")
      .run(now(), s.ngnPerUsd ?? null, s.fundUsdt != null ? s.fundUsdt.toString() : null);
  }
  lastSnapshotAt(kind: "rate" | "fund"): number {
    const col = kind === "rate" ? "ngn_per_usd" : "fund_usdt";
    const row = this.db.prepare(`SELECT at FROM snapshots WHERE ${col} IS NOT NULL ORDER BY id DESC LIMIT 1`).get() as
      | { at: string }
      | undefined;
    return row ? Date.parse(row.at) : 0;
  }
  snapshots(sinceIso: string): Snapshot[] {
    return (this.db.prepare("SELECT * FROM snapshots WHERE at >= ? ORDER BY id").all(sinceIso) as any[]).map((r) => ({
      at: r.at,
      ngnPerUsd: r.ngn_per_usd,
      fundUsdt: r.fund_usdt,
    }));
  }

  // ---- customers
  addCustomer(c: Omit<Customer, "id">): Customer {
    const r = this.db
      .prepare(
        `INSERT INTO customers (name, wallet, system, price_ngn, months, start_date)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(wallet) DO UPDATE SET name = excluded.name, system = excluded.system,
           price_ngn = excluded.price_ngn, months = excluded.months, start_date = excluded.start_date`,
      )
      .run(c.name, c.wallet, c.system, c.priceNgn, c.months, c.startDate);
    return this.customerByWallet(c.wallet) ?? { id: Number(r.lastInsertRowid), ...c };
  }
  customers(): Customer[] {
    return (this.db.prepare("SELECT * FROM customers ORDER BY id").all() as any[]).map(rowToCustomer);
  }
  customerByWallet(wallet: string): Customer | undefined {
    const row = this.db.prepare("SELECT * FROM customers WHERE wallet = ? COLLATE NOCASE").get(wallet);
    return row ? rowToCustomer(row) : undefined;
  }

  // ---- payments
  /** Returns the new payment, or undefined if this transfer was already recorded. */
  recordPayment(p: {
    fromAddress: string;
    txHash: string;
    logIndex: number;
    cngnAmount: bigint;
    receivedAt?: string;
    restockBps: number;
  }): Payment | undefined {
    const customer = this.customerByWallet(p.fromAddress);
    const r = this.db
      .prepare(
        `INSERT OR IGNORE INTO payments
           (customer_id, from_address, tx_hash, log_index, cngn_amount, received_at, restock_bps, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'received')`,
      )
      .run(
        customer?.id ?? null,
        p.fromAddress,
        p.txHash,
        p.logIndex,
        p.cngnAmount.toString(),
        p.receivedAt ?? now(),
        p.restockBps,
      );
    if (r.changes === 0) return undefined;
    return this.payment(Number(r.lastInsertRowid));
  }
  payment(id: number): Payment | undefined {
    const row = this.db.prepare("SELECT * FROM payments WHERE id = ?").get(id);
    return row ? rowToPayment(row) : undefined;
  }
  payments(limit = 200): Payment[] {
    return (this.db.prepare("SELECT * FROM payments ORDER BY id DESC LIMIT ?").all(limit) as any[]).map(rowToPayment);
  }
  pendingPayments(): Payment[] {
    return (
      this.db.prepare("SELECT * FROM payments WHERE status IN ('received','failed') ORDER BY id").all() as any[]
    ).map(rowToPayment);
  }
  setPaymentStatus(id: number, status: Payment["status"], error: string | null = null) {
    this.db.prepare("UPDATE payments SET status = ?, error = ? WHERE id = ?").run(status, error, id);
  }

  // ---- conversions
  recordConversion(c: Omit<Conversion, "id" | "at">): Conversion {
    const at = now();
    const r = this.db
      .prepare(
        `INSERT INTO conversions (cngn_in, usdt_out, ngn_per_usd, quote_id, tx_hash, at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(c.cngnIn, c.usdtOut, c.ngnPerUsd, c.quoteId, c.txHash, at);
    const id = Number(r.lastInsertRowid);
    const mark = this.db.prepare("UPDATE payments SET status = 'converted', conversion_id = ?, error = NULL WHERE id = ?");
    for (const pid of c.paymentIds) mark.run(id, pid);
    return { id, at, ...c };
  }
  conversions(): Conversion[] {
    const rows = this.db.prepare("SELECT * FROM conversions ORDER BY id").all() as any[];
    const links = this.db.prepare("SELECT id, conversion_id FROM payments WHERE conversion_id IS NOT NULL").all() as any[];
    return rows.map((r) => ({
      ...rowToConversion(r),
      paymentIds: links.filter((l) => l.conversion_id === r.id).map((l) => l.id),
    }));
  }

  // ---- restock orders
  recordOrder(o: Omit<RestockOrder, "id" | "at">): RestockOrder {
    const at = now();
    const r = this.db
      .prepare(
        `INSERT INTO restock_orders (supplier, units, usdt_amount, tx_hash, status, reason, at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(o.supplier, o.units, o.usdtAmount, o.txHash, o.status, o.reason, at);
    return { id: Number(r.lastInsertRowid), at, ...o };
  }
  orders(): RestockOrder[] {
    return (this.db.prepare("SELECT * FROM restock_orders ORDER BY id DESC").all() as any[]).map(rowToOrder);
  }

  // ---- activity feed
  log(kind: AgentEvent["kind"], message: string, txHash: string | null = null) {
    const at = now();
    const r = this.db.prepare("INSERT INTO events (at, kind, message, tx_hash) VALUES (?, ?, ?, ?)").run(at, kind, message, txHash);
    const tag = txHash ? ` ${txHash}` : "";
    console.log(`[${kind}] ${message}${tag}`);
    this.emit("change", { id: Number(r.lastInsertRowid), at, kind, message, txHash } satisfies AgentEvent);
  }
  events(limit = 50): AgentEvent[] {
    return (this.db.prepare("SELECT * FROM events ORDER BY id DESC LIMIT ?").all(limit) as any[]).map((r) => ({
      id: r.id,
      at: r.at,
      kind: r.kind,
      message: r.message,
      txHash: r.tx_hash,
    }));
  }
}

function rowToCustomer(r: any): Customer {
  return {
    id: r.id,
    name: r.name,
    wallet: r.wallet,
    system: r.system,
    priceNgn: r.price_ngn,
    months: r.months,
    startDate: r.start_date,
  };
}
function rowToPayment(r: any): Payment {
  return {
    id: r.id,
    customerId: r.customer_id,
    fromAddress: r.from_address,
    txHash: r.tx_hash,
    cngnAmount: r.cngn_amount,
    receivedAt: r.received_at,
    restockBps: r.restock_bps,
    status: r.status,
    conversionId: r.conversion_id,
    error: r.error,
  };
}
function rowToConversion(r: any): Conversion {
  return {
    id: r.id,
    paymentIds: [],
    cngnIn: r.cngn_in,
    usdtOut: r.usdt_out,
    ngnPerUsd: r.ngn_per_usd,
    quoteId: r.quote_id,
    txHash: r.tx_hash,
    at: r.at,
  };
}
function rowToOrder(r: any): RestockOrder {
  return {
    id: r.id,
    supplier: r.supplier,
    units: r.units,
    usdtAmount: r.usdt_amount,
    txHash: r.tx_hash,
    status: r.status,
    reason: r.reason,
    at: r.at,
  };
}
