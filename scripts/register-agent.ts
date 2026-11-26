// AGENT. Registers the agent's ERC-8004 identity on Celo from the agent wallet
// (the hackathon requires registering from the wallet listed on the entry).
// The registration file is stored onchain as a data: URI.
import { parseAbi, parseEventLogs } from "viem";
import { agentAccount, payGasInUsdt, publicClient, walletClient } from "../src/chain.js";
import { CELO, loadConfig } from "../src/config.js";
import { requireLive, setEnv } from "./_env.js";

const cfg = loadConfig(process.env, true);
requireLive(cfg);
const account = agentAccount(cfg);
const pub = publicClient(cfg);
const wallet = walletClient(cfg, account);

const abi = parseAbi([
  "function register(string agentURI) returns (uint256 agentId)",
  "function setAgentURI(uint256 agentId, string newURI)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);
const registry = `eip155:${CELO.chainId}:${CELO.ERC8004_IDENTITY}`;
const file = (agentId?: bigint) => ({
  type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  name: `Restock agent · ${cfg.INSTALLER_NAME}`,
  description:
    "Protects a solar installer's naira installment income from devaluation: receives customers' cNGN, converts the restock share to USD₮ on Textile FX, and pays the approved supplier from a capped, revocable Altana wallet.",
  ...(process.env.AGENT_IMAGE_URL ? { image: process.env.AGENT_IMAGE_URL } : {}),
  services: [
    ...(process.env.PUBLIC_URL ? [{ name: "web", endpoint: process.env.PUBLIC_URL }] : []),
    { name: "wallet", endpoint: `eip155:${CELO.chainId}:${account.address}` },
  ],
  x402Support: false,
  active: true,
  supportedTrust: ["reputation"],
  ...(agentId != null ? { registrations: [{ agentId: Number(agentId), agentRegistry: registry }] } : {}),
});
const dataUri = (o: object) => `data:application/json;base64,${Buffer.from(JSON.stringify(o)).toString("base64")}`;

if (process.env.ERC8004_AGENT_ID) {
  console.log(`Already registered as agent ${process.env.ERC8004_AGENT_ID}: https://8004scan.io/agents/celo/${process.env.ERC8004_AGENT_ID}`);
  process.exit(0);
}

const hash = await wallet.writeContract({ address: CELO.ERC8004_IDENTITY, abi, functionName: "register", args: [dataUri(file())], ...payGasInUsdt } as any);
const receipt = await pub.waitForTransactionReceipt({ hash });
const [ev] = parseEventLogs({ abi, eventName: "Registered", logs: receipt.logs });
const agentId = ev.args.agentId;
console.log(`Registered agent ${agentId}: https://celoscan.io/tx/${hash}`);

// Add the registration back-reference now that we know the id.
const hash2 = await wallet.writeContract({ address: CELO.ERC8004_IDENTITY, abi, functionName: "setAgentURI", args: [agentId, dataUri(file(agentId))], ...payGasInUsdt } as any);
await pub.waitForTransactionReceipt({ hash: hash2 });
setEnv("ERC8004_AGENT_ID", agentId.toString());
console.log(`Updated registration file: https://celoscan.io/tx/${hash2}
8004scan: https://8004scan.io/agents/celo/${agentId}`);
