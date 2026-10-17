import { getSession } from "../lib/auth";
import { err, json, newId, now, type Env } from "../lib/util";
import { workspaceCreateSchema, zodErrorMessage } from "../lib/schemas";

export async function onRequestGet(context: { request: Request; env: Env }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const rows = await context.env.DB.prepare(
    `SELECT w.*, m.role FROM workspaces w JOIN workspace_members m ON m.workspace_id = w.id
     WHERE m.user_id = ? ORDER BY w.created_at DESC`
  ).bind(session.user.id).all();
  return json({ workspaces: rows.results ?? [] });
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return err("Invalid JSON body", 400);
  }
  const parsed = workspaceCreateSchema.safeParse(body);
  if (!parsed.success) return err(zodErrorMessage(parsed.error), 400);
  const id = newId();
  const ts = now();
  await context.env.DB.prepare(
    "INSERT INTO workspaces (id, name, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(id, parsed.data.name, session.user.id, ts, ts).run();
  await context.env.DB.prepare(
    "INSERT INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)"
  ).bind(id, session.user.id, ts).run();
  return json({ id }, 201);
}
