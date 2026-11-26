// Typed client for the Restock API. Response types come straight from the
// server code (type-only imports), so the UI can't drift from the API.
import type { RestockAgent } from "../../../src/agent";
import type { AgentEvent, RestockOrder } from "../../../src/ledger";
import type { Settings } from "../../../src/settings";

export type AppState = Awaited<ReturnType<RestockAgent["state"]>> & { sim: { shockPct: number } | null };
export type History = ReturnType<RestockAgent["history"]>;
export type Customer = AppState["customers"][number];
export type ActivityEvent = AgentEvent;
export type Order = RestockOrder;
export type { Settings };

export type PayInfo = {
  mode: "sim" | "live";
  installer: string;
  restockBps: number;
  payTo: `0x${string}`;
  cngn: `0x${string}`;
  cngnDecimals: number;
  chainId: number;
  feeCurrency: `0x${string}`;
  attributionCode: string;
  attributionSuffix: `0x${string}`;
  customer: (Customer & { installmentNgn: number }) | null;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: { Accept: "application/json", ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok && res.status !== 409) {
    const msg = (body && typeof body === "object" && "error" in body ? String((body as any).error) : null) ?? res.statusText;
    throw new ApiError(msg, res.status, body);
  }
  return body as T;
}

export const api = {
  state: () => request<AppState>("/api/state"),
  history: (days = 30) => request<History>(`/api/history?days=${days}`),
  payInfo: (wallet?: string) => request<PayInfo>(`/api/pay-info${wallet ? `?wallet=${encodeURIComponent(wallet)}` : ""}`),
  restock: (units: number) => request<Order>("/api/restock", { method: "POST", json: { units } }),
  addCustomer: (c: { name: string; wallet?: string; system: string; priceNgn: number; months: number; startDate?: string }) =>
    request<Customer>("/api/customers", { method: "POST", json: c }),
  updateSettings: (patch: Partial<Settings>) => request<Settings>("/api/settings", { method: "PUT", json: patch }),
  sim: {
    pay: (from: string, amountNgn: number) => request<{ txHash: string }>("/api/sim/pay", { method: "POST", json: { from, amountNgn } }),
    revoke: () => request<{ ok: true }>("/api/sim/revoke", { method: "POST", json: {} }),
    grant: (capUsdt?: number) => request<{ ok: true }>("/api/sim/grant", { method: "POST", json: { capUsdt } }),
    shock: (pct: number) => request<{ ok: true }>("/api/sim/shock", { method: "POST", json: { pct } }),
  },
};
