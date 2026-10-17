import { getSession } from "../../../lib/auth";
import { canViewReport, getReport, logActivity, notify } from "../../../lib/permissions";
import { err, json, newId, now, type Env } from "../../../lib/util";

export async function onRequestPost(context: { request: Request; env: Env; params: { id: string } }) {
  const { request, env } = context;
  const session = await getSession(request, env);
  if (!session?.user) return err("Unauthorized", 401);
  const report = await getReport(env.DB, context.params.id);
  if (!report) return err("Report not found", 404);
  if (!(await canViewReport(env.DB, session.user.id, report))) return err("Not found", 404);
  if (!(await canViewReport(env.DB, session.user.id, report))) return err("Not found", 404);
  // Duplicate: copy the report + steps + label assignments. Attachments are
  // NOT copied (they stay with the original); the response says so.
  const copyId = newId();
  const ts = now();
  await env.DB.prepare(
    `INSERT INTO reports (id, owner_id, workspace_id, title, site_name, site_url, category, severity,
      status, description, trying_to_do, happened_instead, expected_result, actual_result,
      error_message, notes, incident_at, env_json, archived, created_at, updated_at)
     SELECT ?, owner_id, workspace_id, title || ' (copy)', site_name, site_url, category, severity,
      'draft', description, trying_to_do, happened_instead, expected_result, actual_result,
      error_message, notes, incident_at, env_json, 0, ?, ? FROM reports WHERE id = ?`
  ).bind(copyId, ts, ts, report.id).run();
  const steps = await env.DB.prepare("SELECT * FROM report_steps WHERE report_id = ? ORDER BY position ASC").bind(report.id).all<{ text: string; note: string | null; expected_result: string | null }>();
  if ((steps.results ?? []).length) {
    const stmts = (steps.results ?? []).map((s, i) =>
      env.DB.prepare("INSERT INTO report_steps (id, report_id, position, text, note, expected_result) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(newId(), copyId, i + 1, s.text, s.note, s.expected_result)
    );
    await env.DB.batch(stmts);
  }
  const labels = await env.DB.prepare("SELECT label_id FROM report_labels WHERE report_id = ?").bind(report.id).all<{ label_id: string }>();
  if ((labels.results ?? []).length) {
    const stmts = (labels.results ?? []).map((l) =>
      env.DB.prepare("INSERT INTO report_labels (report_id, label_id) VALUES (?, ?)").bind(copyId, l.label_id)
    );
    await env.DB.batch(stmts);
  }
  await logActivity(env.DB, { report_id: copyId, workspace_id: report.workspace_id, actor_id: session.user.id, type: "report.duplicated", detail: report.title });
  await notify(env.DB, { user_id: session.user.id, type: "report", title: "Report duplicated", body: `“${report.title}” was duplicated. Attachments were not copied.`, link: `/app/reports/${copyId}` });
  return json({ id: copyId, attachmentsCopied: false }, 201);
}
