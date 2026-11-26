// Prints today's cNGN -> USD₮ rate from a Textile preview (no wallet needed).
import { Textile, ngnPerUsd } from "../src/textile.js";
const CNGN = "0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f";
const USDT = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e";
const t = new Textile({ chainId: 42220, tag: (d: `0x${string}`) => d } as any);
const size = BigInt(Number(process.argv[2] ?? 100_000) * 1e6);
const p = await t.preview(CNGN, USDT, size);
console.log({ sell: Number(p.takerPays) / 1e6, get: Number(p.buyAmount) / 1e6, ngnPerUsd: ngnPerUsd(p.takerPays, p.buyAmount).toFixed(2), depthCngn: p.availableSellAmount && Number(p.availableSellAmount) / 1e6 });
