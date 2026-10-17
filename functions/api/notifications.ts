import { getSession } from "../lib/auth";
import { err, json, type Env } from "../lib/util";

export async function onRequestGet(context: { request: Request; env: Env }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const rows = await context.env.DB.prepare(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
  ).bind(session.user.id).all();
  return json({ notifications: rows.results ?? [] });
}
