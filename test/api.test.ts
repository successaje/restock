// The HTTP API, called in memory. Covers the installer lock that has to hold
// once the agent is reachable from the internet, and the routes the
// dashboard and pay page rely on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { CUSTOMER, setup } from "./helpers.js";

const TOKEN = "correct-horse-battery-staple";

function client(env: Record<string, string> = {}) {
  const s = setup(env);
  const app = createApp(s.agent);
  const call = (path: string, init: RequestInit & { json?: unknown; cookie?: string; bearer?: string } = {}) => {
    const { json, cookie, bearer, ...rest } = init;
    const headers = new Headers(rest.headers);
    if (json !== undefined) headers.set("content-type", "application/json");
    if (cookie) headers.set("cookie", cookie);
    if (bearer) headers.set("authorization", `Bearer ${bearer}`);
    return app.request(path, { ...rest, headers, body: json !== undefined ? JSON.stringify(json) : rest.body });
  };
  return { ...s, call };
}

const signIn = async (c: ReturnType<typeof client>, token = TOKEN) => {
  const res = await c.call("/api/session", { method: "POST", json: { token } });
  return { res, cookie: res.headers.get("set-cookie")?.split(";")[0] };
};

test("without a dashboard token (local simulation) everything is open", async () => {
  const c = client();
  assert.equal((await c.call("/api/state")).status, 200);
  assert.deepEqual(await (await c.call("/api/session")).json(), { required: false, signedIn: true });
});

test("with a token, the installer's routes are locked and the customer's stay open", async () => {
  const c = client({ DASHBOARD_TOKEN: TOKEN });
  for (const [path, method] of [
    ["/api/state", "GET"],
    ["/api/history", "GET"],
    ["/api/settings", "GET"],
    ["/api/stream", "GET"],
    ["/api/restock", "POST"],
    ["/api/settings", "PUT"],
    ["/api/customers", "POST"],
    ["/api/tick", "POST"],
    ["/api/sim/revoke", "POST"],
  ] as const) {
    const res = await c.call(path, { method, json: method === "GET" ? undefined : { units: 1 } });
    assert.equal(res.status, 401, `${method} ${path} should need sign-in`);
  }
  assert.equal(c.ledger.orders().length, 0, "the refused reorder never reached the agent");
  assert.equal((await c.rails.session()).status, "active", "the refused revoke never reached the wallet");

  const info = await c.call(`/api/pay-info?wallet=${CUSTOMER}`);
  assert.equal(info.status, 200);
  const body = (await info.json()) as { payTo: string; attributionSuffix: string; customer: { name: string } };
  assert.equal(body.payTo, c.rails.agentAddress);
  assert.match(body.attributionSuffix, /^0x[0-9a-f]+$/);
  assert.equal(body.customer.name, "Adaeze");
  assert.equal((await c.call("/api/health")).status, 200);
  const rate = (await (await c.call("/api/rate")).json()) as { ngnPerUsd: number };
  assert.equal(rate.ngnPerUsd, 1500, "the landing page's live rate stays public");
});

test("signing in sets a strict, HttpOnly cookie that unlocks the dashboard", async () => {
  const c = client({ DASHBOARD_TOKEN: TOKEN });
  assert.equal((await signIn(c, "wrong-but-long-enough")).res.status, 401);

  const { res, cookie } = await signIn(c);
  assert.equal(res.status, 200);
  const setCookie = res.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.ok(!setCookie.includes(TOKEN), "the cookie never carries the token itself");

  assert.equal((await c.call("/api/state", { cookie })).status, 200);
  assert.deepEqual(await (await c.call("/api/session", { cookie })).json(), { required: true, signedIn: true });
  assert.equal((await c.call("/api/state", { bearer: TOKEN })).status, 200, "scripts can use a Bearer header");
  assert.equal((await c.call("/api/state", { cookie: "restock_session=forged" })).status, 401);

  const out = await c.call("/api/session", { method: "DELETE", cookie });
  assert.match(out.headers.get("set-cookie") ?? "", /Max-Age=0/);
});

test("a cookie from before the token was rotated no longer works", async () => {
  const before = client({ DASHBOARD_TOKEN: TOKEN });
  const { cookie } = await signIn(before);
  const after = client({ DASHBOARD_TOKEN: "a-brand-new-rotated-token" });
  assert.equal((await after.call("/api/state", { cookie })).status, 401);
});

test("repeated wrong access keys are slowed down", async () => {
  const c = client({ DASHBOARD_TOKEN: TOKEN });
  for (let i = 0; i < 10; i++) await signIn(c, `guess-number-${i}-padding`);
  assert.equal((await signIn(c)).res.status, 429, "even the right key waits out the lockout");
});

test("a simulated payment flows through to the one number", async () => {
  const c = client();
  assert.equal((await c.call("/api/sim/pay", { method: "POST", json: { from: CUSTOMER, amountNgn: 3_000_000 } })).status, 200);
  const st = (await (await c.call("/api/state")).json()) as { stock: { unitsToday: number; fundUsd: number } };
  assert.equal(st.stock.unitsToday, 2);
  assert.equal(st.stock.fundUsd, 1399.9);

  const order = await c.call("/api/restock", { method: "POST", json: { units: 1 } });
  assert.equal(order.status, 200);
  assert.equal(((await order.json()) as { status: string }).status, "paid");
});

test("bad input is refused with a reason, and refused reorders say why", async () => {
  const c = client();
  const zero = await c.call("/api/restock", { method: "POST", json: { units: 0 } });
  assert.equal(zero.status, 400);
  assert.match(((await zero.json()) as { error: string }).error, /units/);

  const broke = await c.call("/api/restock", { method: "POST", json: { units: 1 } });
  assert.equal(broke.status, 409);
  assert.match(((await broke.json()) as { reason: string }).reason, /^insufficient_funds/);

  assert.equal((await c.call("/api/settings", { method: "PUT", json: { restockBps: 20_000 } })).status, 400);
  assert.equal((await c.call("/api/nope")).status, 404);
  const big = await c.call("/api/customers", { method: "POST", json: { name: "x".repeat(40_000) } });
  assert.equal(big.status, 413);
});

test("a new rule applies to the next installment", async () => {
  const c = client();
  assert.equal((await c.call("/api/settings", { method: "PUT", json: { restockBps: 6000 } })).status, 200);
  await c.call("/api/sim/pay", { method: "POST", json: { from: CUSTOMER, amountNgn: 100_000 } });
  assert.equal(c.ledger.conversions()[0]!.cngnIn, (60_000n * 1_000_000n).toString());
});

test("customers can be added without a wallet in simulation", async () => {
  const c = client();
  const res = await c.call("/api/customers", {
    method: "POST",
    json: { name: "Tunde", system: "5kVA kit", priceNgn: 3_600_000, months: 12 },
  });
  assert.equal(res.status, 200);
  assert.match(((await res.json()) as { wallet: string }).wallet, /^0x[0-9a-fA-F]{40}$/);
});

test("responses carry standard security headers", async () => {
  const res = await client().call("/api/health");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-frame-options"), "SAMEORIGIN");
});
