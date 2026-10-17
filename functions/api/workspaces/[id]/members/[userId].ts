import { getSession } from "../../../../lib/auth";
import { err, json, type Env } from "../../../../lib/util";

export async function onRequestDelete(context: { request: Request; env: Env; params: { id: string; userId: string } }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const ws = await context.env.DB.prepare("SELECT * FROM workspaces WHERE id = ?").bind(context.params.id).first<{ id: string; owner_id: string }>();
  if (!ws) return err("Workspace not found", 404);
  const myRole = await context.env.DB.prepare("SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
    .bind(ws.id, session.user.id).first<{ role: string }>();
  if (!myRole) return err("Not found", 404);
  const targetId = context.params.userId;
  const isSelf = targetId === session.user.id;
  // Owner can remove others. Anyone can remove themselves (leave), except
  // the workspace owner — ownership must be transferred first (not yet
  // implemented; owner removal is blocked with a clear message).
  if (!isSelf && myRole.role !== "owner") return err("Only the workspace owner can remove members.", 403);
  if (isSelf && ws.owner_id === session.user.id) {
    return err("The workspace owner cannot leave. Transfer ownership first (contact support for this deployment).", 400);
  }
  await context.env.DB.prepare("DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?").bind(ws.id, targetId).run();
  return json({ ok: true });
}
