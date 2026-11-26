// Textile FX request-for-quote client (API v2), keyless by default.
//
// The flow, per https://fx-docs.textilecredit.com/api/v2/rfq :
//   1. POST /rfq/request with the amount; if Textile answers 401
//      proof_of_control_required, sign an EIP-712 TakerControl proof and retry
//      (one proof opens a ~12h grant for this wallet).
//   2. Approve the sell token for quote.spender if the allowance is short, and
//      wait for the receipt before swapping.
//   3. Send transactions.swap from the taker wallet itself (the order is bound
//      to msg.sender), before quote.expiresAt.
//   4. POST /rfq/{id}/submit with the tx hash.
import { randomBytes } from "node:crypto";
import {
  type Address,
  type Hex,
  type LocalAccount,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Transport,
  erc20Abi,
  toHex,
} from "viem";

const API = "https://api.textilecredit.com/v2";

export type Preview = {
  sellAmount: bigint;
  buyAmount: bigint;
  takerPays: bigint;
  feeAmount: bigint;
  availableSellAmount: bigint | null;
};

export type FirmQuote = {
  rfqId: string;
  claimToken: string | null;
  sellAmount: bigint;
  buyAmount: bigint;
  takerPays: bigint;
  feeAmount: bigint;
  spender: Address;
  expiresAt: number; // unix ms
  approval: { to: Address; data: Hex } | null;
  swap: { to: Address; data: Hex };
  attributionSuffix: Hex | null;
};

export type SwapResult = {
  rfqId: string;
  txHash: Hex;
  approvalTxHash: Hex | null;
  sellAmount: bigint;
  takerPays: bigint;
  buyAmount: bigint;
};

export class NoQuoteError extends Error {
  constructor(
    readonly reason: string,
    readonly retryAfterMs?: number,
  ) {
    super(`Textile returned no quote: ${reason}`);
  }
}

export class TextileApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`Textile API ${status}: ${JSON.stringify(body).slice(0, 400)}`);
  }
}

type Opts = {
  chainId: number;
  account: LocalAccount;
  publicClient: PublicClient<Transport, Chain>;
  walletClient: WalletClient<Transport, Chain, LocalAccount>;
  /** Optional partner key. With one, Textile tags the swap itself. */
  apiKey?: string;
  /** Builder codes Textile should put in its ERC-8021 tag (keyed calls only). */
  builderCodes?: string[];
  /**
   * Appends our attribution tag. The wallet client already adds it to every
   * send (client-level dataSuffix); this is only used to simulate the exact
   * calldata that will go onchain.
   */
  tag: (data: Hex) => Hex;
  /** Extra tx fields, e.g. Celo feeCurrency so gas is paid in USD₮. */
  txExtras?: Record<string, unknown>;
};

export class Textile {
  constructor(private readonly o: Opts) {}

  private headers(extra: Record<string, string> = {}) {
    const h: Record<string, string> = { "Content-Type": "application/json", ...extra };
    if (this.o.apiKey) h.Authorization = `Bearer ${this.o.apiKey}`;
    return h;
  }

