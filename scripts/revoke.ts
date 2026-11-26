// OWNER (the installer). Revokes the agent's session key in one transaction.
// After this the relay refuses every payment the agent tries; the dashboard
// shows "Revoked" and reorders come back blocked. Revocation is permanent:
// run `npm run grant` (with a new ALTANA_SESSION_KEY) to authorise again.
import { signerFromPrivateKey } from "@altananetwork/sdk";
import { altanaClient, altanaExplorer, loadStoredSession } from "../src/altana.js";
import { CELO, loadConfig } from "../src/config.js";
import { requireLive } from "./_env.js";

const cfg = loadConfig(process.env, true);
requireLive(cfg);
const stored = loadStoredSession(cfg.ALTANA_SESSION_FILE);
if (!stored || !cfg.OWNER_PRIVATE_KEY || !cfg.ALTANA_WALLET) throw new Error("Nothing to revoke (no session file or owner key)");

const res = await altanaClient(cfg).revokeSession({
  wallet: { address: cfg.ALTANA_WALLET },
  signer: signerFromPrivateKey(cfg.OWNER_PRIVATE_KEY),
  session: stored.publicKey, // a bare public key avoids re-hydrating the session
  feeToken: CELO.USDT,
  chainId: CELO.chainId,
});
console.log(`Revoke: ${res.status}
  tx   ${res.transactionHash ? `https://celoscan.io/tx/${res.transactionHash}` : "(no hash reported)"}
  key  ${altanaExplorer.key(stored.keyId)}
Remove ALTANA_SESSION_KEY from .env before granting a new key.`);
