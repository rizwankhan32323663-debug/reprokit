import { getSession } from "../../lib/auth";
import { err, json, type Env } from "../../lib/util";

export async function onRequestPost(context: { request: Request; env: Env }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  await context.env.DB.prepare("UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0").bind(session.user.id).run();
  return json({ ok: true });
}
