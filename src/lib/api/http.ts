/**
 * Real backend HTTP client — talks to https://www.9nerz.com/api/* (the live,
 * combined Next.js app: same repo serves the website and every API route).
 *
 * In the packaged app all requests go through the Electron main process via
 * `window.nerz.api.request` (see electron/main.ts) rather than a renderer-side
 * fetch(), because the renderer loads over file:// in production and a browser
 * fetch() from that origin can't clear the API's CORS preflight for
 * Bearer-header requests — Node's fetch in the main process has no such
 * restriction. When running the renderer bare in a browser (no Electron bridge,
 * e.g. `npm run dev:renderer` alone) this falls back to a direct fetch, which
 * works for token-based calls since localhost is CORS-allowlisted on the API —
 * except the two-step signup flow's short-lived verification cookie, which is
 * SameSite=Lax and so won't ride along on that cross-site fallback path; that
 * flow only needs to work in the real (Electron) app anyway.
 */

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type Envelope<T> = { success: boolean; message: string; data?: T; errors?: unknown };

async function viaBridge(method: string, path: string, body: unknown, token: string | null, cookie: string | null) {
  return window.nerz!.api.request(method, path, body, token, cookie);
}

async function viaFetch(method: string, path: string, body: unknown, token: string | null, cookie: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  // Only meaningful in the Electron bridge path — a renderer fetch() can't set
  // an arbitrary Cookie header for a cross-origin request, so this is a no-op
  // here (harmless: this fallback path is dev-only, see file header).
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`https://www.9nerz.com${path}`, {
    method,
    headers,
    credentials: "include",
    body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // empty body
  }
  return { ok: res.ok, status: res.status, data };
}

/** Low-level call — returns the parsed envelope's `data`, throws ApiError on failure.
 *  `cookie` is only needed for the handful of routes (billing) still on the web
 *  app's older cookie-session auth — see lib/services/billing.ts. */
export async function apiRequest<T = unknown>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  token?: string | null,
  cookie?: string | null,
): Promise<T> {
  const hasBridge = typeof window !== "undefined" && !!window.nerz?.api;
  const { ok, status, data } = hasBridge
    ? await viaBridge(method, path, body ?? null, token ?? null, cookie ?? null)
    : await viaFetch(method, path, body ?? null, token ?? null, cookie ?? null);

  const envelope = (data ?? {}) as Partial<Envelope<T>>;
  if (!ok) {
    throw new ApiError(envelope.message || `Request failed (${status})`, status, (envelope as { code?: string }).code);
  }
  return envelope.data as T;
}
