// Small helpers shared by the owner/agent setup scripts.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";
import type { Hex } from "viem";

/** Returns the key in `name`, or generates one and appends it to .env. */
export function ensureKey(name: string): Hex {
  const existing = process.env[name];
  if (existing) return existing as Hex;
  const pk = generatePrivateKey();
  const env = existsSync(".env") ? readFileSync(".env", "utf8") : "";
  appendFileSync(".env", `${env && !env.endsWith("\n") ? "\n" : ""}${name}=${pk}\n`);
  process.env[name] = pk;
  console.log(`Generated ${name} (address ${privateKeyToAddress(pk)}) and saved it to .env`);
  return pk;
}

export function setEnv(name: string, value: string) {
  const env = existsSync(".env") ? readFileSync(".env", "utf8") : "";
  if (new RegExp(`^${name}=`, "m").test(env)) {
    console.log(`.env already has ${name}; leaving it. New value: ${value}`);
    return;
  }
  appendFileSync(".env", `${env && !env.endsWith("\n") ? "\n" : ""}${name}=${value}\n`);
  process.env[name] = value;
}

export function requireLive<T extends { MODE: string }>(cfg: T) {
  if (cfg.MODE !== "live") {
    console.error("Set MODE=live in .env first: this script sends Celo mainnet transactions.");
    process.exit(1);
  }
}
