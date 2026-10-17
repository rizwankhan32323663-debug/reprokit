import { getSession } from "../../../lib/auth";
import { err, json, type Env } from "../../../lib/util";

export async function onRequestPost(context: { request: Request; env: Env; params: { id: string } }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  const n = await context.env.DB.prepare("SELECT * FROM notifications WHERE id = ? AND user_id = ?")
    .bind(context.params.id, session.user.id).first();
  if (!n) return err("Notification not found", 404);
  await context.env.DB.prepare("UPDATE notifications SET read = 1 WHERE id = ?").bind(context.params.id).run();
  return json({ ok: true });
}
