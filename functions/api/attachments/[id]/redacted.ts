import { getSession } from "../../../lib/auth";
import { canEditReport, getReport, logActivity } from "../../../lib/permissions";
import { err, json, newId, now, sha256HexBytes, type Env } from "../../../lib/util";
import {
  buildStorageKey,
  decodeHeader,
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
 * Redacted copy upload — same raw-binary contract as the main upload route
 * (see functions/api/reports/[id]/attachments.ts). Redacted copies are
 * separate objects through the same storage interface; the original is
 * preserved untouched.
 *
 * Client sends: Content-Type: image/png, X-Filename, X-Caption, raw PNG bytes.
 */
export async function onRequestPost(context: { request: Request; env: Env; params: { id: string } }) {
  const { request, env } = context;
  const session = await getSession(request, env);
  if (!session?.user) return err("Unauthorized", 401);
  const original = await env.DB.prepare("SELECT * FROM attachments WHERE id = ?").bind(context.params.id).first<{
    id: string; report_id: string; deleted_at: number | null;
  }>();
  if (!original || original.deleted_at) return err("Attachment not found", 404);
  const report = await getReport(env.DB, original.report_id);
  if (!report) return err("Attachment not found", 404);
  if (!(await canEditReport(env.DB, session.user.id, report))) return err("Forbidden", 403);

  const provider = getStorageProvider(env);
  if (!provider) {
    return err("Screenshot storage is not configured. Uploads are unavailable — your file was not saved.", 503);
  }
  const contentType = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "image/png") return err("Redacted copies must be PNG images.", 400);
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
  if (body.byteLength === 0 || body.byteLength > MAX_ATTACHMENT_BYTES) {
    return err("Invalid file size.", 400);
  }
  const bytes = new Uint8Array(body);
  if (!matchesMagic(bytes, "image/png")) {
    return err("Redacted copy content is not a PNG image.", 400);
  }

  const quota = await checkAttachmentQuota(env.DB, report, body.byteLength);
  if (!quota.ok) return err(quota.message, 429);

  const filename = sanitizeFilename(decodeHeader(request.headers.get("X-Filename")) || "redacted");
  const caption = decodeHeader(request.headers.get("X-Caption")).slice(0, 500);
  const attachmentId = newId();
  const key = buildStorageKey(report.owner_id, attachmentId);
  const sha256 = await sha256HexBytes(body);
  try {
    await provider.put(key, body, "image/png", {
      ownerId: report.owner_id,
      reportId: report.id,
      contentType: "image/png",
      sha256,
      filename,
    });
  } catch (e) {
    const mapped = mapStorageError(e);
    return err(mapped.message, mapped.status);
  }
  await env.DB.prepare(
    "INSERT INTO attachments (id, report_id, r2_key, filename, content_type, size_bytes, caption, is_redacted, original_id, provider, deleted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NULL, ?)"
  ).bind(attachmentId, report.id, key, filename, "image/png", body.byteLength, caption, original.id, provider.name, now()).run();
  await logActivity(env.DB, { report_id: report.id, workspace_id: report.workspace_id, actor_id: session.user.id, type: "attachment.redacted", detail: filename });
  return json({ id: attachmentId }, 201);
}
