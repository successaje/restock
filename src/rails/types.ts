// What the agent needs from the outside world, as one interface with two
// implementations: LiveRails (Celo mainnet, Textile FX, Altana) and SimRails
// (in-memory chain priced with live Textile quotes, for development and demos
// without funds). The agent logic is identical in both.
import type { Address, Hex } from "viem";

export type IncomingTransfer = {
  from: Address;
  amount: bigint; // cNGN base units
  txHash: Hex;
  logIndex: number;
};

export type Conversion = {
  rfqId: string;
  txHash: Hex;
  takerPays: bigint; // cNGN actually spent, fee included
  usdtOut: bigint;
};

export type SpendCap = {
  token: Address;
  period: "minute" | "hour" | "day" | "week" | "month" | "year";
  limit: bigint;
  spent: bigint; // in the current period
};

export type SessionState = {
  wallet: Address;
  keyId: Hex | null;
  keyHash: Hex | null;
  status: "active" | "expired" | "revoked" | "missing";
  expiry: number; // unix seconds
  allowlist: { to: Address; selector: string }[];
  caps: SpendCap[];
  explorerUrl: string | null;
};

/** Why a supplier payment did not go out. Mirrors Altana's error codes, plus
 *  the checks the agent itself makes before asking the wallet. */
export type BlockCode =
  | "spend_limit_exceeded"
  | "call_not_permitted"
  | "session_expired"
  | "session_revoked"
  | "recipient_not_allowlisted"
  | "insufficient_funds"
  | "unknown";

export type PayResult = { ok: true; txHash: Hex } | { ok: false; code: BlockCode; message: string };

export interface Rails {
  readonly mode: "sim" | "live";
  /** Where customers send cNGN. Also the Textile taker. */
  readonly agentAddress: Address;
  /** The installer's Altana smart wallet holding the USD₮ restock fund. */
  readonly fundAddress: Address;
  readonly decimals: { cngn: number; usdt: number };

  /** cNGN transfers into agentAddress since the last scan. */
  scanIncoming(): Promise<IncomingTransfer[]>;
  /** Naira per dollar for selling `sizeCngn`, from a Textile preview. */
  quoteRate(sizeCngn: bigint): Promise<number>;
  /** Sell exactly `cngn` for USD₮ on Textile FX. */
  convert(cngn: bigint): Promise<Conversion>;
  sendUsdtToFund(amount: bigint): Promise<Hex>;
  sendCngn(to: Address, amount: bigint): Promise<Hex>;

  agentBalances(): Promise<{ cngn: bigint; usdt: bigint }>;
  fundBalance(): Promise<bigint>;

  /** Pay a supplier in USD₮ from the Altana wallet under the session key. */
  paySupplier(to: Address, amount: bigint): Promise<PayResult>;
  session(): Promise<SessionState>;
}

export class RailsError extends Error {}
