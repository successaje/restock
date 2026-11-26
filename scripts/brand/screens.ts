// Captures README screenshots of a running Restock instance with headless
// Chrome over the DevTools protocol (waits for real content, not a loader).
// Usage: npm run build && npm start   (in one terminal), then
//        npm run screens -- http://localhost:8787
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const base = process.argv[2] ?? "http://localhost:8787";
const out = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/screenshots");
mkdirSync(out, { recursive: true });

const SHOTS: { name: string; path: string; w: number; h: number; mobile?: boolean; dark?: boolean }[] = [
  { name: "landing", path: "/", w: 1440, h: 900 },
  { name: "overview", path: "/app", w: 1440, h: 1000 },
  { name: "overview-dark", path: "/app", w: 1440, h: 1000, dark: true },
  { name: "reorder", path: "/app/restock", w: 1440, h: 1000 },
  { name: "wallet", path: "/app/wallet", w: 1440, h: 1000 },
  { name: "customers", path: "/app/customers", w: 1440, h: 860 },
  { name: "pay", path: "/pay", w: 390, h: 844, mobile: true },
];

const chrome = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(
  (p) => p && existsSync(p),
);
if (!chrome) throw new Error("Chrome not found; set CHROME_PATH");

const port = 9333;
const proc = spawn(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function cdp() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as { type: string; webSocketDebuggerUrl: string }[];
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error("Chrome DevTools did not come up");
}

const ws = new WebSocket(await cdp());
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map<number, (v: any) => void>();
ws.addEventListener("message", (m) => {
  const msg = JSON.parse(String(m.data));
  if (msg.id && pending.has(msg.id)) pending.get(msg.id)!(msg.result ?? msg.error);
});
const send = (method: string, params: object = {}) =>
  new Promise<any>((r) => {
    pending.set(++id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });

// A customer wallet for the pay page, if the instance has one.
let payPath = "/pay";
try {
  const s = (await (await fetch(`${base}/api/state`)).json()) as { customers: { wallet: string }[] };
  if (s.customers[0]) payPath = `/pay/${s.customers[0].wallet}`;
} catch {}

for (const s of SHOTS) {
  await send("Emulation.setDeviceMetricsOverride", { width: s.w, height: s.h, deviceScaleFactor: 2, mobile: !!s.mobile });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: s.dark ? "dark" : "light" }] });
  await send("Page.navigate", { url: base + (s.name === "pay" ? payPath : s.path) });
  // Wait until the page shows real content (not the loader), then let entrance animations settle.
  for (let i = 0; i < 60; i++) {
    const { result } = await send("Runtime.evaluate", { expression: "document.querySelectorAll('h1,h2').length", returnByValue: true });
    if (result?.value > 0) break;
    await sleep(250);
  }
  await sleep(2600);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(resolve(out, `${s.name}.png`), Buffer.from(shot.data, "base64"));
  console.log(`✓ docs/screenshots/${s.name}.png`);
}

ws.close();
proc.kill();
