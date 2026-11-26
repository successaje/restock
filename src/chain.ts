// Viem clients for Celo mainnet. Every transaction the agent sends carries the
// hackathon attribution tag (ERC-8021 calldata suffix) and pays gas in USD₮
// through Celo fee abstraction, so the agent never needs to hold CELO.
import { createPublicClient, createWalletClient, http, concat, type Hex, type LocalAccount, type Transport } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { toDataSuffix } from "@celo/attribution-tags";
import { CELO, type Config } from "./config.js";

export function publicClient(cfg: Config) {
  return createPublicClient({ chain: celo, transport: http(cfg.CELO_RPC_URL) });
}

export function tagger(code: string) {
  const suffix = toDataSuffix(code) as Hex;
  return (data: Hex): Hex => (data.toLowerCase().endsWith(suffix.slice(2).toLowerCase()) ? data : concat([data, suffix]));
}

export function walletClient(cfg: Config, account: LocalAccount, transport: Transport = http(cfg.CELO_RPC_URL)) {
  // viem >= 2.45 appends a client-level dataSuffix to every sendTransaction /
  // writeContract, which is exactly the "one line" the hackathon asks for.
  return createWalletClient({
    account,
    chain: celo,
    transport,
    dataSuffix: toDataSuffix(cfg.ATTRIBUTION_CODE) as Hex,
  });
}

export function agentAccount(cfg: Config): LocalAccount {
  if (!cfg.AGENT_PRIVATE_KEY) throw new Error("AGENT_PRIVATE_KEY is not set");
  return privateKeyToAccount(cfg.AGENT_PRIVATE_KEY);
}

/** Pay gas in USD₮ (via its fee adapter) instead of CELO. */
export const payGasInUsdt = { feeCurrency: CELO.USDT_FEE_ADAPTER } as const;

export const celoscan = (hash: string) => `https://celoscan.io/tx/${hash}`;
