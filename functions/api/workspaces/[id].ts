import { getSession } from "../../lib/auth";
import { err, json, now, type Env } from "../../lib/util";

async function loadWorkspace(db: D1Database, id: string) {
  return db.prepare("SELECT * FROM workspaces WHERE id = ?").bind(id).first<{
    id: string; name: string; owner_id: string;
  }>();
}

async function memberRole(db: D1Database, workspaceId: string, userId: string): Promise<string | null> {
  const row = await db.prepare("SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
    .bind(workspaceId, userId).first<{ role: string }>();
  return row ? row.role : null;
}

export async function onRequestGet(context: { request: Request; env: Env; params: { id: string } }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const ws = await loadWorkspace(context.env.DB, context.params.id);
  if (!ws) return err("Workspace not found", 404);
  const role = await memberRole(context.env.DB, ws.id, session.user.id);
  if (!role) return err("Not found", 404);
  const members = await context.env.DB.prepare(
    `SELECT m.user_id, m.role, u.name, u.email FROM workspace_members m JOIN user u ON u.id = m.user_id
     WHERE m.workspace_id = ? ORDER BY m.created_at ASC`
  ).bind(ws.id).all();
  const invites = await context.env.DB.prepare(
    "SELECT id, email, role, expires_at, accepted_at FROM workspace_invites WHERE workspace_id = ? AND accepted_at IS NULL ORDER BY created_at DESC"
  ).bind(ws.id).all();
  return json({ workspace: ws, members: members.results ?? [], invites: invites.results ?? [] });
}

export async function onRequestPut(context: { request: Request; env: Env; params: { id: string } }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const ws = await loadWorkspace(context.env.DB, context.params.id);
  if (!ws) return err("Workspace not found", 404);
  const role = await memberRole(context.env.DB, ws.id, session.user.id);
  if (role !== "owner" && role !== "admin") return err("Forbidden", 403);
  let body: { name?: string };
  try {
    body = (await context.request.json()) as { name?: string };
  } catch {
    return err("Invalid JSON body", 400);
  }
  const name = (body.name || "").trim();
  if (!name || name.length > 200) return err("Workspace name is required (max 200 characters).", 400);
  await context.env.DB.prepare("UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?").bind(name, now(), ws.id).run();
  return json({ ok: true });
}

export async function onRequestDelete(context: { request: Request; env: Env; params: { id: string } }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const ws = await loadWorkspace(context.env.DB, context.params.id);
  if (!ws) return err("Workspace not found", 404);
  const role = await memberRole(context.env.DB, ws.id, session.user.id);
  if (role !== "owner") return err("Only the workspace owner can delete it.", 403);
  // Reports keep existing (workspace_id SET NULL via FK). Members + invites cascade.
  await context.env.DB.prepare("DELETE FROM workspaces WHERE id = ?").bind(ws.id).run();
  return json({ ok: true });
}
