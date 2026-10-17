import { getSession } from "../../lib/auth";
import { err, json, now, type Env } from "../../lib/util";
import { commentSchema, zodErrorMessage } from "../../lib/schemas";

/** Comment edit/delete: author, or owner/admin of the report's workspace. */
export async function onRequestPut(context: { request: Request; env: Env; params: { id: string } }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const comment = await context.env.DB.prepare("SELECT * FROM comments WHERE id = ?").bind(context.params.id).first<{
    id: string; report_id: string; author_id: string;
  }>();
  if (!comment) return err("Comment not found", 404);
  const report = await context.env.DB.prepare("SELECT * FROM reports WHERE id = ?").bind(comment.report_id).first<{
    owner_id: string; workspace_id: string | null;
  }>();
  if (!report) return err("Comment not found", 404);
  let allowed = comment.author_id === session.user.id || report.owner_id === session.user.id;
  if (!allowed && report.workspace_id) {
    const role = await context.env.DB.prepare(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
    ).bind(report.workspace_id, session.user.id).first<{ role: string }>();
    allowed = role?.role === "owner" || role?.role === "admin";
  }
  if (!allowed) return err("Forbidden", 403);
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return err("Invalid JSON body", 400);
  }
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) return err(zodErrorMessage(parsed.error), 400);
  await context.env.DB.prepare("UPDATE comments SET body = ?, updated_at = ? WHERE id = ?")
    .bind(parsed.data.body, now(), comment.id).run();
  return json({ ok: true });
}

export async function onRequestDelete(context: { request: Request; env: Env; params: { id: string } }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const comment = await context.env.DB.prepare("SELECT * FROM comments WHERE id = ?").bind(context.params.id).first<{
    id: string; report_id: string; author_id: string;
  }>();
  if (!comment) return err("Comment not found", 404);
  const report = await context.env.DB.prepare("SELECT * FROM reports WHERE id = ?").bind(comment.report_id).first<{
    owner_id: string; workspace_id: string | null;
  }>();
  if (!report) return err("Comment not found", 404);
  let allowed = comment.author_id === session.user.id || report.owner_id === session.user.id;
  if (!allowed && report.workspace_id) {
    const role = await context.env.DB.prepare(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
    ).bind(report.workspace_id, session.user.id).first<{ role: string }>();
    allowed = role?.role === "owner" || role?.role === "admin";
  }
  if (!allowed) return err("Forbidden", 403);
  await context.env.DB.prepare("DELETE FROM comments WHERE id = ?").bind(comment.id).run();
  return json({ ok: true });
}
