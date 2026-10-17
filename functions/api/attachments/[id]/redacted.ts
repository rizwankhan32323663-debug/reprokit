import { getSession } from "../../../lib/auth";
import { canEditReport, getReport, logActivity } from "../../../lib/permissions";
import { err, json, newId, now, type Env } from "../../../lib/util";

const MAX_BYTES = 10 * 1024 * 1024;

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").replace(/^\.+/, "_").slice(0, 120) || "redacted";
}

export async function onRequestPost(context: { request: Request; env: Env; params: { id: string } }) {
  const { request, env } = context;
  const session = await getSession(request, env);
  if (!session?.user) return err("Unauthorized", 401);
  const original = await env.DB.prepare("SELECT * FROM attachments WHERE id = ?").bind(context.params.id).first<{
    id: string; report_id: string;
  }>();
  if (!original) return err("Attachment not found", 404);
  const report = await getReport(env.DB, original.report_id);
  if (!report) return err("Attachment not found", 404);
  if (!(await canEditReport(env.DB, session.user.id, report))) return err("Forbidden", 403);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return err("Invalid form data", 400);
  }
  const file = form.get("file");
  const caption = typeof form.get("caption") === "string" ? (form.get("caption") as string).slice(0, 500) : "";
  if (!(file instanceof File)) return err("No file uploaded", 400);
  if (file.type !== "image/png") return err("Redacted copies must be PNG images.", 400);
  if (file.size > MAX_BYTES || file.size === 0) return err("Invalid file size.", 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!(bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)) {
    return err("Redacted copy content is not a PNG image.", 400);
  }
  const attachmentId = newId();
  const key = `reports/${report.id}/${attachmentId}/${sanitizeFilename(file.name)}`;
  await env.EVIDENCE.put(key, bytes, { httpMetadata: { contentType: "image/png" } });
  await env.DB.prepare(
    "INSERT INTO attachments (id, report_id, r2_key, filename, content_type, size_bytes, caption, is_redacted, original_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)"
  ).bind(attachmentId, report.id, key, sanitizeFilename(file.name), "image/png", file.size, caption, original.id, now()).run();
  await logActivity(env.DB, { report_id: report.id, workspace_id: report.workspace_id, actor_id: session.user.id, type: "attachment.redacted", detail: sanitizeFilename(file.name) });
  return json({ id: attachmentId }, 201);
}
