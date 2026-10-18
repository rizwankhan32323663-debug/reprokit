import { FIXED_OWNER_ID, getSession } from "../../lib/auth";
import { err, json, now, type Env } from "../../lib/util";
import { profileSchema, zodErrorMessage } from "../../lib/schemas";

/**
 * PUT /api/settings/profile — update the single owner's display name
 * (no-login mode). The owner row is created on first save (INSERT ...
 * ON CONFLICT), so no migration and no pre-existing user row is needed.
 */
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
  const ts = now();
  await context.env.DB.prepare(
    "INSERT INTO user (id, name, email, emailVerified, image, createdAt, updatedAt) " +
      "VALUES (?, ?, '', 0, NULL, ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET name = excluded.name, updatedAt = excluded.updatedAt"
  )
    .bind(FIXED_OWNER_ID, parsed.data.name, ts, ts)
    .run();
  return json({ ok: true });
}
