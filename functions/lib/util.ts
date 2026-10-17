import type { D1Database } from "@cloudflare/workers-types";

export interface Env {
  DB: D1Database;
  /** R2 binding — only present when STORAGE_PROVIDER=r2 and the bucket is bound. */
  EVIDENCE?: R2Bucket;
  /** KV binding — the default provider. Only present once the namespace is created + bound. */
  EVIDENCE_KV?: KVNamespace;
  /** 'kv' (default) | 'r2'. Unknown values fail closed (storage unavailable). */
  STORAGE_PROVIDER?: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function err(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export function newId(): string {
  return crypto.randomUUID();
}

export function now(): number {
  return Date.now();
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 of raw bytes (file integrity, stored in provider metadata). */
export async function sha256HexBytes(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/** D1-backed fixed-window rate limiter. Returns true when the attempt is allowed. */
export async function rateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const nowMs = Date.now();
  const windowStart = Math.floor(nowMs / windowMs) * windowMs;
  await db
    .prepare("DELETE FROM rate_limits WHERE window_start < ?")
    .bind(windowStart - windowMs)
    .run();
  const row = await db
    .prepare("SELECT count FROM rate_limits WHERE key = ? AND window_start = ?")
    .bind(key, windowStart)
    .first<{ count: number }>();
  if (row && row.count >= limit) return false;
  await db
    .prepare(
      "INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1) " +
        "ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1"
    )
    .bind(key, windowStart)
    .run();
  return true;
}
