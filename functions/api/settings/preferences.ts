import { getSession } from "../../lib/auth";
import { err, json, type Env } from "../../lib/util";
import { preferencesSchema, zodErrorMessage } from "../../lib/schemas";

export async function onRequestPut(context: { request: Request; env: Env }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return err("Invalid JSON body", 400);
  }
  const parsed = preferencesSchema.safeParse(body);
  if (!parsed.success) return err(zodErrorMessage(parsed.error), 400);
  const existing = await context.env.DB.prepare("SELECT * FROM user_preferences WHERE user_id = ?")
    .bind(session.user.id).first<{ theme: string; email_notifications: number }>();
  const theme = parsed.data.theme ?? existing?.theme ?? "light";
  const emailNotifications = parsed.data.email_notifications ?? (existing?.email_notifications ?? 0);
  await context.env.DB.prepare(
    "INSERT INTO user_preferences (user_id, theme, email_notifications) VALUES (?, ?, ?) " +
      "ON CONFLICT(user_id) DO UPDATE SET theme = excluded.theme, email_notifications = excluded.email_notifications"
  ).bind(session.user.id, theme, emailNotifications ? 1 : 0).run();
  return json({ ok: true });
}
