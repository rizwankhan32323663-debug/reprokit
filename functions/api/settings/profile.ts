import { getSession } from "../../lib/auth";
import { err, json, now, type Env } from "../../lib/util";
import { profileSchema, zodErrorMessage } from "../../lib/schemas";

export async function onRequestPut(context: { request: Request; env: Env }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return err("Invalid JSON body", 400);
  }
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) return err(zodErrorMessage(parsed.error), 400);
  await context.env.DB.prepare("UPDATE user SET name = ?, updatedAt = ? WHERE id = ?")
    .bind(parsed.data.name, now(), session.user.id).run();
  return json({ ok: true });
}
