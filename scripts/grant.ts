// OWNER (the installer). Grants the agent a session key on the Altana wallet:
//   • may only call USD₮.transfer
//   • may spend at most SESSION_CAP_USDT (relay fees count toward it)
//   • stops working at the end of the quarter (Lagos time) or SESSION_EXPIRES_AT
// Anything outside those limits is refused by the relay before it reaches the
// chain, and `npm run revoke` cancels the key in one transaction.
import { serializeSession, signerFromPrivateKey } from "@altananetwork/sdk";
import { parseUnits } from "viem";
import { altanaClient, altanaExplorer, saveSession } from "../src/altana.js";
import { CELO, endOfQuarter, loadConfig } from "../src/config.js";
import { ensureKey, requireLive } from "./_env.js";

const cfg = loadConfig(process.env, true);
requireLive(cfg);
if (!cfg.OWNER_PRIVATE_KEY || !cfg.ALTANA_WALLET) throw new Error("Run npm run wallet:create first (needs OWNER_PRIVATE_KEY and ALTANA_WALLET)");

// A new session key per grant: reusing a key would overwrite the old grant.
const sessionKey = ensureKey("ALTANA_SESSION_KEY");
const expiryDate = cfg.SESSION_EXPIRES_AT ? new Date(cfg.SESSION_EXPIRES_AT) : endOfQuarter();
const expiry = Math.floor(expiryDate.getTime() / 1000);
if (new Date(expiry * 1000).getUTCFullYear() !== new Date().getUTCFullYear())
  console.warn("⚠ Expiry is in a later UTC year; the 'year' cap will reset on 1 Jan, so the cap is per calendar year, not per session.");

const client = altanaClient(cfg);
const owner = signerFromPrivateKey(cfg.OWNER_PRIVATE_KEY);
const wallet = { address: cfg.ALTANA_WALLET };
const permissions = {
  calls: [{ to: CELO.USDT, signature: "transfer(address,uint256)" }],
  // Altana has no "quarter" period; a yearly cap with an end-of-quarter expiry
  // acts as a total for this session.
  spend: [{ token: CELO.USDT, limit: parseUnits(String(cfg.SESSION_CAP_USDT), 6), period: "year" as const }],
};

const quote = await client.quoteGrantSession({ wallet, signer: owner, permissions, expiry, feeToken: CELO.USDT, chainId: CELO.chainId });
console.log("Grant will cost:", JSON.stringify(quote, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));

const session = await client.grantSession({
  wallet,
  signer: owner,
  sessionSigner: signerFromPrivateKey(sessionKey),
  permissions,
  expiry,
  feeToken: CELO.USDT,
  chainId: CELO.chainId,
});
if (session.status !== "granted") throw new Error(`Grant failed: ${JSON.stringify(session.legs)}`);

saveSession(cfg.ALTANA_SESSION_FILE, {
  ...serializeSession(session),
  keyId: session.keyId,
  keyHash: session.keyHash,
  grantTxHash: session.transactionHash ?? null,
  grantedAt: new Date().toISOString(),
});
console.log(`Granted.
  cap      $${cfg.SESSION_CAP_USDT} USD₮ (USD₮.transfer only)
  expires  ${expiryDate.toISOString()}
  tx       ${session.transactionHash ? `https://celoscan.io/tx/${session.transactionHash}` : "(no hash reported)"}
  key      ${altanaExplorer.key(session.keyId)}
Saved to ${cfg.ALTANA_SESSION_FILE}.`);
