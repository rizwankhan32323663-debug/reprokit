import { getSession } from "../../lib/auth";
import { canEditReport, canViewReport, getReport, logActivity } from "../../lib/permissions";
import { err, json, now, type Env } from "../../lib/util";
import { getStorageProvider } from "../../lib/storage";

/**
 * Download (permission-checked, bytes proxied through the Worker) or delete.
 *
 * Downloads NEVER expose a raw provider URL — there is no public KV/R2 URL.
 * Every download re-checks the D1 row's deleted_at flag (D1 is the source of
 * truth), so a stale KV entry can never resurrect a deleted attachment.
 * Delete removes provider bytes AND marks the D1 row deleted.
 */
async function loadAttachment(env: Env, id: string) {
  return env.DB.prepare("SELECT * FROM attachments WHERE id = ?").bind(id).first<{
    id: string; report_id: string; r2_key: string; filename: string; content_type: string; deleted_at: number | null;
  }>();
}

export async function onRequestGet(context: { request: Request; env: Env; params: { id: string } }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const att = await loadAttachment(context.env, context.params.id);
  // Deleted (or missing) attachments are indistinguishable: 404, no leak.
  if (!att || att.deleted_at) return err("Attachment not found", 404);
  const report = await getReport(context.env.DB, att.report_id);
  if (!report) return err("Attachment not found", 404);
  if (!(await canViewReport(context.env.DB, session.user.id, report))) return err("Not found", 404);
  const provider = getStorageProvider(context.env);
  if (!provider) return err("Screenshot storage is not configured.", 503);
  const obj = await provider.get(att.r2_key);
  if (!obj) return err("Attachment file missing", 404);
  const headers = new Headers();
  headers.set("Content-Type", att.content_type);
  headers.set("Content-Disposition", `inline; filename="${att.filename.replace(/"/g, "")}"`);
  headers.set("Cache-Control", "private, max-age=60");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(obj.body, { headers });
}

export async function onRequestDelete(context: { request: Request; env: Env; params: { id: string } }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const att = await loadAttachment(context.env, context.params.id);
  if (!att) return err("Attachment not found", 404);
  const report = await getReport(context.env.DB, att.report_id);
  if (!report) return err("Attachment not found", 404);
  if (!(await canEditReport(context.env.DB, session.user.id, report))) return err("Forbidden", 403);
  if (att.deleted_at) return json({ ok: true }); // Already deleted: idempotent.
  const provider = getStorageProvider(context.env);
  if (!provider) return err("Screenshot storage is not configured — attachment was not deleted.", 503);
  // Bytes first, then the D1 flag. If the provider delete throws, the row
  // stays live and the user can retry — never a half-deleted state.
  await provider.delete(att.r2_key);
  await context.env.DB.prepare("UPDATE attachments SET deleted_at = ? WHERE id = ?").bind(now(), att.id).run();
  await logActivity(context.env.DB, { report_id: report.id, workspace_id: report.workspace_id, actor_id: session.user.id, type: "attachment.removed" });
  return json({ ok: true });
}
