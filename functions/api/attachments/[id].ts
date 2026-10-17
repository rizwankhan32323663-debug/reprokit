import { getSession } from "../../lib/auth";
import { canEditReport, canViewReport, getReport, logActivity } from "../../lib/permissions";
import { err, json, type Env } from "../../lib/util";

/** Download (permission-checked, streamed from private R2) or delete. */
export async function onRequestGet(context: { request: Request; env: Env; params: { id: string } }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const att = await context.env.DB.prepare("SELECT * FROM attachments WHERE id = ?").bind(context.params.id).first<{
    report_id: string; r2_key: string; filename: string; content_type: string;
  }>();
  if (!att) return err("Attachment not found", 404);
  const report = await getReport(context.env.DB, att.report_id);
  if (!report) return err("Attachment not found", 404);
  if (!(await canViewReport(context.env.DB, session.user.id, report))) return err("Not found", 404);
  const obj = await context.env.EVIDENCE.get(att.r2_key);
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
  const att = await context.env.DB.prepare("SELECT * FROM attachments WHERE id = ?").bind(context.params.id).first<{
    id: string; report_id: string; r2_key: string;
  }>();
  if (!att) return err("Attachment not found", 404);
  const report = await getReport(context.env.DB, att.report_id);
  if (!report) return err("Attachment not found", 404);
  if (!(await canEditReport(context.env.DB, session.user.id, report))) return err("Forbidden", 403);
  await context.env.EVIDENCE.delete(att.r2_key);
  await context.env.DB.prepare("DELETE FROM attachments WHERE id = ?").bind(att.id).run();
  await logActivity(context.env.DB, { report_id: report.id, workspace_id: report.workspace_id, actor_id: session.user.id, type: "attachment.removed" });
  return json({ ok: true });
}
