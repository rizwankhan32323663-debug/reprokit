import { getSession } from "../../lib/auth";
import { err, json, type Env } from "../../lib/util";

/** Full user data export: reports, steps, comments, memberships, notifications. */
export async function onRequestGet(context: { request: Request; env: Env }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const userId = session.user.id;
  const reports = await context.env.DB.prepare("SELECT * FROM reports WHERE owner_id = ?").bind(userId).all();
  const comments = await context.env.DB.prepare("SELECT * FROM comments WHERE author_id = ?").bind(userId).all();
  const memberships = await context.env.DB.prepare(
    "SELECT wm.*, w.name AS workspace_name FROM workspace_members wm JOIN workspaces w ON w.id = wm.workspace_id WHERE wm.user_id = ?"
  ).bind(userId).all();
  const notifications = await context.env.DB.prepare("SELECT * FROM notifications WHERE user_id = ?").bind(userId).all();
  const preferences = await context.env.DB.prepare("SELECT * FROM user_preferences WHERE user_id = ?").bind(userId).first();
  return json({
    exported_at: Date.now(),
    user: { id: session.user.id, name: session.user.name, email: session.user.email },
    reports: reports.results ?? [],
    comments: comments.results ?? [],
    memberships: memberships.results ?? [],
    notifications: notifications.results ?? [],
    preferences: preferences ?? null,
  });
}
