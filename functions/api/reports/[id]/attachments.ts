import { getSession } from "../../../lib/auth";
import { canEditReport, canViewReport, getReport, logActivity } from "../../../lib/permissions";
import { err, getClientIp, json, newId, now, rateLimit, type Env } from "../../../lib/util";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").replace(/^\.+/, "_").slice(0, 120) || "upload";
}

/** Verify actual file content via magic bytes — not just the extension. */
function matchesMagic(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === "image/png") {
    return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
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

export async function onRequestGet(context: { request: Request; env: Env; params: { id: string } }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const report = await getReport(context.env.DB, context.params.id);
  if (!report) return err("Report not found", 404);
  if (!(await canViewReport(context.env.DB, session.user.id, report))) return err("Not found", 404);
  const atts = await context.env.DB.prepare(
    "SELECT id, filename, content_type, size_bytes, caption, is_redacted, created_at FROM attachments WHERE report_id = ? ORDER BY created_at ASC"
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
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return err("Invalid form data", 400);
  }
  const file = form.get("file");
  const caption = typeof form.get("caption") === "string" ? (form.get("caption") as string).slice(0, 500) : "";
  if (!(file instanceof File)) return err("No file uploaded", 400);
  if (!ALLOWED[file.type]) return err("Only PNG, JPEG, and WebP images are supported.", 400);
  if (file.size > MAX_BYTES) return err("Each file must be 10 MB or smaller.", 400);
  if (file.size === 0) return err("Empty file.", 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesMagic(bytes, file.type)) {
    return err("File content does not match its declared image type.", 400);
  }
  const attachmentId = newId();
  const key = `reports/${report.id}/${attachmentId}/${sanitizeFilename(file.name)}`;
  await env.EVIDENCE.put(key, bytes, { httpMetadata: { contentType: file.type } });
  await env.DB.prepare(
    "INSERT INTO attachments (id, report_id, r2_key, filename, content_type, size_bytes, caption, is_redacted, original_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?)"
  ).bind(attachmentId, report.id, key, sanitizeFilename(file.name), file.type, file.size, caption, now()).run();
  await logActivity(env.DB, { report_id: report.id, workspace_id: report.workspace_id, actor_id: session.user.id, type: "attachment.added", detail: sanitizeFilename(file.name) });
  return json({ id: attachmentId }, 201);
}
