// AGENT. Creates the agent's key if needed and gives Textile FX a standing cNGN
// allowance, so swaps don't spend their 60-second quote window on an approval.
// The agent wallet needs a little USD₮ first (it pays gas in USD₮ via Celo fee
// abstraction): the hackathon USD₮ faucet is enough.
import { erc20Abi, parseUnits } from "viem";
import { agentAccount, payGasInUsdt, publicClient, walletClient } from "../src/chain.js";
import { CELO, loadConfig } from "../src/config.js";
import { ensureKey, requireLive } from "./_env.js";

ensureKey("AGENT_PRIVATE_KEY");
const cfg = loadConfig(process.env, true);
requireLive(cfg);
const account = agentAccount(cfg);
const pub = publicClient(cfg);
const wallet = walletClient(cfg, account);
console.log(`Agent wallet: ${account.address}  (customers pay cNGN here; add it to your hackathon entry)`);

const usdt = await pub.readContract({ address: CELO.USDT, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
if (usdt < 20_000n) {
  console.log("Fund the agent wallet with at least 0.1 USD₮ for gas, then run this again.");
  process.exit(0);
}

// Textile's reactor is the usual spender; its VaultOrderExecutor is the
// spender when an operator vault fills the quote.
const spenders = [CELO.TEXTILE_REACTOR, "0x01b006d5c687bde182aa36F542f1f014144742e2" as const];
const allowance = parseUnits("100000000", 6); // ₦100m standing allowance
for (const spender of spenders) {
  const current = await pub.readContract({ address: CELO.CNGN, abi: erc20Abi, functionName: "allowance", args: [account.address, spender] });
  if (current >= allowance / 2n) {
    console.log(`cNGN allowance for ${spender} already set`);
    continue;
  }
  const hash = await wallet.writeContract({ address: CELO.CNGN, abi: erc20Abi, functionName: "approve", args: [spender, allowance], ...payGasInUsdt } as any);
  await pub.waitForTransactionReceipt({ hash });
  console.log(`Approved Textile spender ${spender}: https://celoscan.io/tx/${hash}`);
}
