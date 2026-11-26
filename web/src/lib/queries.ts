// Server state lives in TanStack Query. A single SSE connection pushes agent
// events; each one refreshes the queries and, for the events an installer
// cares about, raises a toast.
import { useEffect, useSyncExternalStore } from "react";
import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type ActivityEvent, type Settings } from "./api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 4_000, refetchOnWindowFocus: true, retry: 2 },
  },
});

export const keys = {
  state: ["state"] as const,
  history: (days: number) => ["history", days] as const,
  payInfo: (wallet?: string) => ["pay-info", wallet ?? ""] as const,
};

export const useAppState = () => useQuery({ queryKey: keys.state, queryFn: api.state, refetchInterval: 20_000 });
export const useHistory = (days = 30) =>
  useQuery({ queryKey: keys.history(days), queryFn: () => api.history(days), refetchInterval: 60_000 });

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: keys.state }), qc.invalidateQueries({ queryKey: ["history"] })]);
}

export function useRestock() {
  const refresh = useInvalidateAll();
  return useMutation({ mutationFn: api.restock, onSettled: refresh });
}
export function useAddCustomer() {
  const refresh = useInvalidateAll();
  return useMutation({ mutationFn: api.addCustomer, onSettled: refresh });
}
export function useUpdateSettings() {
  const refresh = useInvalidateAll();
  return useMutation({ mutationFn: (p: Partial<Settings>) => api.updateSettings(p), onSettled: refresh });
}
export function useSim() {
  const refresh = useInvalidateAll();
  const opts = { onSettled: refresh };
  return {
    pay: useMutation({ mutationFn: (v: { from: string; amountNgn: number }) => api.sim.pay(v.from, v.amountNgn), ...opts }),
    revoke: useMutation({ mutationFn: api.sim.revoke, ...opts }),
    grant: useMutation({ mutationFn: (cap?: number) => api.sim.grant(cap), ...opts }),
    shock: useMutation({ mutationFn: api.sim.shock, ...opts }),
  };
}

// ---- live connection status, shared by every component that shows it
type Live = "connecting" | "live" | "offline";
let live: Live = "connecting";
const listeners = new Set<() => void>();
const setLive = (v: Live) => {
  live = v;
  listeners.forEach((l) => l());
};
export const useLiveStatus = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => live,
  );

const toastFor: Partial<Record<ActivityEvent["kind"], (m: string) => void>> = {
  payment: (m) => toast(m, { icon: "₦" }),
  convert: (m) => toast.success(m),
  restock: (m) => toast.success(m),
  blocked: (m) => toast.error(m),
  error: (m) => toast.error(m),
};

/** Subscribe to the agent's event stream. Mount once, in the app shell. */
export function useLiveUpdates({ toasts = true } = {}) {
  const qc = useQueryClient();
  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout>;
    let backoff = 1_000;
    const connect = () => {
      setLive("connecting");
      es = new EventSource("/api/stream");
      es.addEventListener("open", () => {
        setLive("live");
        backoff = 1_000;
      });
      es.addEventListener("change", (msg) => {
        const e = JSON.parse((msg as MessageEvent).data) as ActivityEvent;
        qc.invalidateQueries({ queryKey: keys.state });
        qc.invalidateQueries({ queryKey: ["history"] });
        if (toasts) toastFor[e.kind]?.(e.message);
      });
      es.addEventListener("error", () => {
        setLive("offline");
        es?.close();
        retry = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 30_000);
      });
    };
    connect();
    return () => {
      clearTimeout(retry);
      es?.close();
    };
  }, [qc, toasts]);
}
