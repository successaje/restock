// The installer's dashboard is the only thing that can reorder stock, change
// the restock rule or read the customer book, so once the server is reachable
// from the internet it sits behind one secret: DASHBOARD_TOKEN.
//
// Signing in with the token sets an HttpOnly, SameSite=Strict cookie holding
// an HMAC of the token (never the token itself), so rotating the token signs
// every browser out. Scripts can send the token as a Bearer header instead.
// Customers never sign in: the pay flow only uses public routes.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

export const SESSION_COOKIE = "restock_session";
const MAX_AGE_S = 30 * 86_400;
const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 10;

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function installerAuth(token: string | undefined) {
  const cookieValue = token ? createHmac("sha256", token).update("restock-installer-session-v1").digest("base64url") : null;
  const failures = new Map<string, { count: number; since: number }>();

  /** Is this request from the installer? Always true when no token is set (local simulation). */
  const isInstaller = (c: Context) => {
    if (!token) return true;
    const bearer = c.req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (bearer && same(bearer, token)) return true;
    const cookie = getCookie(c, SESSION_COOKIE);
    return !!cookie && same(cookie, cookieValue!);
  };

  const guard: MiddlewareHandler = async (c, next) => {
    if (isInstaller(c)) return next();
    return c.json({ error: "sign_in_required" }, 401);
  };

  const clientKey = (c: Context) => c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "direct";
  const isHttps = (c: Context) => new URL(c.req.url).protocol === "https:" || c.req.header("x-forwarded-proto") === "https";

  /** POST /api/session { token } */
  async function signIn(c: Context) {
    if (!token) return c.json({ ok: true });
    const key = clientKey(c);
    const f = failures.get(key);
    if (f && Date.now() - f.since < WINDOW_MS && f.count >= MAX_FAILURES)
      return c.json({ error: "Too many attempts. Try again in a few minutes." }, 429);

    const body = (await c.req.json().catch(() => ({}))) as { token?: unknown };
    if (typeof body.token !== "string" || !same(body.token.trim(), token)) {
      const fresh = !f || Date.now() - f.since >= WINDOW_MS;
      failures.set(key, { count: fresh ? 1 : f.count + 1, since: fresh ? Date.now() : f.since });
      return c.json({ error: "That access key doesn't match this agent." }, 401);
    }
    failures.delete(key);
    setCookie(c, SESSION_COOKIE, cookieValue!, {
      httpOnly: true,
      sameSite: "Strict",
      secure: isHttps(c),
      path: "/",
      maxAge: MAX_AGE_S,
    });
    return c.json({ ok: true });
  }

  /** DELETE /api/session */
  function signOut(c: Context) {
    deleteCookie(c, SESSION_COOKIE, { path: "/", secure: isHttps(c) });
    return c.json({ ok: true });
  }

  /** GET /api/session: does this server need a sign-in, and is this browser signed in? */
  const status = (c: Context) => c.json({ required: !!token, signedIn: isInstaller(c) });

  return { guard, isInstaller, signIn, signOut, status };
}
