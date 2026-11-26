import "dotenv/config";
import { z } from "zod";
import type { Address, Hex } from "viem";

// Celo mainnet addresses (chain 42220), from the hackathon brief and verified onchain.
export const CELO = {
  chainId: 42220,
  USDT: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as Address,
  // Celo fee abstraction needs the USD₮ *adapter* as feeCurrency, not the token.
  USDT_FEE_ADAPTER: "0x0E2A3e05bc9A16F5292A6170456A710cb89C6f72" as Address,
  CNGN: "0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f" as Address,
  TEXTILE_REACTOR: "0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3" as Address,
  ERC8004_IDENTITY: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as Address,
  ERC8004_REPUTATION: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as Address,
  ALTANA_KEYSTORE: "0x83b30935f36d6ccf9B1ec3b5E47F2866b97cd27c" as Address,
  ALTANA_KEYSTORE_CONTROLLER: "0x47bA5fc2A5b0CcB24BA3fAC9D4B59400eE9fd1D6" as Address,
  ALTANA_RELAY: "https://relay.altana.network",
} as const;

const addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x address").transform((s) => s as Address);
const pk = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "must be a 0x-prefixed 32-byte hex key").transform((s) => s as Hex);
const optional = <T extends z.ZodTypeAny>(t: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), t.optional());

const Env = z.object({
  // "sim" runs the whole product against an in-memory chain with live Textile
  // prices: no keys, no funds. "live" sends real Celo mainnet transactions.
  MODE: z.enum(["sim", "live"]).default("sim"),
  PORT: z.coerce.number().default(8787),
  // Interface to listen on. Unset listens on all of them (IPv4 and IPv6).
  HOST: optional(z.string()),
  // Unlocks the installer dashboard (reorders, settings, customer book) once
  // the server is reachable from the internet. Required in live mode. Make
  // one with: openssl rand -base64 24
  DASHBOARD_TOKEN: optional(z.string().min(16, "use at least 16 characters (openssl rand -base64 24)")),
  DB_PATH: z.string().optional(), // defaults to data/<MODE>.db so sim and live never mix
  CELO_RPC_URL: z.string().url().default("https://forno.celo.org"),

  // Attribution tag issued at hackathon enrollment. celo_test1234 is the
  // documented dev placeholder and earns nothing.
  ATTRIBUTION_CODE: z.string().regex(/^[a-z0-9_]{1,32}$/).default("celo_test1234"),

  // The agent's own key. It receives customers' cNGN, takes Textile quotes
  // (Textile binds an order to the wallet that sends it), and holds the
  // agent's ERC-8004 identity.
  AGENT_PRIVATE_KEY: optional(pk),

  // Altana smart wallet that holds the restock fund (it is the installer's own
  // address, upgraded in place with EIP-7702), and the session key the
  // installer granted the agent to pay suppliers from it. scripts/grant.ts
  // writes the session's public description to ALTANA_SESSION_FILE.
  ALTANA_WALLET: optional(addr),
  ALTANA_SESSION_KEY: optional(pk),
  ALTANA_SESSION_FILE: z.string().default("data/session.json"),
  // The same description as one env var (raw JSON or base64), for hosts where
  // copying a file is awkward. Wins over the file when set. Not a secret: the
  // session's private key stays in ALTANA_SESSION_KEY.
  ALTANA_SESSION_JSON: optional(z.string()),

  // Owner key for the Altana wallet. Only scripts/grant.ts and revoke.ts use it;
  // the agent process never needs it.
  OWNER_PRIVATE_KEY: optional(pk),

  TEXTILE_API_KEY: optional(z.string()),

  // The installer's business rule.
  INSTALLER_NAME: z.string().default("Installer"),
  RESTOCK_BPS: z.coerce.number().int().min(0).max(10_000).default(7000),
  UNIT_NAME: z.string().default("3.5kVA hybrid kit"),
  UNIT_USD_COST: z.coerce.number().positive().default(650),
  SUPPLIER_NAME: z.string().default("Supplier"),
  SUPPLIER_ADDRESS: optional(addr),
  // Where the installer's cash share (the part not routed to restock) goes, in
  // cNGN. Defaults to the Altana wallet, which is the installer's own address.
  CASH_ADDRESS: optional(addr),
  // USD₮ the agent keeps for its own gas (paid in USD₮ via fee abstraction).
  GAS_RESERVE_USDT: z.coerce.number().default(0.1),
  // First block to scan for customer payments in live mode.
  START_BLOCK: optional(z.coerce.bigint()),

  // Session-key limits the installer grants (scripts/grant.ts).
  SESSION_CAP_USDT: z.coerce.number().positive().default(2000),
  SESSION_EXPIRES_AT: optional(z.string()), // ISO; defaults to end of this quarter

  // Below this, a payment waits and is batched with the next one, because
  // Textile's floor is ~$1 and each swap costs gas.
  MIN_CONVERT_CNGN: z.coerce.number().default(5000),
  POLL_MS: z.coerce.number().default(10_000),
  AUTO_RESTOCK: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type Config = z.infer<typeof Env> & { DB_PATH: string };

/** `forSetup` skips the live-mode completeness check, for the scripts that create those keys. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env, forSetup = false): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid configuration:\n${lines}`);
  }
  const c = { ...parsed.data, DB_PATH: parsed.data.DB_PATH ?? `data/${parsed.data.MODE}.db` };
  if (c.MODE === "live" && !forSetup) {
    const missing = (["AGENT_PRIVATE_KEY", "ALTANA_WALLET", "ALTANA_SESSION_KEY", "SUPPLIER_ADDRESS", "DASHBOARD_TOKEN"] as const).filter(
      (k) => !c[k],
    );
    if (missing.length) throw new Error(`MODE=live needs: ${missing.join(", ")}. See .env.example.`);
    if (c.ATTRIBUTION_CODE === "celo_test1234")
      console.warn("⚠ ATTRIBUTION_CODE is the dev placeholder; mainnet transactions will not be credited.");
  }
  return c;
}

/**
 * Last second of the current calendar quarter in Lagos (WAT, UTC+1, no DST).
 * It also falls inside the same UTC year, which matters because the session's
 * spend cap uses Altana's "year" period as a per-session total.
 */
export function endOfQuarter(d = new Date()): Date {
  const lagos = new Date(d.getTime() + 3600_000);
  const q = Math.floor(lagos.getUTCMonth() / 3);
  return new Date(Date.UTC(lagos.getUTCFullYear(), q * 3 + 3, 1) - 3600_000 - 1000);
}
