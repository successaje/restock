// Celo mainnet rails: cNGN arrives at the agent's address, Textile FX converts
// it, USD₮ moves to the installer's Altana wallet, and suppliers are paid from
// that wallet under the session key. Every agent transaction is tagged.
import { accountHasKey, getKey, isAltanaError } from "@altananetwork/sdk";
import { encodeFunctionData, erc20Abi, parseAbiItem, type Address, type Hex } from "viem";
import { accountAbi, altanaClient, altanaExplorer, keyStoreAbi, loadSession, PERIODS, unpackCanExecute } from "../altana.js";
import { agentAccount, payGasInUsdt, publicClient, tagger, walletClient } from "../chain.js";
import { CELO, type Config } from "../config.js";
import type { Ledger } from "../ledger.js";
import { Textile, ngnPerUsd } from "../textile.js";
import type { Conversion, IncomingTransfer, PayResult, Rails, SessionState } from "./types.js";

const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const SCAN_CHUNK = 2_000n;

export class LiveRails implements Rails {
  readonly mode = "live" as const;
  readonly agentAddress: Address;
  readonly fundAddress: Address;
  readonly decimals = { cngn: 6, usdt: 6 }; // both verified onchain
  private readonly pub;
  private readonly wallet;
  private readonly textile: Textile;
  private readonly altana;

  constructor(
    private readonly cfg: Config,
    private readonly ledger: Ledger,
  ) {
    const account = agentAccount(cfg);
    this.agentAddress = account.address;
    this.fundAddress = cfg.ALTANA_WALLET!;
    this.pub = publicClient(cfg);
    this.wallet = walletClient(cfg, account);
    this.altana = altanaClient(cfg);
    this.textile = new Textile({
      chainId: CELO.chainId,
      account,
      publicClient: this.pub as any,
      walletClient: this.wallet as any,
      apiKey: cfg.TEXTILE_API_KEY,
      // Per the hackathon FAQ: leave Textile's includeAttribution off and let
      // our wallet client append our own tag to the swap calldata.
      tag: tagger(cfg.ATTRIBUTION_CODE),
      txExtras: payGasInUsdt,
    });
  }

  async scanIncoming(): Promise<IncomingTransfer[]> {
    const head = await this.pub.getBlockNumber();
    const saved = this.ledger.get("live.scanFrom");
    let from = saved ? BigInt(saved) : (this.cfg.START_BLOCK ?? head - 50n);
    const out: IncomingTransfer[] = [];
    while (from <= head) {
      const to = from + SCAN_CHUNK - 1n < head ? from + SCAN_CHUNK - 1n : head;
      const logs = await this.pub.getLogs({
        address: CELO.CNGN,
        event: transferEvent,
        args: { to: this.agentAddress },
        fromBlock: from,
        toBlock: to,
      });
      for (const l of logs) {
        out.push({ from: l.args.from!, amount: l.args.value!, txHash: l.transactionHash!, logIndex: l.logIndex! });
      }
      from = to + 1n;
      this.ledger.set("live.scanFrom", from.toString());
    }
    return out;
  }

  async quoteRate(sizeCngn: bigint) {
    const p = await this.textile.preview(CELO.CNGN, CELO.USDT, sizeCngn);
    return ngnPerUsd(p.takerPays, p.buyAmount);
  }

  async convert(cngn: bigint): Promise<Conversion> {
    const before = await this.balance(CELO.USDT, this.agentAddress);
    const r = await this.textile.swap(CELO.CNGN, CELO.USDT, cngn);
    const after = await this.balance(CELO.USDT, this.agentAddress);
    // Gas is paid in USD₮ too, so the delta can be a hair under buyAmount.
    return { rfqId: r.rfqId, txHash: r.txHash, takerPays: r.takerPays, usdtOut: after > before ? after - before : r.buyAmount };
  }

  private async transfer(token: Address, to: Address, amount: bigint): Promise<Hex> {
    const hash = await this.wallet.writeContract({
      address: token,
      abi: erc20Abi,
      functionName: "transfer",
      args: [to, amount],
      ...payGasInUsdt,
    } as any);
    const r = await this.pub.waitForTransactionReceipt({ hash });
    if (r.status !== "success") throw new Error(`transfer ${hash} reverted`);
    return hash;
  }

