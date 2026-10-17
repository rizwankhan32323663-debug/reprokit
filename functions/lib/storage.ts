/**
 * Modular storage layer for attachment bytes.
 *
 * D1 is the source of truth for users, reports, ownership, permissions, and
 * quotas. Providers hold ONLY file bytes + small metadata (ownerId, reportId,
 * contentType, sha256, sanitized filename). Every download goes through an
 * authenticated, permission-checked API route that proxies bytes — raw
 * provider URLs are NEVER exposed to clients.
 *
 * Provider selection: env.STORAGE_PROVIDER ('kv' | 'r2', default 'kv').
 * Switching providers = change the env var (+ bind the new provider). No
 * route or frontend code changes. See README "Storage & R2 migration path".
 *
 * KV notes (verified against official Cloudflare docs, 2026-10-17):
 * - Value max 25 MiB; app cap is 10 MiB (see lib/attachments.ts).
 * - Free: 100,000 reads/day, 1,000 writes/day, 1 GB storage.
 * - NEVER set expirationTtl: KV objects must not expire.
 * - Eventual consistency: a fresh write can take ~60 s to propagate to all
 *   edges. Routes always re-check the D1 row's deleted_at gate, so a stale
 *   KV entry can never resurrect a deleted attachment; the client keeps its
 *   local copy for immediate display after upload.
 */

import type { Env } from "./util";
import type { D1Database } from "@cloudflare/workers-types";
import {
  MAX_USER_ATTACHMENTS,
  MAX_USER_STORAGE_BYTES,
  MAX_WORKSPACE_STORAGE_BYTES,
} from "./attachments";

export interface StoredObject {
  body: ArrayBuffer;
  contentType: string;
  sizeBytes: number;
  /** Provider metadata (all strings). Keys: ownerId, reportId, contentType, sha256, filename. */
  meta: Record<string, string>;
}

export interface StorageHead {
  contentType: string;
  sizeBytes: number;
  meta: Record<string, string>;
}

export interface StorageProvider {
  readonly name: "kv" | "r2";
  /** Server-side providers are always persistent. */
  readonly persistent: true;
  /** Hard per-file cap enforced by this provider (bytes). */
  readonly maxBytes: number;
  put(key: string, body: ArrayBuffer, contentType: string, meta: Record<string, string>): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  head(key: string): Promise<StorageHead | null>;
  delete(key: string): Promise<void>;
}

class KvStorageProvider implements StorageProvider {
  readonly name = "kv" as const;
  readonly persistent = true as const;
  /** KV value max is 25 MiB (official docs). */
  readonly maxBytes = 25 * 1024 * 1024;
  constructor(private kv: KVNamespace) {}
  async put(key: string, body: ArrayBuffer, contentType: string, meta: Record<string, string>): Promise<void> {
    // No expirationTtl — KV objects must never expire.
    await this.kv.put(key, body, { metadata: { contentType, ...meta } });
  }
  async get(key: string): Promise<StoredObject | null> {
    const res = await this.kv.getWithMetadata(key, "arrayBuffer");
    if (res.value === null) return null;
    const meta = (res.metadata ?? {}) as Record<string, string>;
    return {
      body: res.value,
      contentType: meta.contentType ?? "application/octet-stream",
      sizeBytes: res.value.byteLength,
      meta,
    };
  }
  async head(key: string): Promise<StorageHead | null> {
    const res = await this.kv.getWithMetadata(key, "stream");
    if (res.value === null) return null;
    try {
      await res.value.cancel();
    } catch {
      // Stream already consumed/closed — metadata is what we need.
    }
    const meta = (res.metadata ?? {}) as Record<string, string>;
    // Size is authoritative in D1; KV metadata does not carry it, so callers
    // that need size must use the D1 row (or get()). Report 0 here rather
    // than invent a number.
    return { contentType: meta.contentType ?? "application/octet-stream", sizeBytes: 0, meta };
  }
  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }
}

class R2StorageProvider implements StorageProvider {
  readonly name = "r2" as const;
  readonly persistent = true as const;
  /** R2 objects can be far larger than the app cap; app enforces 10 MiB. */
  readonly maxBytes = 5 * 1024 * 1024 * 1024;
  constructor(private bucket: R2Bucket) {}
  async put(key: string, body: ArrayBuffer, contentType: string, meta: Record<string, string>): Promise<void> {
    await this.bucket.put(key, body, { httpMetadata: { contentType }, customMetadata: meta });
  }
  async get(key: string): Promise<StoredObject | null> {
    const obj = await this.bucket.get(key);
    if (!obj) return null;
    return {
      body: await obj.arrayBuffer(),
      contentType: obj.httpMetadata?.contentType ?? "application/octet-stream",
      sizeBytes: obj.size,
      meta: { ...(obj.customMetadata ?? {}) },
    };
  }
  async head(key: string): Promise<StorageHead | null> {
    const obj = await this.bucket.head(key);
    if (!obj) return null;
    return {
      contentType: obj.httpMetadata?.contentType ?? "application/octet-stream",
      sizeBytes: obj.size,
      meta: { ...(obj.customMetadata ?? {}) },
    };
  }
  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }
}

