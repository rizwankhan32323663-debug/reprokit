import { getSession } from "../../../lib/auth";
import { canEditReport, canViewReport, getReport, logActivity } from "../../../lib/permissions";
import { err, getClientIp, json, newId, now, rateLimit, sha256HexBytes, type Env } from "../../../lib/util";
import {
  buildStorageKey,
  decodeHeader,
  isAllowedContentType,
  matchesMagic,
  MAX_ATTACHMENT_BYTES,
  sanitizeFilename,
} from "../../../lib/attachments";
import {
  checkAttachmentQuota,
  getStorageProvider,
  mapStorageError,
} from "../../../lib/storage";

/**
 * Attachment upload — RAW BINARY body (NOT multipart, NOT base64).
 *
 * Why raw binary: base64 inflates payloads ~33% and burns the Workers Free
 * 10 ms CPU budget on decoding; multipart parsing of a 10 MB body in JS
 * costs CPU too. Raw bytes + metadata in headers keeps the handler inside
 * budget: arrayBuffer() (I/O) + WebCrypto SHA-256 (native, offloaded) +
 * one KV put (I/O).
 *
 * Client sends:
 *   POST /api/reports/:id/attachments
 *   Content-Type: <image/png|image/jpeg|image/webp>
 *   X-Filename: <encodeURIComponent(original name)>
 *   X-Caption: <encodeURIComponent(caption)> (optional)
 *   Body: raw image bytes
 */
export async function onRequestGet(context: { request: Request; env: Env; params: { id: string } }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const report = await getReport(context.env.DB, context.params.id);
  if (!report) return err("Report not found", 404);
  if (!(await canViewReport(context.env.DB, session.user.id, report))) return err("Not found", 404);
  const atts = await context.env.DB.prepare(
    "SELECT id, filename, content_type, size_bytes, caption, is_redacted, created_at FROM attachments WHERE report_id = ? AND deleted_at IS NULL ORDER BY created_at ASC"
  ).bind(report.id).all();
  return json({ attachments: atts.results ?? [] });
}

export async function onRequestPost(context: { request: Request; env: Env; params: { id: string } }) {
  const { request, env } = context;
  const session = await getSession(request, env);
  if (!session?.user) return err("Unauthorized", 401);
  const report = await getReport(env.DB, context.params.id);
  if (!report) return err("Report not found", 404);
  if (!(await canEditReport(env.DB, session.user.id, report))) return err("Forbidden", 403);
  const ip = getClientIp(request);
  if (!(await rateLimit(env.DB, `upload:${ip}:${session.user.id}`, 20, 60 * 60 * 1000))) {
    return err("Upload rate limit reached. Please wait before uploading more.", 429);
  }

  const provider = getStorageProvider(env);
  if (!provider) {
    return err("Screenshot storage is not configured. Uploads are unavailable — your file was not saved.", 503);
  }

  // Declared type comes from the header; content is verified via magic bytes.
  const contentType = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (!isAllowedContentType(contentType)) {
    return err("Only PNG, JPEG, and WebP images are supported.", 400);
  }
  // Pre-check before reading the body: a >10 MB body is rejected without
  // buffering it (protects the 128 MB isolate memory budget).
  const declaredLength = Number(request.headers.get("Content-Length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_ATTACHMENT_BYTES) {
    return err("Each file must be 10 MB or smaller.", 413);
  }
  let body: ArrayBuffer;
  try {
    body = await request.arrayBuffer();
  } catch {
    return err("Could not read upload body.", 400);
  }
  if (body.byteLength === 0) return err("Empty file.", 400);
  if (body.byteLength > MAX_ATTACHMENT_BYTES) {
    return err("Each file must be 10 MB or smaller.", 413);
  }
  const bytes = new Uint8Array(body);
  if (!matchesMagic(bytes, contentType)) {
    return err("File content does not match its declared image type.", 400);
  }

  // Quotas are enforced BEFORE any bytes are written.
  const quota = await checkAttachmentQuota(env.DB, report, body.byteLength);
  if (!quota.ok) return err(quota.message, 429);

  const filename = sanitizeFilename(decodeHeader(request.headers.get("X-Filename")) || "upload");
  const caption = decodeHeader(request.headers.get("X-Caption")).slice(0, 500);
  const attachmentId = newId();
  // Key is server-generated and opaque. The client filename is display-only
  // (metadata + D1 row), never part of the key, never trusted for ownership.
  const key = buildStorageKey(report.owner_id, attachmentId);
  const sha256 = await sha256HexBytes(body);
  try {
    await provider.put(key, body, contentType, {
      ownerId: report.owner_id,
      reportId: report.id,
      contentType,
      sha256,
      filename,
    });
  } catch (e) {
    const mapped = mapStorageError(e);
    return err(mapped.message, mapped.status);
  }
  await env.DB.prepare(
    "INSERT INTO attachments (id, report_id, r2_key, filename, content_type, size_bytes, caption, is_redacted, original_id, provider, deleted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, NULL, ?)"
  ).bind(attachmentId, report.id, key, filename, contentType, body.byteLength, caption, provider.name, now()).run();
  await logActivity(env.DB, { report_id: report.id, workspace_id: report.workspace_id, actor_id: session.user.id, type: "attachment.added", detail: filename });
  return json({ id: attachmentId }, 201);
}
