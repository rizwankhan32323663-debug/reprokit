import { getSession } from "../../../../lib/auth";
import { canEditReport, getReport } from "../../../../lib/permissions";
import { err, json, type Env } from "../../../../lib/util";

export async function onRequestDelete(context: { request: Request; env: Env; params: { id: string; labelId: string } }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const report = await getReport(context.env.DB, context.params.id);
  if (!report) return err("Report not found", 404);
  if (!(await canEditReport(context.env.DB, session.user.id, report))) return err("Forbidden", 403);
  await context.env.DB.prepare("DELETE FROM report_labels WHERE report_id = ? AND label_id = ?")
    .bind(report.id, context.params.labelId).run();
  return json({ ok: true });
}
