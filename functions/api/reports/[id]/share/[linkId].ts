import { getSession } from "../../../../lib/auth";
import { canEditReport, getReport, logActivity } from "../../../../lib/permissions";
import { err, json, type Env } from "../../../../lib/util";

/** Revoke: DELETE /api/reports/:id/share/:linkId */
export async function onRequestDelete(context: { request: Request; env: Env; params: { id: string; linkId: string } }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const report = await getReport(context.env.DB, context.params.id);
  if (!report) return err("Report not found", 404);
  if (!(await canEditReport(context.env.DB, session.user.id, report))) return err("Forbidden", 403);
  const link = await context.env.DB.prepare("SELECT * FROM share_links WHERE id = ? AND report_id = ?").bind(context.params.linkId, report.id).first<{ id: string }>();
  if (!link) return err("Share link not found", 404);
  await context.env.DB.prepare("UPDATE share_links SET revoked = 1 WHERE id = ?").bind(link.id).run();
  await logActivity(context.env.DB, { report_id: report.id, workspace_id: report.workspace_id, actor_id: session.user.id, type: "share.revoked" });
  return json({ ok: true });
}
