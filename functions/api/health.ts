import type { Env } from "../lib/util";

/**
 * GET /api/health — safe liveness/config probe. Returns ONLY presence
 * booleans, NEVER any secret or env value. No auth required. This endpoint
 * must never throw: every check is wrapped in try/catch and reports false
 * on failure. It exists so a production misconfiguration (e.g. a missing
 * binding or secret) can be diagnosed without reading server logs.
 */
interface HealthResult {
  ok: boolean;
  db: boolean;
  kv: boolean;
  secretSet: boolean;
  authUrlSet: boolean;
  storageProvider: string;
  time: string;
}

export async function onRequestGet(context: { env: Env }) {
  const { env } = context;
  const result: HealthResult = {
    ok: false,
    db: false,
    kv: false,
    secretSet: false,
    authUrlSet: false,
    storageProvider: "none",
    time: new Date().toISOString(),
  };
  try {
    // DB: real probe — an unbound or fake binding throws on query.
    try {
      if (env.DB) {
        await env.DB.prepare("SELECT 1").first();
        result.db = true;
      }
    } catch {
      result.db = false;
    }
    // KV: get() on a never-written key returns null when bound, throws when unbound.
    try {
      if (env.EVIDENCE_KV) {
        await env.EVIDENCE_KV.get("__health_probe__");
        result.kv = true;
      }
    } catch {
      result.kv = false;
    }
    try {
      result.secretSet =
        typeof env.BETTER_AUTH_SECRET === "string" && env.BETTER_AUTH_SECRET.length > 0;
    } catch {
      result.secretSet = false;
    }
    try {
      result.authUrlSet =
        typeof env.BETTER_AUTH_URL === "string" && env.BETTER_AUTH_URL.length > 0;
    } catch {
      result.authUrlSet = false;
    }
    try {
      const p =
        typeof env.STORAGE_PROVIDER === "string" && env.STORAGE_PROVIDER
          ? env.STORAGE_PROVIDER
          : "kv";
      result.storageProvider = p === "kv" || p === "r2" ? p : "none";
    } catch {
      result.storageProvider = "none";
    }
    result.ok = result.db && result.secretSet && result.authUrlSet;
  } catch {
    // Never throw: report failure booleans.
    result.ok = false;
  }
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
