// HTTP API + static pages: the installer's dashboard (/) and the customer's
// installment page (/pay). Runs the agent loop in the same process.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { z } from "zod";
import type { Address } from "viem";
import { toDataSuffix } from "@celo/attribution-tags";
import { buildAgent } from "./agent.js";
import { CELO } from "./config.js";
import { SimRails } from "./rails/sim.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = (name: string) => readFileSync(join(root, "web", name), "utf8");

const agent = buildAgent();
const { cfg, ledger, rails } = agent;
const app = new Hono();

const addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform((s) => s as Address);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err instanceof z.ZodError ? err.issues : err.message }, 400);
});

app.get("/", (c) => c.html(page("index.html")));
app.get("/pay", (c) => c.html(page("pay.html")));
app.get("/app.css", (c) => c.body(page("app.css"), 200, { "Content-Type": "text/css" }));

app.get("/api/state", async (c) => c.json(await agent.state()));

app.post("/api/tick", async (c) => {
  await agent.tick();
  return c.json({ ok: true });
});

app.post("/api/restock", async (c) => {
  const body = z.object({ units: z.number().int().positive(), supplier: addr.optional() }).parse(await c.req.json());
  const order = await agent.restock(body.units, body.supplier);
  return c.json(order, order.status === "paid" ? 200 : 409);
});

const NewCustomer = z.object({
  name: z.string().min(1),
  wallet: addr,
  system: z.string().min(1),
  priceNgn: z.number().positive(),
  months: z.number().int().positive(),
  startDate: z.string().default(() => new Date().toISOString().slice(0, 10)),
});
app.post("/api/customers", async (c) => c.json(ledger.addCustomer(NewCustomer.parse(await c.req.json()))));

// What the customer pay page needs: where to send cNGN, how much, and the tag.
app.get("/api/pay-info", (c) => {
  const wallet = c.req.query("wallet");
  const customer = wallet ? ledger.customerByWallet(wallet) : undefined;
  return c.json({
    mode: rails.mode,
    installer: cfg.INSTALLER_NAME,
    payTo: rails.agentAddress,
    cngn: CELO.CNGN,
    cngnDecimals: rails.decimals.cngn,
    chainId: CELO.chainId,
    feeCurrency: CELO.USDT_FEE_ADAPTER,
    attributionCode: cfg.ATTRIBUTION_CODE,
    attributionSuffix: toDataSuffix(cfg.ATTRIBUTION_CODE),
    customer: customer ? { ...customer, installmentNgn: customer.priceNgn / customer.months } : null,
  });
});

// ---- sim-only demo controls
if (rails instanceof SimRails) {
  const sim = rails;
  app.post("/api/sim/pay", async (c) => {
    const b = z.object({ from: addr, amountNgn: z.number().positive() }).parse(await c.req.json());
    const txHash = sim.customerPays(b.from, BigInt(Math.round(b.amountNgn * 10 ** rails.decimals.cngn)));
    await agent.tick();
    return c.json({ txHash });
  });
  app.post("/api/sim/revoke", (c) => {
    sim.revoke();
    ledger.log("session", "Installer revoked the agent's session key (one owner transaction)");
    return c.json({ ok: true });
  });
  app.post("/api/sim/grant", async (c) => {
    const b = z.object({ capUsdt: z.number().positive().optional() }).parse(await c.req.json().catch(() => ({})));
    const { session } = sim.grant(b.capUsdt);
    ledger.log(
      "session",
      `Installer granted a session key: USD₮.transfer only, cap $${Number(session.capLimit) / 1e6}, expires ${new Date(session.expiry * 1000).toUTCString()}`,
    );
    return c.json({ ok: true });
  });
}

const port = cfg.PORT;
serve({ fetch: app.fetch, port }, () => {
  console.log(`Restock (${rails.mode}) on http://localhost:${port}  ·  agent ${rails.agentAddress}  ·  fund ${rails.fundAddress}`);
});

const loop = async () => {
  await agent.tick().catch((e) => console.error("tick failed:", e));
  setTimeout(loop, cfg.POLL_MS);
};
loop();
