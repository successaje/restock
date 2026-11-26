// Runs the agent loop and serves the API and web app from one process.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { serve } from "@hono/node-server";
import { buildAgent } from "./agent.js";
import { createApp } from "./app.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const agent = buildAgent();
const { cfg, rails } = agent;
const app = createApp(agent, { webDist: join(root, "web", "dist") });

serve({ fetch: app.fetch, port: cfg.PORT, hostname: cfg.HOST }, () => {
  console.log(`Restock (${rails.mode}) on http://localhost:${cfg.PORT}  ·  agent ${rails.agentAddress}  ·  fund ${rails.fundAddress}`);
  if (!cfg.DASHBOARD_TOKEN) console.log("Dashboard is open to anyone who can reach this port (no DASHBOARD_TOKEN set).");
});

const loop = async () => {
  await agent.tick().catch((e) => console.error("tick failed:", e));
  setTimeout(loop, cfg.POLL_MS);
};
loop();

// Let a container stop cleanly: finish the current request, then exit.
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => process.exit(0));
