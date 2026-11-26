// Preflight: what the agent sees right now. Safe to run anytime; sends nothing.
import { codeFromRepo } from "@celo/attribution-tags";
import { buildAgent } from "../src/agent.js";

const agent = buildAgent();
const s = await agent.state();
const repo = process.env.GITHUB_REPO;
const cap = s.session.caps[0];
const attribution = repo
  ? codeFromRepo(repo) === agent.cfg.ATTRIBUTION_CODE
    ? `  ✓ matches ${repo}`
    : `  (codeFromRepo(${repo}) = ${codeFromRepo(repo)})`
  : "";

console.log(`Mode            ${s.mode}
Installer       ${s.installer}
Agent wallet    ${s.agent.address}  (${s.agent.cngn.toLocaleString()} cNGN, ${s.agent.usdt} USD₮)
Restock wallet  ${s.fund.address}  (${s.fund.usdt} USD₮)
Supplier        ${s.supplier.name} ${s.supplier.address ?? "(not set)"}
Rate            ₦${s.ngnPerUsd?.toFixed(2)} per $ (Textile FX preview)
Session key     ${s.session.status}${cap ? `, $${cap.spent} of $${cap.limit} spent` : ""}, expires ${s.session.expiry ? new Date(s.session.expiry * 1000).toISOString() : "–"}
Units today     ${s.stock?.unitsToday ?? "–"} × ${s.unit.name}
Customers       ${s.customers.length}
Attribution     ${agent.cfg.ATTRIBUTION_CODE}${attribution}`);
process.exit(0);
