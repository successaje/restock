// Read-only smoke test of the live rails against Celo mainnet. Uses a freshly
// generated, unfunded key, so it cannot move funds. Run: npx tsx test/live-readonly.ts
import { fromDataSuffix } from "@celo/attribution-tags";
import { custom, encodeFunctionData, erc20Abi, http, type Hex } from "viem";
import { parseTransaction } from "viem/celo";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { payGasInUsdt, walletClient } from "../src/chain.js";
import { CELO, loadConfig } from "../src/config.js";
import { Ledger } from "../src/ledger.js";
import { LiveRails } from "../src/rails/live.js";

const cfg = loadConfig(
  {
    MODE: "live",
    AGENT_PRIVATE_KEY: generatePrivateKey(),
    ALTANA_WALLET: "0x0000000000000000000000000000000000000001",
    ALTANA_SESSION_KEY: generatePrivateKey(),
    ALTANA_SESSION_FILE: "/nonexistent/session.json",
    SUPPLIER_ADDRESS: "0x0000000000000000000000000000000000000002",
    ATTRIBUTION_CODE: "celo_test1234",
  } as any,
  true,
);
const rails = new LiveRails(cfg, new Ledger(":memory:"));

const head = await (await import("../src/chain.js")).publicClient(cfg).getBlockNumber();
console.log("head block", head);
console.log("scanIncoming (last ~50 blocks, unfunded addr):", (await rails.scanIncoming()).length, "transfers");
console.log("rate ₦/$:", (await rails.quoteRate(1_000_000_000_000n)).toFixed(2));
console.log("agent balances:", await rails.agentBalances());
console.log("fund balance:", await rails.fundBalance());
console.log("session:", (await rails.session()).status);
const pay = await rails.paySupplier(cfg.SUPPLIER_ADDRESS!, 1n);
console.log("paySupplier without a grant:", pay);

// The wallet client must append our ERC-8021 tag to every transaction, including
// CIP-64 (feeCurrency) ones. Capture the signed raw tx instead of broadcasting it.
// The unfunded key can't get a filled tx from the node, so capture the request
// viem sends (eth_fillTransaction) and stop there.
let sent: { data: Hex; feeCurrency?: string } | null = null;
const capture = custom({
  async request({ method, params }: { method: string; params?: any }) {
    if (method === "eth_fillTransaction" || method === "eth_sendRawTransaction") {
      sent = method === "eth_sendRawTransaction" ? (parseTransaction(params[0]) as any) : params[0];
      throw new Error("captured");
    }
    return http(cfg.CELO_RPC_URL)({ chain: undefined }).request({ method, params } as any);
  },
});
const wc = walletClient(cfg, privateKeyToAccount(cfg.AGENT_PRIVATE_KEY!), capture);
const data = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [CELO.USDT, 1n] });
await wc
  .writeContract({ address: CELO.CNGN, abi: erc20Abi, functionName: "transfer", args: [CELO.USDT, 1n], ...payGasInUsdt } as any)
  .catch(() => {});
const tx = sent as { data: Hex; feeCurrency?: string } | null;
if (!tx) throw new Error("no transaction captured");
console.log("feeCurrency (USD₮ adapter):", tx.feeCurrency);
console.log("calldata intact:", tx.data.startsWith(data));
console.log("attribution tag:", fromDataSuffix(tx.data));
process.exit(0);
