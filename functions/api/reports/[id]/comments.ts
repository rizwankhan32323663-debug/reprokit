import { getSession } from "../../../lib/auth";
import { canViewReport, getReport, logActivity } from "../../../lib/permissions";
import { err, json, newId, now, type Env } from "../../../lib/util";
import { commentSchema, zodErrorMessage } from "../../../lib/schemas";

export async function onRequestGet(context: { request: Request; env: Env; params: { id: string } }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const report = await getReport(context.env.DB, context.params.id);
  if (!report) return err("Report not found", 404);
  if (!(await canViewReport(context.env.DB, session.user.id, report))) return err("Not found", 404);
  const comments = await context.env.DB.prepare(
    "SELECT c.*, COALESCE(u.name, 'Owner') AS author_name FROM comments c LEFT JOIN user u ON u.id = c.author_id WHERE report_id = ? ORDER BY created_at ASC"
  ).bind(report.id).all();
  return json({ comments: comments.results ?? [] });
}

export async function onRequestPost(context: { request: Request; env: Env; params: { id: string } }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const report = await getReport(context.env.DB, context.params.id);
  if (!report) return err("Report not found", 404);
  if (!(await canViewReport(context.env.DB, session.user.id, report))) return err("Not found", 404);
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return err("Invalid JSON body", 400);
  }
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) return err(zodErrorMessage(parsed.error), 400);
  const id = newId();
  const ts = now();
  await context.env.DB.prepare(
    "INSERT INTO comments (id, report_id, author_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(id, report.id, session.user.id, parsed.data.body, ts, ts).run();
  await logActivity(context.env.DB, { report_id: report.id, workspace_id: report.workspace_id, actor_id: session.user.id, type: "comment.added", detail: parsed.data.body.slice(0, 100) });
  // Notify the report owner (unless they wrote the comment).
  if (report.owner_id !== session.user.id) {
    const { notify } = await import("../../../lib/permissions");
    await notify(context.env.DB, { user_id: report.owner_id, type: "comment", title: `New comment on “${report.title}”`, body: parsed.data.body.slice(0, 200), link: `/app/reports/${report.id}` });
  }
  return json({ id }, 201);
}
