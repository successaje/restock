// Altana smart-wallet helpers shared by the agent and the owner scripts.
//
// The installer's restock wallet is their own EOA address upgraded in place
// (EIP-7702) to an Altana account. The installer (owner key) grants the agent a
// session key that may only call USD₮.transfer, up to a spend cap, until the
// end of the quarter. The relay refuses anything outside that before it
// reaches the chain, and one owner transaction revokes it.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  CELO as ALTANA_CELO,
  createClient,
  deserializeSession,
  serializeSession,
  signerFromPrivateKey,
  type Session,
} from "@altananetwork/sdk";
import { parseAbi, type Address, type Hex } from "viem";
import type { Config } from "./config.js";

export type StoredSession = ReturnType<typeof serializeSession> & {
  keyId: Hex;
  keyHash: Hex;
  grantTxHash: Hex | null;
  grantedAt: string;
};

export function altanaClient(cfg: Config) {
  return createClient({
    chains: [{ ...ALTANA_CELO, publicRpcUrl: cfg.CELO_RPC_URL }],
    // Tags each execute() with "altana,<our code>" (ERC-8021) on the inner call.
    appCode: [cfg.ATTRIBUTION_CODE],
    // The agent's ERC-8004 identity is registered separately (scripts/register-agent.ts).
    agentIdentity: false,
  });
}

export function saveSession(path: string, s: StoredSession) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(s, null, 2));
}

export function loadStoredSession(path: string): StoredSession | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

/** The session description from ALTANA_SESSION_JSON: raw JSON, or base64 of it. */
export function parseStoredSession(raw: string): StoredSession {
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw.trim(), "base64").toString("utf8");
  return JSON.parse(text);
}

export function loadSession(cfg: Config): { stored: StoredSession; session: Session } | null {
  const stored = cfg.ALTANA_SESSION_JSON ? parseStoredSession(cfg.ALTANA_SESSION_JSON) : loadStoredSession(cfg.ALTANA_SESSION_FILE);
  if (!stored || !cfg.ALTANA_SESSION_KEY) return null;
  return { stored, session: deserializeSession(stored, signerFromPrivateKey(cfg.ALTANA_SESSION_KEY)) };
}

// Reads that are not wrapped by the SDK: the account's spend meters and call
// allowlist, and the KeyStore's validity check.
export const accountAbi = parseAbi([
  "function spendInfos(bytes32 keyHash) view returns ((address token, uint8 period, uint256 limit, uint256 spent, uint256 lastUpdated, uint256 currentSpent, uint256 current)[])",
  "function canExecutePackedInfos(bytes32 keyHash) view returns (bytes32[])",
]);
export const keyStoreAbi = parseAbi(["function isValidKey(address user, bytes32 keyId) view returns (bool)"]);

export const PERIODS = ["minute", "hour", "day", "week", "month", "year"] as const;
export const ANY_SELECTOR = "0x32323232";

export function unpackCanExecute(packed: Hex): { to: Address; selector: string } {
  const h = packed.slice(2).padStart(64, "0");
  return { to: `0x${h.slice(0, 40)}` as Address, selector: `0x${h.slice(56)}` };
}

export const altanaExplorer = {
  wallet: (a: string) => `https://explorer.altana.network/account/${a}`,
  key: (keyId: string) => `https://explorer.altana.network/key/${keyId}`,
};
