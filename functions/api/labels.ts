import { getSession } from "../lib/auth";
import { err, json, newId, type Env } from "../lib/util";

export async function onRequestGet(context: { request: Request; env: Env }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const rows = await context.env.DB.prepare(
    `SELECT * FROM labels WHERE owner_id = ? OR workspace_id IN
     (SELECT workspace_id FROM workspace_members WHERE user_id = ?) ORDER BY name ASC`
  ).bind(session.user.id, session.user.id).all();
  return json({ labels: rows.results ?? [] });
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  let body: { name?: string; color?: string; workspace_id?: string | null };
  try {
    body = (await context.request.json()) as { name?: string; color?: string; workspace_id?: string | null };
  } catch {
    return err("Invalid JSON body", 400);
  }
  const name = (body.name || "").trim();
  if (!name || name.length > 100) return err("Label name is required (max 100 characters).", 400);
  const color = /^#[0-9a-fA-F]{6}$/.test(body.color || "") ? (body.color as string) : "#6366f1";
  let workspaceId: string | null = null;
  if (body.workspace_id) {
    const member = await context.env.DB.prepare(
      "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?"
    ).bind(body.workspace_id, session.user.id).first();
    if (!member) return err("Not a member of that workspace", 403);
    workspaceId = body.workspace_id;
  }
  const id = newId();
  await context.env.DB.prepare(
    "INSERT INTO labels (id, workspace_id, owner_id, name, color) VALUES (?, ?, ?, ?, ?)"
  ).bind(id, workspaceId, session.user.id, name, color).run();
  return json({ id }, 201);
}
