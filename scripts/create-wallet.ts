// OWNER (the installer). Turns the installer's key into an Altana smart wallet
// on Celo. The wallet address is the owner key's own address (EIP-7702), so the
// installer keeps custody. Run this ONCE per owner key.
//
// Before running: use a FRESH key for OWNER_PRIVATE_KEY (or let this script
// generate one), and only ever *receive* funds into it before this step.
import { signerFromPrivateKey } from "@altananetwork/sdk";
import { altanaClient, altanaExplorer } from "../src/altana.js";
import { loadConfig } from "../src/config.js";
import { ensureKey, requireLive, setEnv } from "./_env.js";

const pk = ensureKey("OWNER_PRIVATE_KEY");
const cfg = loadConfig(process.env, true);
requireLive(cfg);

const client = altanaClient(cfg);
const wallet = await client.createWallet({ signer: signerFromPrivateKey(pk) });
setEnv("ALTANA_WALLET", wallet.address);
console.log(`Altana wallet: ${wallet.address}
  ${altanaExplorer.wallet(wallet.address)}

Next: fund it from another wallet with
  • ~25 CELO   (KeyStore registration fees: ~9 CELO per key, the first grant registers two keys)
  • some USD₮  (relay fees; the restock fund itself arrives from the agent)
then run: npm run grant`);
