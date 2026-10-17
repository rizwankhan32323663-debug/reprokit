/**
 * Pure attachment helpers (no I/O, no framework imports) — unit-tested in
 * tests/unit.test.ts. Used by both the upload routes and the redaction route.
 *
 * Security model: the server never trusts a client-supplied filename, MIME
 * type, or ownership ID. Filenames are sanitized for display only; storage
 * keys are server-generated opaque values (see buildStorageKey).
 */

/** Hard per-file cap. Must stay <= KV's 25 MiB value limit with headroom. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Quotas are charged to the REPORT OWNER and (when set) the report's workspace. */
export const MAX_USER_STORAGE_BYTES = 200 * 1024 * 1024; // 200 MiB per user
export const MAX_USER_ATTACHMENTS = 200; // files per user
export const MAX_WORKSPACE_STORAGE_BYTES = 500 * 1024 * 1024; // 500 MiB per workspace

export const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function isAllowedContentType(contentType: string): boolean {
  return Object.prototype.hasOwnProperty.call(ALLOWED_CONTENT_TYPES, contentType);
}

/** Strip path separators, control chars, and Windows-reserved chars. Display-only. */
export function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[/\\?%*:|"<>]/g, "_")
      .replace(/[\u0000-\u001f\u007f]/g, "_")
      .replace(/^\.+/, "_")
      .slice(0, 120) || "upload"
  );
}

/** Verify actual file content via magic bytes — never trust the declared type. */
export function matchesMagic(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    );
  }
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/webp") {
    return (
      bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    );
  }
  return false;
}

/**
 * Server-generated opaque storage key. The client filename is NEVER part of
 * the key (it lives in KV metadata / the D1 row as display text only).
 * `ownerId` is the REPORT OWNER's id from D1 (server-side), never a
 * client-supplied value.
 */
export function buildStorageKey(ownerId: string, attachmentId: string): string {
  return `att/${ownerId}/${attachmentId}`;
}

/** Decode a header value the client sent URL-encoded (filename / caption). */
export function decodeHeader(value: string | null): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
