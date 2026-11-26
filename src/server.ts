// HTTP API + the web app (landing page, installer dashboard, customer pay
// flow). Runs the agent loop in the same process.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import type { Address } from "viem";
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";
import { toDataSuffix } from "@celo/attribution-tags";
import { buildAgent } from "./agent.js";
import { CELO } from "./config.js";
import type { AgentEvent } from "./ledger.js";
import { SimRails } from "./rails/sim.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "web", "dist");

const agent = buildAgent();
const { cfg, ledger, rails } = agent;
const sim = rails instanceof SimRails ? rails : null;
const app = new Hono();

const addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform((s) => s as Address);

app.onError((err, c) => {
  console.error(err);
  const message = err instanceof z.ZodError ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : err.message;
  return c.json({ error: message }, 400);
});

// ---------------------------------------------------------------- read
app.get("/api/state", async (c) => c.json({ ...(await agent.state()), sim: sim ? { shockPct: sim.shockPct } : null }));
app.get("/api/history", (c) => c.json(agent.history(Number(c.req.query("days") ?? 30))));
app.get("/api/settings", (c) => c.json(agent.settings));

// Live updates: one "change" message per agent event, plus a heartbeat.
app.get("/api/stream", (c) =>
  streamSSE(c, async (stream) => {
    const send = (e: AgentEvent) => stream.writeSSE({ event: "change", data: JSON.stringify(e), id: String(e.id) });
    ledger.on("change", send);
    stream.onAbort(() => {
      ledger.off("change", send);
    });
    while (!stream.aborted) {
      await stream.writeSSE({ event: "ping", data: String(Date.now()) });
      await stream.sleep(25_000);
    }
  }),
);

// What the customer pay flow needs: where to send cNGN, how much, and the tag.
app.get("/api/pay-info", (c) => {
  const wallet = c.req.query("wallet");
  const customer = wallet ? ledger.customerByWallet(wallet) : undefined;
  const s = agent.settings;
  return c.json({
    mode: rails.mode,
    installer: s.installerName,
    restockBps: s.restockBps,
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

// ---------------------------------------------------------------- write
app.post("/api/tick", async (c) => {
  await agent.tick();
  return c.json({ ok: true });
});

app.post("/api/restock", async (c) => {
  const body = z.object({ units: z.number().int().positive().max(1000), supplier: addr.optional() }).parse(await c.req.json());
  const order = await agent.restock(body.units, body.supplier);
  return c.json(order, order.status === "paid" ? 200 : 409);
});

app.put("/api/settings", async (c) => {
  const next = agent.updateSettings(await c.req.json());
  agent.invalidateRate();
  return c.json(next);
});

const NewCustomer = z.object({
  name: z.string().trim().min(1).max(80),
  // In simulation a wallet is optional: we make one up so the demo flows.
  wallet: addr.optional(),
  system: z.string().trim().min(1).max(120),
  priceNgn: z.number().positive().max(1_000_000_000),
  months: z.number().int().min(1).max(60),
  startDate: z.string().default(() => new Date().toISOString().slice(0, 10)),
});
app.post("/api/customers", async (c) => {
  const b = NewCustomer.parse(await c.req.json());
  const wallet = b.wallet ?? (sim ? privateKeyToAddress(generatePrivateKey()) : undefined);
  if (!wallet) throw new Error("wallet: the customer's Celo address is required");
  const customer = ledger.addCustomer({ ...b, wallet });
  ledger.log("info", `Added ${customer.name} to the customer book`);
  return c.json(customer);
});

// ---------------------------------------------------------------- simulation-only controls
if (sim) {
  app.post("/api/sim/pay", async (c) => {
    const b = z.object({ from: addr, amountNgn: z.number().positive().max(100_000_000) }).parse(await c.req.json());
    const txHash = sim.customerPays(b.from, BigInt(Math.round(b.amountNgn * 10 ** rails.decimals.cngn)));
    await agent.tick();
    return c.json({ txHash });
  });
  app.post("/api/sim/revoke", (c) => {
    sim.revoke();
    ledger.log("session", "Installer revoked the agent's session key in one owner transaction");
    return c.json({ ok: true });
  });
  app.post("/api/sim/grant", async (c) => {
    const b = z.object({ capUsdt: z.number().positive().max(1_000_000).optional() }).parse(await c.req.json().catch(() => ({})));
    const { session } = sim.grant(b.capUsdt);
    ledger.log(
      "session",
      `Installer granted a new session key: USD₮ transfers only, cap $${(Number(session.capLimit) / 1e6).toLocaleString()}, expires end of quarter`,
    );
    return c.json({ ok: true });
  });
  app.post("/api/sim/shock", async (c) => {
    const { pct } = z.object({ pct: z.number().min(-50).max(200) }).parse(await c.req.json());
    sim.shock(pct);
    agent.invalidateRate();
    await agent.rate();
    ledger.log("info", pct === 0 ? "Simulation: naira back to today's live rate" : `Simulation: naira moved ${pct > 0 ? "−" : "+"}${Math.abs(pct)}% against the dollar`);
    return c.json({ ok: true });
  });
}

// ---------------------------------------------------------------- web app
if (existsSync(dist)) {
  const rel = relative(process.cwd(), dist) || ".";
  app.use("/assets/*", serveStatic({ root: rel, onFound: (_p, c) => c.header("Cache-Control", "public, max-age=31536000, immutable") }));
  app.use("/*", serveStatic({ root: rel }));
  const index = readFileSync(join(dist, "index.html"), "utf8");
  app.get("*", (c) => (c.req.path.startsWith("/api/") ? c.notFound() : c.html(index)));
} else {
  app.get("/", (c) => c.text("Web app not built. Run `npm run build`, or `npm run dev` for the dev server on :5173."));
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
