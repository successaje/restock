// Server state lives in TanStack Query. A single SSE connection pushes agent
// events; each one refreshes the queries and, for the events an installer
// cares about, raises a toast.
import { useEffect, useSyncExternalStore } from "react";
import { MutationCache, QueryCache, QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError, type ActivityEvent, type Settings } from "./api";

const signedOut = (err: unknown) => err instanceof ApiError && err.status === 401;

// A 401 from any installer route means this browser's sign-in has lapsed (or
// the access key was rotated): re-check the session so the dashboard swaps
// itself for the sign-in screen.
const recheckSession = (err: unknown) => {
  if (signedOut(err)) void queryClient.invalidateQueries({ queryKey: keys.session });
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: recheckSession }),
  mutationCache: new MutationCache({ onError: recheckSession }),
  defaultOptions: {
    queries: { staleTime: 4_000, refetchOnWindowFocus: true, retry: (n, err) => !signedOut(err) && n < 2 },
  },
});

export const keys = {
  session: ["session"] as const,
  state: ["state"] as const,
  history: (days: number) => ["history", days] as const,
  payInfo: (wallet?: string) => ["pay-info", wallet ?? ""] as const,
};

export const useSession = () => useQuery({ queryKey: keys.session, queryFn: api.session, staleTime: Infinity });

export function useSignIn() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.signIn, onSuccess: () => qc.invalidateQueries({ queryKey: keys.session }) });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.signOut,
    onSuccess: async () => {
      // Drop the book from memory before the sign-in screen comes back.
      qc.removeQueries({ queryKey: keys.state });
      qc.removeQueries({ queryKey: ["history"] });
      await qc.invalidateQueries({ queryKey: keys.session });
    },
  });
}

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