  private async post(path: string, body: unknown, extraHeaders?: Record<string, string>) {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: this.headers(extraHeaders),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(75_000), // a cold corridor can take ~70s
    });
    const json = await res.json().catch(() => ({}));
    return { res, json: json as any };
  }

  /** Indicative price, no auth. Used for the dashboard's "today's rate". */
  async preview(sellToken: Address, buyToken: Address, sellAmount: bigint): Promise<Preview> {
    const { res, json } = await this.post("/rfq/preview", {
      chainId: this.o.chainId,
      sellToken,
      buyToken,
      sellAmount: sellAmount.toString(),
    });
    if (!res.ok) throw new TextileApiError(res.status, json);
    const d = json.data ?? json;
    if (d.status === "no_quote") throw new NoQuoteError(d.reason, d.retryAfterMs);
    return {
      sellAmount: BigInt(d.sellAmount),
      buyAmount: BigInt(d.buyAmount),
      takerPays: BigInt(d.takerPays),
      feeAmount: BigInt(d.feeAmount ?? 0),
      availableSellAmount: d.availableSellAmount ? BigInt(d.availableSellAmount) : null,
    };
  }

  private async signTakerProof() {
    const nonce = toHex(randomBytes(32));
    const issuedAt = Date.now();
    const signature = await this.o.account.signTypedData({
      domain: { name: "Textile Taker Control", version: "1", chainId: this.o.chainId },
      types: {
        TakerControl: [
          { name: "taker", type: "address" },
          { name: "chainId", type: "uint256" },
          { name: "nonce", type: "bytes32" },
          { name: "issuedAt", type: "uint256" },
        ],
      },
      primaryType: "TakerControl",
      message: {
        taker: this.o.account.address,
        chainId: BigInt(this.o.chainId),
        nonce,
        issuedAt: BigInt(issuedAt),
      },
    });
    return { nonce, issuedAt, signature };
  }

  /** Firm, executable quote for selling exactly `sellAmount` (fee included). */
  async quote(sellToken: Address, buyToken: Address, sellAmount: bigint): Promise<FirmQuote> {
    const body: Record<string, unknown> = {
      chainId: this.o.chainId,
      sellToken,
      buyToken,
      sellAmount: sellAmount.toString(),
      taker: this.o.account.address,
    };
    if (this.o.apiKey && this.o.builderCodes?.length) {
      body.includeAttribution = true;
      body.builderCodes = this.o.builderCodes;
    }

    let { res, json } = await this.post("/rfq/request", body);
    if (res.status === 401 && json?.error?.details?.reason === "proof_of_control_required") {
      ({ res, json } = await this.post("/rfq/request", { ...body, takerProof: await this.signTakerProof() }));
    }
    if (!res.ok) throw new TextileApiError(res.status, json);

    const d = json.data ?? json;
    if (d.status === "no_quote") throw new NoQuoteError(d.reason, d.retryAfterMs);
    if (d.status !== "quoted") throw new TextileApiError(res.status, json);

    const q = d.quote;
    const tx = d.transactions;
    return {
      rfqId: d.rfqId,
      claimToken: d.claimToken ?? null,
      sellAmount: BigInt(q.sellAmount),
      buyAmount: BigInt(q.buyAmount),
      takerPays: BigInt(q.takerPays),
      feeAmount: BigInt(q.feeAmount ?? 0),
      spender: q.spender as Address,
      expiresAt: new Date(q.expiresAt).getTime(),
      approval: tx.approval ? { to: tx.approval.to, data: tx.approval.data } : null,
      swap: { to: tx.swap.to, data: tx.swap.data },
      attributionSuffix: d.attributionSuffix ?? null,
    };
  }

  /** Quote and execute. Throws NoQuoteError if no maker prices the size. */
  async swap(sellToken: Address, buyToken: Address, sellAmount: bigint): Promise<SwapResult> {
    const { publicClient: pub, walletClient: wallet, account } = this.o;
    const q = await this.quote(sellToken, buyToken, sellAmount);

    // Approve only if the standing allowance is short. scripts/setup.ts sets a
    // standing allowance so this normally doesn't eat into the 60s quote window.
    let approvalTxHash: Hex | null = null;
    const allowance = await pub.readContract({
      address: sellToken,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, q.spender],
    });
    if (allowance < q.takerPays) {
      approvalTxHash = await wallet.writeContract({
        address: sellToken,
        abi: erc20Abi,
        functionName: "approve",
        args: [q.spender, q.takerPays],
        ...(this.o.txExtras as any),
      });
      await pub.waitForTransactionReceipt({ hash: approvalTxHash });
    }

    if (Date.now() >= q.expiresAt - 2_000) {
      await this.cancel(q).catch(() => {});
      throw new Error(`Quote ${q.rfqId} expired before the swap could be sent; request a new one`);
    }

    // Keyed calls come back already tagged (Textile's code + ours), and a second
    // tag would hide the first, so we suppress the client suffix. On the keyless
    // path the client appends our tag; the reactor ignores trailing bytes.
    const preTagged = q.attributionSuffix != null;
    const onchainData = preTagged ? q.swap.data : this.o.tag(q.swap.data);

    // Simulate the exact calldata first so a stale quote reverts here, not onchain.
    await pub.call({ account: account.address, to: q.swap.to, data: onchainData });

    const txHash = await wallet.sendTransaction({
      to: q.swap.to,
      data: q.swap.data,
      value: 0n,
      ...(preTagged ? { dataSuffix: "0x" as Hex } : {}),
      ...(this.o.txExtras as any),
    });
    const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") throw new Error(`Swap ${txHash} reverted`);

    await this.post(
      `/rfq/${q.rfqId}/submit`,
      { txHash },
      q.claimToken ? { "X-Rfq-Claim": q.claimToken } : undefined,
    ).catch(() => {}); // reporting is optional; Textile reconciles from chain

    return {
      rfqId: q.rfqId,
      txHash,
      approvalTxHash,
      sellAmount: q.sellAmount,
      takerPays: q.takerPays,
      buyAmount: q.buyAmount,
    };
  }

  async cancel(q: Pick<FirmQuote, "rfqId" | "claimToken">) {
    await this.post(`/rfq/${q.rfqId}/cancel`, {}, q.claimToken ? { "X-Rfq-Claim": q.claimToken } : undefined);
  }
}

/** Naira per dollar implied by a quote: what you pay over what you get. */
export function ngnPerUsd(takerPaysCngn: bigint, buyAmountUsdt: bigint, cngnDecimals = 6, usdtDecimals = 6): number {
  return Number(takerPaysCngn) / 10 ** cngnDecimals / (Number(buyAmountUsdt) / 10 ** usdtDecimals);
}