  sendUsdtToFund(amount: bigint) {
    return this.transfer(CELO.USDT, this.fundAddress, amount);
  }

  sendCngn(to: Address, amount: bigint) {
    return this.transfer(CELO.CNGN, to, amount);
  }

  private balance(token: Address, who: Address) {
    return this.pub.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [who] });
  }

  async agentBalances() {
    const [cngn, usdt] = await Promise.all([
      this.balance(CELO.CNGN, this.agentAddress),
      this.balance(CELO.USDT, this.agentAddress),
    ]);
    return { cngn, usdt };
  }

  fundBalance() {
    return this.balance(CELO.USDT, this.fundAddress);
  }

  async paySupplier(to: Address, amount: bigint): Promise<PayResult> {
    const loaded = loadSession(this.cfg);
    if (!loaded) return { ok: false, code: "unknown", message: "No session key granted yet (run scripts/grant.ts)" };
    const data = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, amount] });
    try {
      const res = await this.altana.execute({
        session: loaded.session,
        calls: [{ to: CELO.USDT, data, value: 0n }],
        feeToken: CELO.USDT,
        chainId: CELO.chainId,
      });
      if (res.status === "CONFIRMED" && res.transactionHash) return { ok: true, txHash: res.transactionHash };
      return { ok: false, code: "unknown", message: `Relay status ${res.status} (${res.statusCode ?? "?"}), callsId ${res.callsId}` };
    } catch (err) {
      if (!isAltanaError(err)) throw err;
      // A revoked key surfaces as "key hash … is unknown" (code "unknown").
      // Confirm against the KeyStore so the installer sees the real reason.
      if (err.code === "unknown" && !(await this.keyIsValid(loaded.stored.keyId)))
        return { ok: false, code: "session_revoked", message: (err as any).relayMessage ?? err.message };
      const code = (["spend_limit_exceeded", "call_not_permitted", "session_expired", "insufficient_funds"] as const).find(
        (c) => c === err.code,
      );
      return { ok: false, code: code ?? "unknown", message: err.message };
    }
  }

  private keyIsValid(keyId: Hex) {
    return this.pub.readContract({
      address: CELO.ALTANA_KEYSTORE,
      abi: keyStoreAbi,
      functionName: "isValidKey",
      args: [this.fundAddress, keyId],
    });
  }

  async session(): Promise<SessionState> {
    const loaded = loadSession(this.cfg);
    const base = { wallet: this.fundAddress, allowlist: [], caps: [], explorerUrl: altanaExplorer.wallet(this.fundAddress) };
    if (!loaded) return { ...base, keyId: null, keyHash: null, status: "missing", expiry: 0 };
    const { stored } = loaded;

    const onAccount = await accountHasKey(this.pub as any, this.fundAddress, stored.keyHash);
    const valid = await this.keyIsValid(stored.keyId);
    const status: SessionState["status"] = !onAccount
      ? "revoked"
      : Date.now() / 1000 >= stored.expiry || !valid
        ? "expired"
        : "active";
    if (status === "revoked")
      return { ...base, explorerUrl: altanaExplorer.key(stored.keyId), keyId: stored.keyId, keyHash: stored.keyHash, status, expiry: stored.expiry };

    const [key, spend, packed] = await Promise.all([
      getKey(this.pub as any, this.fundAddress, stored.keyHash),
      this.pub.readContract({ address: this.fundAddress, abi: accountAbi, functionName: "spendInfos", args: [stored.keyHash] }),
      this.pub.readContract({ address: this.fundAddress, abi: accountAbi, functionName: "canExecutePackedInfos", args: [stored.keyHash] }),
    ]);
    return {
      ...base,
      explorerUrl: altanaExplorer.key(stored.keyId),
      keyId: stored.keyId,
      keyHash: stored.keyHash,
      status,
      expiry: key.expiry,
      allowlist: packed.map(unpackCanExecute),
      caps: spend.map((s) => ({ token: s.token, period: PERIODS[s.period] ?? "year", limit: s.limit, spent: s.currentSpent })),
    };
  }
}
