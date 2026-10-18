import { FIXED_OWNER_ID, FIXED_OWNER_NAME, getSession } from "../lib/auth";
import { err, json, type Env } from "../lib/util";

/**
 * GET /api/me — returns the single fixed owner (no-login mode). The display
 * name is read from the user table when the owner row exists (created on
 * first profile save); otherwise it falls back to the fixed default.
 */
export async function onRequestGet(context: { request: Request; env: Env }) {
  const session = await getSession(context.request, context.env);
  if (!session?.user) return err("Unauthorized", 401);
  let name = FIXED_OWNER_NAME;
  try {
    const row = await context.env.DB.prepare("SELECT name FROM user WHERE id = ?")
      .bind(FIXED_OWNER_ID)
      .first<{ name: string }>();
    if (row?.name) name = row.name;
  } catch {
    // Table/row missing: fall back to the fixed default name.
  }
  return json({
    user: {
      id: session.user.id,
      name,
      email: session.user.email,
      emailVerified: session.user.emailVerified,
      image: session.user.image ?? null,
    },
  });
}