/**
 * Returns the configured provider, or null when no persistent provider is
 * configured (binding missing / unknown STORAGE_PROVIDER value). Callers must
 * treat null as "storage unavailable" (503, honest message) — never silently
 * drop bytes and never pretend an upload was saved.
 */
export function getStorageProvider(env: Env): StorageProvider | null {
  const selected = (env.STORAGE_PROVIDER ?? "kv").toLowerCase();
  if (selected === "r2") {
    return env.EVIDENCE ? new R2StorageProvider(env.EVIDENCE) : null;
  }
  if (selected === "kv") {
    return env.EVIDENCE_KV ? new KvStorageProvider(env.EVIDENCE_KV) : null;
  }
  return null; // Unknown provider value: fail closed, never guess.
}

/** Short provider label for the status endpoint / UI. Never leaks internals. */
export function storageProviderName(env: Env): "kv" | "r2" | "none" {
  const selected = (env.STORAGE_PROVIDER ?? "kv").toLowerCase();
  if (selected === "r2") return env.EVIDENCE ? "r2" : "none";
  if (selected === "kv") return env.EVIDENCE_KV ? "kv" : "none";
  return "none";
}

/**
 * Map a provider error to an HTTP status + honest message. KV limit errors
 * (daily write quota, storage full) surface as 429/503 — never as a silent
 * success, and never as a billing event (no payment method is on file).
 */
export function mapStorageError(e: unknown): { status: number; message: string } {
  const msg = e instanceof Error ? e.message : String(e);
  if (/limit|quota|exceed|too large|capacity|storage.*full/i.test(msg)) {
    return { status: 429, message: "Storage limit reached. Please try again later or delete older screenshots to free space." };
  }
  return { status: 503, message: "Storage is temporarily unavailable. Your file was not saved — please try again." };
}

// --- Quotas (D1 is the source of truth; KV bytes are never counted directly) ---

export interface QuotaUsage {
  usedBytes: number;
  maxBytes: number;
  files: number;
  maxFiles: number;
}

/** Live (non-deleted) usage charged to a report owner. */
export async function usageForUser(db: D1Database, ownerId: string): Promise<QuotaUsage> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(a.size_bytes), 0) AS bytes, COUNT(*) AS files
       FROM attachments a JOIN reports r ON r.id = a.report_id
       WHERE a.deleted_at IS NULL AND r.owner_id = ?`
    )
    .bind(ownerId)
    .first<{ bytes: number; files: number }>();
  return {
    usedBytes: row?.bytes ?? 0,
    maxBytes: MAX_USER_STORAGE_BYTES,
    files: row?.files ?? 0,
    maxFiles: MAX_USER_ATTACHMENTS,
  };
}

/** Live usage charged to a workspace (null workspace = no workspace quota). */
export async function usageForWorkspace(
  db: D1Database,
  workspaceId: string | null
): Promise<QuotaUsage | null> {
  if (!workspaceId) return null;
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(a.size_bytes), 0) AS bytes, COUNT(*) AS files
       FROM attachments a JOIN reports r ON r.id = a.report_id
       WHERE a.deleted_at IS NULL AND r.workspace_id = ?`
    )
    .bind(workspaceId)
    .first<{ bytes: number; files: number }>();
  return {
    usedBytes: row?.bytes ?? 0,
    maxBytes: MAX_WORKSPACE_STORAGE_BYTES,
    files: row?.files ?? 0,
    maxFiles: Number.MAX_SAFE_INTEGER, // No per-workspace file-count cap.
  };
}

/**
 * Enforce quotas BEFORE writing bytes. Returns an error message when the
 * upload would exceed a quota — the caller must not write anything then.
 */
export async function checkAttachmentQuota(
  db: D1Database,
  report: { owner_id: string; workspace_id: string | null },
  newSizeBytes: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await usageForUser(db, report.owner_id);
  if (user.usedBytes + newSizeBytes > user.maxBytes) {
    return {
      ok: false,
      message: `Storage quota exceeded: you have used ${formatMiB(user.usedBytes)} of ${formatMiB(user.maxBytes)}. Delete older screenshots to free space.`,
    };
  }
  if (user.files + 1 > user.maxFiles) {
    return {
      ok: false,
      message: `Attachment limit reached (${user.maxFiles} files). Delete older screenshots to free space.`,
    };
  }
  if (report.workspace_id) {
    const ws = await usageForWorkspace(db, report.workspace_id);
    if (ws && ws.usedBytes + newSizeBytes > ws.maxBytes) {
      return {
        ok: false,
        message: `Workspace storage quota exceeded (${formatMiB(ws.usedBytes)} of ${formatMiB(ws.maxBytes)} used). Delete older screenshots to free space.`,
      };
    }
  }
  return { ok: true };
}

function formatMiB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
