import { getSession } from "../../../lib/auth";
import { canEditReport, getReport } from "../../../lib/permissions";
import { err, json, type Env } from "../../../lib/util";

export async function onRequestPost(context: { request: Request; env: Env; params: { id: string } }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const report = await getReport(context.env.DB, context.params.id);
  if (!report) return err("Report not found", 404);
  if (!(await canEditReport(context.env.DB, session.user.id, report))) return err("Forbidden", 403);
  let body: { label_id?: string };
  try {
    body = (await context.request.json()) as { label_id?: string };
  } catch {
    return err("Invalid JSON body", 400);
  }
  if (!body.label_id) return err("label_id is required", 400);
  const label = await context.env.DB.prepare("SELECT * FROM labels WHERE id = ?").bind(body.label_id).first<{
    id: string; owner_id: string; workspace_id: string | null;
  }>();
  if (!label) return err("Label not found", 404);
  // Label must belong to the user or to a workspace the user belongs to.
  let ok = label.owner_id === session.user.id;
  if (!ok && label.workspace_id) {
    const member = await context.env.DB.prepare(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
    ).bind(label.workspace_id, session.user.id).first();
    ok = !!member;
  }
  if (!ok) return err("Forbidden", 403);
  await context.env.DB.prepare("INSERT OR IGNORE INTO report_labels (report_id, label_id) VALUES (?, ?)")
    .bind(report.id, label.id).run();
  return json({ ok: true });
}

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
